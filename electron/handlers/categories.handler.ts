import type { IpcMain } from "electron";
import type { CategoryRepository } from "../../src/core/library/category";
import {
  nonEmptyString,
  positiveInteger,
  positiveIntegerArray,
} from "../ipc/validation";

export function registerCategoryHandlers(
  ipcMain: IpcMain,
  repository: CategoryRepository,
) {
  ipcMain.handle("category:create", (_, name: string, color?: string) =>
    repository.create(nonEmptyString(name, "name", 160), color));
  ipcMain.handle("category:update", (_, id: number, name: string, color: string) =>
    repository.update(
      positiveInteger(id, "id"),
      nonEmptyString(name, "name", 160),
      nonEmptyString(color, "color", 32),
    ));
  ipcMain.handle("category:delete", (_, id: number) =>
    repository.remove(positiveInteger(id, "id")));
  ipcMain.handle("category:get-all", () => repository.list());
  ipcMain.handle("category:get-by-id", (_, id: number) =>
    repository.find(positiveInteger(id, "id")));
  ipcMain.handle("category:get-for-document", (_, documentId: number) =>
    repository.listForDocument(positiveInteger(documentId, "documentId")));
  ipcMain.handle("category:get-for-document-by-hash", (_, fileHash: string) =>
    repository.listForDocumentHash(nonEmptyString(fileHash, "fileHash", 128)));
  ipcMain.handle("category:set-for-document", (_, documentId: number, categoryIds: number[]) =>
    repository.setForDocument(
      positiveInteger(documentId, "documentId"),
      positiveIntegerArray(categoryIds, "categoryIds"),
    ));
  ipcMain.handle("category:add-to-document", (_, documentId: number, categoryId: number) =>
    repository.addToDocument(
      positiveInteger(documentId, "documentId"),
      positiveInteger(categoryId, "categoryId"),
    ));
  ipcMain.handle("category:remove-from-document", (_, documentId: number, categoryId: number) =>
    repository.removeFromDocument(
      positiveInteger(documentId, "documentId"),
      positiveInteger(categoryId, "categoryId"),
    ));
  ipcMain.handle("category:get-colors", () => repository.listColors());
  ipcMain.handle("category:import-from-folders", () => ({
    imported: repository.importFromFolders(),
  }));
}
