import type { IpcMain, IpcMainInvokeEvent } from "electron";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CategoryRepository } from "../../src/core/library/category";
import { backupAllCategories, backupAllDocuments, type BackupDocumentInput } from "../backup";
import { registerBackupHandlers } from "./backup.handler";

vi.mock("../backup", () => ({
  backupAllCategories: vi.fn(async () => ({ success: 0, failed: 0, errors: [] })),
  backupAllDocuments: vi.fn(async () => ({ success: 0, failed: 0, errors: [] })),
  clearBackupSession: vi.fn(async () => ({ success: true })),
  initBackupClient: vi.fn(),
  setBackupSession: vi.fn(async () => ({ success: true })),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("backup IPC handlers", () => {
  it("passes injected snapshots to backup operations", async () => {
    const handlers = new Map<string, Parameters<IpcMain["handle"]>[1]>();
    const ipcMain = {
      handle: (channel: string, handler: Parameters<IpcMain["handle"]>[1]) => {
        handlers.set(channel, handler);
      },
    } as IpcMain;
    const documents = [{ id: 1, title: "Book" }] as unknown as BackupDocumentInput[];
    const relations = [{ documentId: 1, categoryId: 2 }];
    const categories = { list: vi.fn(() => []) } as unknown as CategoryRepository;
    const dataSource = {
      listDocuments: vi.fn(() => documents),
      listDocumentCategories: vi.fn(() => relations),
    };
    registerBackupHandlers(ipcMain, categories, dataSource);
    const invoke = async (channel: string) => {
      const handler = handlers.get(channel);
      if (!handler) throw new Error(`Missing handler: ${channel}`);
      return handler({} as IpcMainInvokeEvent);
    };

    expect(handlers.size).toBe(5);
    await invoke("backup:all-documents");
    await invoke("backup:all-categories");
    expect(backupAllDocuments).toHaveBeenCalledWith(documents);
    expect(backupAllCategories).toHaveBeenCalledWith([], relations);
    expect(dataSource.listDocuments).toHaveBeenCalledOnce();
    expect(dataSource.listDocumentCategories).toHaveBeenCalledOnce();
  });
});
