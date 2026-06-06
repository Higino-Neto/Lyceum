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
  getWatchFolders,
  addWatchFolder,
  removeWatchFolder,
  getSourceFolders,
  addSourceFolder,
  removeSourceFolder,
  deleteDocumentsUnderPath,
  getWatchFolderBooks,
  getUnsyncedBookCount,
  getDocumentsByBookId,
  type DocumentRecord,
  type WatchFolderRecord,
} from "../local-database";
import {
  scanLibrary,
  resyncLibrary,
  processFile,
  getFolderStructure,
  getAllFoldersFlat,
  getBooksInFolder,
  getLibraryRoots,
  resolveManagedFolderPath,
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
  inferBookFileTypeFromPath,
  inferFileTypeFromPath,
  toReadableFileType,
} from "../services/file-service";
import { generateThumbnail, type BookFileType } from "../services/document-processing";
import { openReadableFile } from "../services/document-service";
import fs from "node:fs";
import path from "node:path";

let win: BrowserWindow | null = null;
let refreshFileWatchers: (() => void) | null = null;

export function setWindow(w: BrowserWindow | null) {
  win = w;
}

export function setFileWatcherRefresh(callback: (() => void) | null) {
  refreshFileWatchers = callback;
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
          fileType: inferBookFileTypeFromPath(targetPath) as BookFileType,
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

  ipcMain.handle("library:get-folder-structure", (_, rootPath?: string | null) => {
    if (!rootPath) return getFolderStructure(LIBRARY_PATH());
    const root = getLibraryRoots().find((candidate) => path.resolve(candidate.path) === path.resolve(rootPath));
    if (!root) return [];
    return getFolderStructure(root.path, root.type === "source");
  });

  ipcMain.handle("library:get-library-roots", () => {
    return getLibraryRoots();
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
      const target = resolveManagedFolderPath(targetFolderPath);
      const targetDir = target.targetDir;
      if (path.resolve(currentDir) === path.resolve(targetDir)) return { success: true };
      if (!fs.existsSync(targetDir)) return { success: false, error: "Pasta de destino não existe" };

      const newFilePath = getUniqueFilePath(targetDir, fileName);
      moveFileAcrossDevices(doc.filePath, newFilePath);
      updateDocumentPath(fileHash, newFilePath);
      updateDocumentSyncStatus(fileHash, true, target.category);

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

  ipcMain.handle("library:move-merged-book", async (_, bookId: string, targetFolderPath: string | null) => {
    const docs = getDocumentsByBookId(bookId).filter((doc) => doc.filePath);
    if (docs.length === 0) return { success: false, error: "Livro mesclado nÃ£o encontrado" };

    const moved: { fileHash: string; from: string; to: string }[] = [];

    try {
      const target = resolveManagedFolderPath(targetFolderPath);
      if (!fs.existsSync(target.targetDir)) return { success: false, error: "Pasta de destino nÃ£o existe" };

      for (const doc of docs) {
        const currentPath = doc.filePath;
        const currentDir = path.dirname(currentPath);
        if (path.resolve(currentDir) === path.resolve(target.targetDir)) continue;

        const newFilePath = getUniqueFilePath(target.targetDir, path.basename(currentPath));
        moveFileAcrossDevices(currentPath, newFilePath);
        moved.push({ fileHash: doc.fileHash, from: currentPath, to: newFilePath });
      }

      for (const item of moved) {
        updateDocumentPath(item.fileHash, item.to);
        updateDocumentSyncStatus(item.fileHash, true, target.category);
      }

      win?.webContents.send("library:updated");
      return { success: true, moved: moved.length };
    } catch (error: unknown) {
      for (const item of [...moved].reverse()) {
        try {
          if (fs.existsSync(item.to) && !fs.existsSync(item.from)) {
            moveFileAcrossDevices(item.to, item.from);
          }
        } catch (rollbackError) {
          console.error("[LibraryHandler] Error rolling back merged move:", rollbackError);
        }
      }

      const err = error as Error & { code?: string };
      let errorMessage = "Erro ao mover livro mesclado";
      if (err.code === "EBUSY") errorMessage = "Arquivo estÃ¡ sendo usado";
      else if (err.code === "EPERM") errorMessage = "PermissÃ£o negada";
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

  ipcMain.handle("library:get-watch-folders", () => {
    return getWatchFolders();
  });

  ipcMain.handle("library:add-watch-folder", (_, folderPath: string, label?: string) => {
    const record = addWatchFolder(folderPath, label);
    win?.webContents.send("library:updated");
    return record;
  });

  ipcMain.handle("library:remove-watch-folder", (_, id: number) => {
    removeWatchFolder(id);
    win?.webContents.send("library:updated");
    return { success: true };
  });

  ipcMain.handle("library:add-source-folder", async (_, folderPath: string, label?: string) => {
    const resolvedPath = path.resolve(folderPath);
    if (!fs.existsSync(resolvedPath)) {
      return { success: false, error: "Pasta nÃ£o encontrada" };
    }

    const record = addSourceFolder(resolvedPath, label);
    const files = getAllBookFiles(resolvedPath);
    for (const filePath of files) {
      await processFile(filePath, { rootPath: resolvedPath, isSynced: true });
    }

    refreshFileWatchers?.();
    win?.webContents.send("library:updated");
    return { success: true, folder: record };
  });

  ipcMain.handle("library:remove-source-folder", (_, id: number) => {
    const record = removeSourceFolder(id);
    if (!record) return { success: false, error: "Pasta fonte nÃ£o encontrada", removedDocuments: 0 };

    const removedDocuments = deleteDocumentsUnderPath(record.path);
    refreshFileWatchers?.();
    win?.webContents.send("library:updated");
    return { success: true, removedDocuments };
  });

  ipcMain.handle("library:resync-source-folder", async (_, id: number) => {
    const folder = getSourceFolders().find((candidate) => candidate.id === id);
    if (!folder) return { success: false, error: "Pasta fonte nÃ£o encontrada" };
    if (!fs.existsSync(folder.path)) return { success: false, error: "Pasta fonte indisponÃ­vel" };

    const files = getAllBookFiles(folder.path);
    for (const filePath of files) {
      await processFile(filePath, { rootPath: folder.path, isSynced: true });
    }
    win?.webContents.send("library:updated");
    return { success: true, scanned: files.length };
  });

  ipcMain.handle("library:get-watch-folder-books", (_, folderPath: string) => {
    return getWatchFolderBooks(folderPath);
  });

  ipcMain.handle("library:get-watch-folder-book-count", (_, folderPath: string) => {
    return getUnsyncedBookCount(folderPath);
  });
}
