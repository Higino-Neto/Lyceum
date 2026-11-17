import { spawn } from "node:child_process";
import fs from "node:fs";
import electron from "electron";

const { shell } = electron;

/**
 * Environment for desktop helpers. AppImage/packaged runs inject library
 * paths that break system binaries such as the file manager.
 */
function desktopHelperEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  if (process.env.APPIMAGE) {
    delete env.LD_LIBRARY_PATH;
    delete env.LD_PRELOAD;
  }
  return env;
}

function spawnDetached(command: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const child = spawn(command, args, {
        detached: true,
        stdio: "ignore",
        env: desktopHelperEnv(),
      });
      child.once("error", () => resolve(false));
      child.once("spawn", () => {
        child.unref();
        resolve(true);
      });
    } catch {
      resolve(false);
    }
  });
}

/**
 * Opens a file or folder with the desktop's default handler.
 *
 * On Linux, Electron's `shell.openPath` waits on `xdg-open`; with some file
 * managers (Dolphin/KDE in particular) that call never settles and the main
 * process stops responding until it is killed. Launch the opener as a fully
 * detached process instead and never wait for it.
 *
 * Resolves to an empty string on success or an error message, like
 * `shell.openPath`.
 */
export async function openPathDetached(target: string): Promise<string> {
  if (!fs.existsSync(target)) return `Path does not exist: ${target}`;
  if (process.platform !== "linux") return shell.openPath(target);

  for (const [command, args] of [
    ["xdg-open", [target]],
    ["gio", ["open", target]],
  ] as const) {
    if (await spawnDetached(command, [...args])) return "";
  }
  return "No desktop opener (xdg-open or gio) is available";
}
