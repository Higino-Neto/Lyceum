import { ipcMain, BrowserWindow, shell } from "electron";
import {
  getAllDocuments,
  listDocuments,
  getDocumentsBySyncStatus,
  getDocumentByHash,
  getCategories,
  getCategoryColors,
  importCategoriesFromFolders,
  updateDocumentPath,
  updateDocumentSyncStatus,
  updateThumbnailPath,
  updateDocumentFileType,
  updateLastOpened,
  deleteDocument,
  searchDocuments,
  type DocumentRecord,
} from "../local-database";
import {
  scanLibrary,
  resyncLibrary,
  processFile,
  getFolderStructure,
  getAllFoldersFlat,
  getBooksInFolder,
} from "../services/library-service";
import {
  LIBRARY_PATH,
  USER_DATA_PATH,
  THUMBNAILS_DIR,
  assertPathWithin,
  resolveLibraryRelativePath,
  sanitizeFolderName,
  getUniqueFilePath,
  getUniqueDirPath,
  moveFileAcrossDevices,
  isPathWithin,
  getAllBookFiles,
  inferFileTypeFromPath,
  toReadableFileType,
} from "../services/file-service";
import { generateThumbnail } from "../services/document-processing";
import { openReadableFile } from "../services/document-service";
import fs from "node:fs";
import path from "node:path";

let win: BrowserWindow | null = null;

export function setWindow(w: BrowserWindow | null) {
  win = w;
}

export function registerLibraryHandlers() {
  ipcMain.handle("library:get-path", () => {
    return LIBRARY_PATH();
  });

  ipcMain.handle("library:scan", async () => {
    await scanLibrary();
  });

  ipcMain.handle("library:resync", async () => {
    const result = await resyncLibrary();
    win?.webContents.send("library:updated");
    return result;
  });

  ipcMain.handle("library:get-sync-status", (_, synced: boolean) => {
    return getDocumentsBySyncStatus(synced);
  });

  ipcMain.handle("library:get-categories", () => {
    return getCategories();
  });

  ipcMain.handle("library:search-local", (_, query: string) => {
    return searchDocuments(query);
  });

  ipcMain.handle("library:list-books", (_, query) => {
    return listDocuments(query);
  });

  ipcMain.handle("library:open-folder", () => {
    const libraryPath = LIBRARY_PATH();
    shell.openPath(libraryPath);
    return libraryPath;
  });

  ipcMain.handle("library:sync-document", async (_, fileHash: string, action: "move" | "copy", category?: string) => {
    const doc = getDocumentByHash(fileHash);
    if (!doc) return { success: false, error: "Document not found" };

    try {
      const targetDir = resolveLibraryRelativePath(category);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const fileName = path.basename(doc.filePath);
      const targetPath = getUniqueFilePath(targetDir, fileName);

      if (action === "move") {
        moveFileAcrossDevices(doc.filePath, targetPath);
      } else {
        fs.copyFileSync(doc.filePath, targetPath);
      }

      if (doc.thumbnailPath && fs.existsSync(doc.thumbnailPath)) {
        const thumbFileName = path.basename(doc.thumbnailPath);
        const targetThumbPath = path.join(USER_DATA_PATH(), "thumbnails", thumbFileName);
        if (action === "move") {
          moveFileAcrossDevices(doc.thumbnailPath, targetThumbPath);
        } else {
          fs.copyFileSync(doc.thumbnailPath, targetThumbPath);
        }
        updateDocumentPath(fileHash, targetPath);
        updateDocumentSyncStatus(fileHash, true, category);
      } else {
        updateDocumentPath(fileHash, targetPath);
        updateDocumentSyncStatus(fileHash, true, category);
        const newThumbnail = await generateThumbnail(targetPath, fileHash, {
          thumbnailsDir: THUMBNAILS_DIR(), force: false,
          fileType: inferFileTypeFromPath(targetPath),
          logPrefix: "[LibraryHandler]",
        });
        if (newThumbnail) updateThumbnailPath(fileHash, newThumbnail);
      }

      win?.webContents.send("library:updated");
      return { success: true, newPath: targetPath };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle("library:get-folder-structure", () => {
    return getFolderStructure(LIBRARY_PATH());
  });

  ipcMain.handle("library:get-all-folders", () => {
    return getAllFoldersFlat(LIBRARY_PATH());
  });

  ipcMain.handle("library:get-books-in-folder", (_, folderPath: string | null) => {
    return getBooksInFolder(folderPath);
  });

  ipcMain.handle("library:create-folder", async (_, folderName: string, parentPath: string | null = null) => {
    try {
      const basePath = resolveLibraryRelativePath(parentPath);
      const safeFolderName = sanitizeFolderName(folderName);
      const newFolderPath = assertPathWithin(
        LIBRARY_PATH(),
        path.join(basePath, safeFolderName),
        "Caminho inválido",
      );
      if (fs.existsSync(newFolderPath)) return { success: false, error: "Pasta já existe" };
      fs.mkdirSync(newFolderPath, { recursive: true });
      win?.webContents.send("library:updated");
      return { success: true };
    } catch (error: unknown) {
      const err = error as Error & { code?: string };
      let errorMessage = "Erro ao criar pasta";
      if (err.code === "EACCES") errorMessage = "Permissão negada";
      return { success: false, error: errorMessage };
    }
  });

  ipcMain.handle("library:rename-folder", async (_, oldPath: string, newName: string) => {
    try {
      const safeOldPath = assertPathWithin(LIBRARY_PATH(), oldPath, "Caminho inválido");
      const parentPathDir = path.dirname(safeOldPath);
      const safeFolderName = sanitizeFolderName(newName);
      const newPath = assertPathWithin(LIBRARY_PATH(), path.join(parentPathDir, safeFolderName), "Caminho inválido");

      if (fs.existsSync(newPath)) return { success: false, error: "Já existe uma pasta com este nome" };

      const allDocs = getAllDocuments();
      const docsInFolder = allDocs.filter(d => d.filePath && d.filePath.startsWith(safeOldPath));
      fs.renameSync(safeOldPath, newPath);

      for (const doc of docsInFolder) {
        if (doc.filePath) {
          const newFilePath = doc.filePath.replace(safeOldPath, newPath);
          updateDocumentPath(doc.fileHash, newFilePath);
        }
      }

      win?.webContents.send("library:updated");
      return { success: true };
    } catch (error: unknown) {
      const err = error as Error & { code?: string };
      let errorMessage = "Erro ao renomear pasta";
      if (err.code === "EBUSY" || err.code === "ENOTEMPTY") errorMessage = "Pasta está sendo usada";
      else if (err.code === "EPERM") errorMessage = "Permissão negada";
      return { success: false, error: errorMessage };
    }
  });

  ipcMain.handle("library:delete-folder", async (_, folderPath: string, force = false) => {
    try {
      const safeFolderPath = assertPathWithin(LIBRARY_PATH(), folderPath, "Caminho inválido");
      if (safeFolderPath === LIBRARY_PATH()) return { success: false, error: "A pasta raiz não pode ser excluída" };
      if (!fs.existsSync(safeFolderPath)) return { success: false, error: "Pasta não existe" };

      if (!force) {
        const items = fs.readdirSync(safeFolderPath, { withFileTypes: true });
        const nonEmpty = items.filter(item => !item.name.startsWith("."));
        if (nonEmpty.length > 0) return { success: false, error: "Pasta não está vazia" };
      }

      fs.rmSync(safeFolderPath, { recursive: true, force: true });
      win?.webContents.send("library:updated");
      return { success: true };
    } catch (error: unknown) {
      const err = error as Error & { code?: string };
      let errorMessage = "Erro ao excluir pasta";
      if (err.code === "EBUSY" || err.code === "ENOTEMPTY") errorMessage = "Pasta está sendo usada";
      else if (err.code === "EPERM") errorMessage = "Permissão negada";
      return { success: false, error: errorMessage };
    }
  });

  ipcMain.handle("library:move-folder", async (_, sourcePath: string, targetPath: string | null) => {
    try {
      const libraryPath = LIBRARY_PATH();
      const safeSourcePath = assertPathWithin(libraryPath, sourcePath, "Caminho inválido");
      if (!fs.existsSync(safeSourcePath)) return { success: false, error: "Pasta não existe" };

      const targetDir = resolveLibraryRelativePath(targetPath);
      const folderName = path.basename(safeSourcePath);
      let destinationPath = path.join(targetDir, folderName);
      if (fs.existsSync(destinationPath)) destinationPath = getUniqueDirPath(targetDir, folderName);
      if (safeSourcePath === destinationPath) return { success: true };
      if (isPathWithin(safeSourcePath, destinationPath)) return { success: false, error: "Não pode mover uma pasta para dentro de si mesma" };

      const allDocs = getAllDocuments();
      const docsInFolder = allDocs.filter(d => d.filePath && d.filePath.startsWith(safeSourcePath));
      fs.renameSync(safeSourcePath, destinationPath);

      for (const doc of docsInFolder) {
        if (doc.filePath) {
          const newFilePath = doc.filePath.replace(safeSourcePath, destinationPath);
          updateDocumentPath(doc.fileHash, newFilePath);
        }
      }

      win?.webContents.send("library:updated");
      return { success: true };
    } catch (error: unknown) {
      const err = error as Error & { code?: string };
      let errorMessage = "Erro ao mover pasta";
      if (err.code === "EBUSY" || err.code === "ENOTEMPTY") errorMessage = "Pasta está sendo usada";
      else if (err.code === "EPERM") errorMessage = "Permissão negada";
      return { success: false, error: errorMessage };
    }
  });

  ipcMain.handle("library:move-book", async (_, fileHash: string, targetFolderPath: string | null) => {
    try {
      const doc = getDocumentByHash(fileHash);
      if (!doc || !doc.filePath) return { success: false, error: "Livro não encontrado" };

      const currentDir = path.dirname(doc.filePath);
      const fileName = path.basename(doc.filePath);
      const targetDir = resolveLibraryRelativePath(targetFolderPath);
      if (currentDir === targetDir) return { success: true };
      if (!fs.existsSync(targetDir)) return { success: false, error: "Pasta de destino não existe" };

      const newFilePath = getUniqueFilePath(targetDir, fileName);
      moveFileAcrossDevices(doc.filePath, newFilePath);
      updateDocumentPath(fileHash, newFilePath);
      updateDocumentSyncStatus(fileHash, true, targetFolderPath || undefined);

      win?.webContents.send("library:updated");
      return { success: true };
    } catch (error: unknown) {
      const err = error as Error & { code?: string };
      let errorMessage = "Erro ao mover livro";
      if (err.code === "EBUSY") errorMessage = "Arquivo está sendo usado";
      else if (err.code === "EPERM") errorMessage = "Permissão negada";
      return { success: false, error: errorMessage };
    }
  });

  ipcMain.handle("file:open-external", async (_, filePath: string) => {
    try {
      if (!filePath.toLowerCase().endsWith(".epub") && !filePath.toLowerCase().endsWith(".pdf")) {
        return { success: false, error: "Invalid file type" };
      }
      const document = await openReadableFile(filePath);
      if (!document) return { success: false, error: "Failed to add document" };
      return { success: true, ...document };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });
}
