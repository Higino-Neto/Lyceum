import type { IpcMain } from "electron";
import type { DocumentRecord } from "../../src/types/LibraryTypes";

type ReadableDocument = DocumentRecord & {
  fileBuffer: ArrayBuffer;
  fileType: "pdf" | "epub";
  title: string;
};

export interface FileDialogHandlerDependencies {
  showOpenDialog(options: Electron.OpenDialogOptions): Promise<Electron.OpenDialogReturnValue>;
  openReadableFile(filePath: string): Promise<ReadableDocument | null>;
}

export function registerFileDialogHandlers(
  ipcMain: IpcMain,
  dependencies: FileDialogHandlerDependencies,
): void {
  ipcMain.handle("dialog:open-pdf", async () => {
    const result = await dependencies.showOpenDialog({
      properties: ["openFile"],
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const document = await dependencies.openReadableFile(result.filePaths[0]);
    return document ? { ...document, fileBuffer: undefined } : null;
  });

  ipcMain.handle("dialog:open-epub", async () => {
    const result = await dependencies.showOpenDialog({
      properties: ["openFile"],
      filters: [{ name: "EPUB", extensions: ["epub"] }],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    return dependencies.openReadableFile(result.filePaths[0]);
  });

  ipcMain.handle("dialog:open-readable-file", async () => {
    const result = await dependencies.showOpenDialog({
      properties: ["openFile"],
      filters: [{ name: "PDF e EPUB", extensions: ["pdf", "epub"] }],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const document = await dependencies.openReadableFile(result.filePaths[0]);
    return document?.fileType === "pdf" ? { ...document, fileBuffer: undefined } : document;
  });

  ipcMain.handle("dialog:open-image", async () => {
    const result = await dependencies.showOpenDialog({
      properties: ["openFile"],
      filters: [{ name: "Images", extensions: ["jpg", "jpeg", "png"] }],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    return result.filePaths[0];
  });

  ipcMain.handle("dialog:select-folder", async () => {
    const result = await dependencies.showOpenDialog({ properties: ["openDirectory"] });
    return { canceled: result.canceled, filePaths: result.filePaths };
  });
}
