import type { IpcMain, IpcMainInvokeEvent } from "electron";
import { describe, expect, it, vi } from "vitest";
import type { DocumentRecord } from "../../src/types/LibraryTypes";
import { registerFileDialogHandlers } from "./file-dialogs.handler";

type Handler = Parameters<IpcMain["handle"]>[1];

function createHarness() {
  const handlers = new Map<string, Handler>();
  const ipcMain = {
    handle: (channel: string, handler: Handler) => { handlers.set(channel, handler); },
  } as IpcMain;
  const showOpenDialog = vi.fn(async () => ({
    canceled: false,
    filePaths: ["/books/book.pdf"],
  }));
  const document = {
    title: "Book",
    fileType: "pdf" as const,
    fileBuffer: new ArrayBuffer(2),
  } as DocumentRecord & { fileType: "pdf" | "epub"; fileBuffer: ArrayBuffer; title: string };
  const openReadableFile = vi.fn(async () => document);
  registerFileDialogHandlers(ipcMain, { showOpenDialog, openReadableFile });
  const invoke = (channel: string) => {
    const handler = handlers.get(channel);
    if (!handler) throw new Error(`Missing handler: ${channel}`);
    return handler({} as IpcMainInvokeEvent);
  };
  return { handlers, showOpenDialog, openReadableFile, document, invoke };
}

describe("file dialog IPC handlers", () => {
  it("omits PDF buffers but retains EPUB buffers", async () => {
    const { handlers, showOpenDialog, document, invoke } = createHarness();
    expect(handlers.size).toBe(5);
    expect(await invoke("dialog:open-pdf")).toEqual({ ...document, fileBuffer: undefined });
    expect(showOpenDialog).toHaveBeenCalledWith({
      properties: ["openFile"],
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    document.fileType = "epub";
    expect(await invoke("dialog:open-readable-file")).toBe(document);
    expect(await invoke("dialog:open-epub")).toBe(document);
  });

  it("does not open files when canceled and returns selected paths for other dialogs", async () => {
    const { showOpenDialog, openReadableFile, invoke } = createHarness();
    showOpenDialog.mockResolvedValueOnce({ canceled: true, filePaths: [] });
    expect(await invoke("dialog:open-pdf")).toBeNull();
    expect(openReadableFile).not.toHaveBeenCalled();
    expect(await invoke("dialog:open-image")).toBe("/books/book.pdf");
    expect(await invoke("dialog:select-folder")).toEqual({
      canceled: false,
      filePaths: ["/books/book.pdf"],
    });
  });
});
