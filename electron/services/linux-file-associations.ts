import { app } from "electron";
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// MIME types Lyceum opens natively. Registering them is what makes the Linux
// file explorers list Lyceum among the recommended/open-with applications.
const LYCEUM_MIME_TYPES = ["application/pdf", "application/epub+zip"];

const DESKTOP_FILE_ID = "com.higino.lyceum.desktop";
const DESKTOP_FILE_NAME = "lyceum.desktop";
const ICON_INSTALL_NAME = "lyceum-app-icon.png";
const STATE_FILE = "linux-mime-registration.json";
const MIME_REVISION = 1;

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
    `Exec="${execCommand}" %F`,
    `Icon=${iconPath}`,
    "Categories=Education;Office;Viewer;",
    `MimeType=${LYCEUM_MIME_TYPES.join(";")};`,
    "StartupWMClass=Lyceum",
    "Terminal=false",
  ];
  return `${lines.join("\n")}\n`;
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
      // deb/rpm: nothing to do — the packaged desktop file handles the
      // registration and `update-desktop-database` ran in the package's
      // post-install script.
      if (state.mimeRevision < MIME_REVISION) {
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
    fs.writeFileSync(userDesktopPath, buildDesktopEntry(appImagePath, iconPath), "utf8");

    await execFileAsync("update-desktop-database", [userApplicationsDir]).catch(() => undefined);

    writeState(app.getPath("userData"), { registeredFor: appImagePath, mimeRevision: MIME_REVISION });
  } catch (error) {
    console.error("[LinuxMime] Could not register file associations:", error);
  }
}

export { DESKTOP_FILE_ID, DESKTOP_FILE_NAME, LYCEUM_MIME_TYPES };
