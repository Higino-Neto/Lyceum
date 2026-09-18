import { BrowserWindow, shell, type IpcMain } from "electron";

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.1;

export function clampZoom(factor: number): number {
  if (!Number.isFinite(factor)) return 1;
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, factor));
}

function updateZoom(transform: (current: number) => number) {
  const window = BrowserWindow.getFocusedWindow();
  if (!window) return;
  window.webContents.setZoomFactor(clampZoom(transform(window.webContents.getZoomFactor())));
  window.webContents.send("zoom-factor-changed", window.webContents.getZoomFactor());
}

export function registerPlatformHandlers(ipcMain: IpcMain) {
  ipcMain.handle("settings:open-default-apps", async () => {
    await shell.openExternal("ms-settings:defaultapps");
    return { success: true };
  });
  ipcMain.handle("zoom:in", () => updateZoom((current) => current + ZOOM_STEP));
  ipcMain.handle("zoom:out", () => updateZoom((current) => current - ZOOM_STEP));
  ipcMain.handle("zoom:reset", () => updateZoom(() => 1));
  ipcMain.handle("zoom:get-factor", () =>
    BrowserWindow.getFocusedWindow()?.webContents.getZoomFactor() ?? 1);
  ipcMain.handle("zoom:set-factor", (_, factor: number) => updateZoom(() => factor));
}
