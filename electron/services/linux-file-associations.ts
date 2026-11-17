import { app } from "electron";
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// MIME types Lyceum opens (natively or through the reader's cached EPUB
// conversion). Registering them is what makes the Linux file explorers list
// Lyceum among the recommended/open-with applications. Keep in sync with
// `linux.mimeTypes` in electron-builder.json5.
const LYCEUM_MIME_TYPES = [
  "application/pdf",
  "application/epub+zip",
  "application/x-mobipocket-ebook",
  "application/vnd.amazon.ebook",
  "application/vnd.amazon.mobi8-ebook",
  "application/x-mobi8-ebook",
  "application/x-fictionbook+xml",
  "application/x-zip-compressed-fb2",
  "application/vnd.comicbook+zip",
  "application/x-cbz",
  "application/vnd.comicbook-rar",
  "application/x-cbr",
];
const SYSTEM_DESKTOP_FILE = path.join("/usr/share/applications", "lyceum.desktop");

const DESKTOP_FILE_ID = "com.higino.lyceum.desktop";
const DESKTOP_FILE_NAME = "lyceum.desktop";
const ICON_INSTALL_NAME = "lyceum-app-icon.png";
const STATE_FILE = "linux-mime-registration.json";
const MIME_REVISION = 2;

type RegistrationState = {
  registeredFor?: string;
  mimeRevision: number;
};

function findPackagedIcon(): string | null {
  const resourcesPath = process.resourcesPath;
  if (!resourcesPath) return null;
  const candidates = [
    path.join(resourcesPath, "app.asar", "resources", "icons", "icon_512.png"),
    path.join(resourcesPath, "resources", "icons", "icon_512.png"),
  ];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      // Probe failures fall through.
    }
  }
  return null;
}

function readState(userDataPath: string): RegistrationState {
  try {
    const raw = fs.readFileSync(path.join(userDataPath, STATE_FILE), "utf8");
    const parsed = JSON.parse(raw) as RegistrationState;
    return {
      registeredFor: typeof parsed.registeredFor === "string" ? parsed.registeredFor : undefined,
      mimeRevision: typeof parsed.mimeRevision === "number" ? parsed.mimeRevision : 0,
    };
  } catch {
    return { mimeRevision: 0 };
  }
}

function writeState(userDataPath: string, state: RegistrationState) {
  try {
    fs.writeFileSync(path.join(userDataPath, STATE_FILE), JSON.stringify(state, null, 2), "utf8");
  } catch {
    // Best-effort bookkeeping only.
  }
}

function buildDesktopEntry(execCommand: string, iconPath: string): string {
  const lines = [
    "[Desktop Entry]",
    "Type=Application",
    "Name=Lyceum",
    "Comment=A smarter home for every book you read",
    `Exec=${execCommand} %U`,
    `Icon=${iconPath}`,
    "Categories=Education;Office;Viewer;",
    `MimeType=${[...LYCEUM_MIME_TYPES, "x-scheme-handler/lyceum"].join(";")};`,
    "StartupWMClass=Lyceum",
    "Terminal=false",
  ];
  return `${lines.join("\n")}\n`;
}

function readMimeTypes(desktopEntry: string): Set<string> {
  const line = desktopEntry.split(/\r?\n/).find((entry) => entry.startsWith("MimeType="));
  return new Set((line?.slice("MimeType=".length) ?? "").split(";").filter(Boolean));
}

function readDesktopKey(desktopEntry: string, key: string): string | null {
  const line = desktopEntry.split(/\r?\n/).find((entry) => entry.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1) : null;
}

async function repairPackagedDesktopEntry(userApplicationsDir: string): Promise<void> {
  let systemEntry: string;
  try {
    systemEntry = fs.readFileSync(SYSTEM_DESKTOP_FILE, "utf8");
  } catch {
    return;
  }
  const registered = readMimeTypes(systemEntry);
  if (LYCEUM_MIME_TYPES.every((mimeType) => registered.has(mimeType))) return;

  const exec = (readDesktopKey(systemEntry, "Exec") ?? `${process.execPath} %U`)
    .replace(/\s+%[fFuU]\s*$/, "");
  const icon = readDesktopKey(systemEntry, "Icon") ?? "lyceum";
  fs.mkdirSync(userApplicationsDir, { recursive: true });
  fs.writeFileSync(
    path.join(userApplicationsDir, DESKTOP_FILE_NAME),
    buildDesktopEntry(exec, icon),
    "utf8",
  );
  await execFileAsync("update-desktop-database", [userApplicationsDir]).catch(() => undefined);
}

/**
 * Keeps Linux file explorers listing Lyceum as a recommended/open-with
 * application for PDF and EPUB files.
 *
 * - deb/rpm installs ship `/usr/share/applications/lyceum.desktop` through
 *   electron-builder's `linux.desktop` MimeType config; there is nothing to
 *   register at runtime (and we must not touch the user's defaults).
 * - AppImages are never installed, so we write a stable user-level desktop
 *   entry pointing at the current AppImage location and re-register when the
 *   file is replaced or the app moves it.
 */
export async function registerLinuxRecommendedApp(): Promise<void> {
  if (process.platform !== "linux" || !app.isPackaged) {
    return;
  }

  const appImagePath = typeof process.env.APPIMAGE === "string" ? process.env.APPIMAGE : "";
  if (appImagePath && !fs.existsSync(appImagePath)) {
    // Extracted/ephemeral run: keep the previous registration untouched.
    return;
  }

  const state = readState(app.getPath("userData"));
  const userApplicationsDir = path.join(os.homedir(), ".local", "share", "applications");
  const userDesktopPath = path.join(userApplicationsDir, DESKTOP_FILE_ID);

  try {
    if (!appImagePath) {
      // deb/rpm: the packaged desktop file normally carries the MIME types.
      // Older packages shipped an entry without them, which keeps Lyceum out
      // of the file manager's recommended apps; a user-level entry with the
      // same id overrides it until a fixed package is installed.
      if (state.mimeRevision < MIME_REVISION) {
        await repairPackagedDesktopEntry(userApplicationsDir);
        writeState(app.getPath("userData"), { mimeRevision: MIME_REVISION });
      }
      return;
    }

    if (state.registeredFor === appImagePath && state.mimeRevision >= MIME_REVISION) {
      try {
        if (fs.existsSync(userDesktopPath)) return;
      } catch {
        // Re-register when probing is impossible.
      }
    }

    let iconPath = "lyceum";
    const packagedIcon = findPackagedIcon();
    if (packagedIcon) {
      const iconDir = path.join(os.homedir(), ".local", "share", "icons");
      fs.mkdirSync(iconDir, { recursive: true });
      const installedIcon = path.join(iconDir, ICON_INSTALL_NAME);
      fs.copyFileSync(packagedIcon, installedIcon);
      iconPath = installedIcon;
    }

    fs.mkdirSync(userApplicationsDir, { recursive: true });
    fs.writeFileSync(userDesktopPath, buildDesktopEntry(`"${appImagePath}"`, iconPath), "utf8");

    await execFileAsync("update-desktop-database", [userApplicationsDir]).catch(() => undefined);

    writeState(app.getPath("userData"), { registeredFor: appImagePath, mimeRevision: MIME_REVISION });
  } catch (error) {
    console.error("[LinuxMime] Could not register file associations:", error);
  }
}

export { DESKTOP_FILE_ID, DESKTOP_FILE_NAME, LYCEUM_MIME_TYPES };
