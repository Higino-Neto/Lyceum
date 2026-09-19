import type { IpcMain, IpcMainInvokeEvent } from "electron";
import { describe, expect, it, vi } from "vitest";
import { registerWindowHandlers } from "./windows.handler";

type Handler = Parameters<IpcMain["handle"]>[1];

function createHarness() {
  const handlers = new Map<string, Handler>();
  const ipcMain = {
    handle: (channel: string, handler: Handler) => { handlers.set(channel, handler); },
  } as IpcMain;
  const window = {
    minimize: vi.fn(),
    maximize: vi.fn(),
    unmaximize: vi.fn(),
    isMaximized: vi.fn(() => false),
    close: vi.fn(),
  };
  const resolveWindow = vi.fn(() => window);
  const openReadingWindow = vi.fn();
  registerWindowHandlers(ipcMain, { resolveWindow, openReadingWindow });

  const invoke = (channel: string, data?: unknown) => {
    const handler = handlers.get(channel);
    if (!handler) throw new Error(`Missing handler: ${channel}`);
    return handler({} as IpcMainInvokeEvent, data);
  };

  return { handlers, invoke, window, resolveWindow, openReadingWindow };
}

describe("window IPC handlers", () => {
  it("registers and routes window controls to the sender window", () => {
    const { handlers, invoke, window, resolveWindow } = createHarness();
    expect(handlers.size).toBe(5);
    invoke("window:minimize");
    invoke("window:maximize");
    expect(window.minimize).toHaveBeenCalledOnce();
    expect(window.maximize).toHaveBeenCalledOnce();
    window.isMaximized.mockReturnValue(true);
    invoke("window:maximize");
    expect(window.unmaximize).toHaveBeenCalledOnce();
    expect(invoke("window:isMaximized")).toBe(true);
    invoke("window:close");
    expect(window.close).toHaveBeenCalledOnce();
    expect(resolveWindow).toHaveBeenCalledTimes(5);
  });

  it("forwards detached-reader data without modifying it", async () => {
    const { invoke, openReadingWindow } = createHarness();
    const data = { fileHash: "abc", fileName: "Livro.pdf", fileType: "pdf" as const };
    await invoke("window:open-new", data);
    expect(openReadingWindow).toHaveBeenCalledOnce();
    expect(openReadingWindow).toHaveBeenCalledWith(data);
  });
});
