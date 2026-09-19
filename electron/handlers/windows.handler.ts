import type { BrowserWindow, IpcMain, IpcMainInvokeEvent } from "electron";

export interface DetachedReadingWindowData {
  fileHash: string;
  fileName: string;
  fileType: "pdf" | "epub";
  filePath?: string;
  libraryDocumentId?: string;
  pdfRenderer?: "pdfjs";
  source?: "library" | "local";
}

type WindowControls = Pick<BrowserWindow, "minimize" | "maximize" | "unmaximize" | "isMaximized" | "close">;

export interface WindowHandlerDependencies {
  resolveWindow(event: IpcMainInvokeEvent): WindowControls | null;
  openReadingWindow(data: DetachedReadingWindowData): void;
}

export function registerWindowHandlers(ipcMain: IpcMain, dependencies: WindowHandlerDependencies): void {
  ipcMain.handle("window:minimize", (event) => {
    dependencies.resolveWindow(event)?.minimize();
  });

  ipcMain.handle("window:maximize", (event) => {
    const targetWindow = dependencies.resolveWindow(event);
    if (!targetWindow) return;
    if (targetWindow.isMaximized()) targetWindow.unmaximize();
    else targetWindow.maximize();
  });

  ipcMain.handle("window:close", (event) => {
    dependencies.resolveWindow(event)?.close();
  });

  ipcMain.handle("window:isMaximized", (event) =>
    dependencies.resolveWindow(event)?.isMaximized() ?? false);

  ipcMain.handle("window:open-new", async (_, data: DetachedReadingWindowData) => {
    dependencies.openReadingWindow(data);
  });
}
