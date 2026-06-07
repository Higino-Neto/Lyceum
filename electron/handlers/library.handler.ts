import { ipcMain, BrowserWindow, shell } from "electron";
import {
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
  type WatchFolderRecord,
} from "../local-database";
import {
  scanLibrary,
  resyncLibrary,
  processFile,
  queueThumbnailGeneration,
  queueAllThumbnailRegeneration,
  setLibraryChangeEmitter,
  setNotificationEmitter,
  getFolderStructureAsync,
  getAllFoldersFlatAsync,
  getBooksInFolder,
  getLibraryRoots,
  getFolderStructureCached,
  getFolderChildren,
  getFolderStats,
  folderExists,
  notifyFolderChanged,
  refreshLibraryPathWatcher,
  setFolderChangeEmitter,
  stopLibraryPathWatcher,
  watchLibraryPath,
} from "../services/library-service";
import {
  LIBRARY_PATH,
  USER_DATA_PATH,
  THUMBNAILS_DIR,
  resolveLibraryRelativePath,
  getUniqueFilePath,
  moveFileAcrossDevices,
  inferBookFileTypeFromPath,
  inferFileTypeFromPath,
  toReadableFileType,
} from "../services/file-service";
import { generateThumbnail, type BookFileType } from "../services/document-processing";
import { openReadableFile } from "../services/document-service";
import {
  addManagedSourceFolder,
  addManagedWatchFolder,
  createManagedFolder,
  deleteManagedFolder,
  getManagedWatchFolderBookCount,
  listManagedWatchFolderBooks,
  listManagedWatchFolders,
  moveManagedBook,
  moveManagedFolder,
  moveMergedManagedBook,
  renameManagedFolder,
  removeManagedSourceFolder,
  removeManagedWatchFolder,
  resyncManagedSourceFolder,
} from "../services/folder-service";
import fs from "node:fs";
import path from "node:path";

let win: BrowserWindow | null = null;
let refreshFileWatchers: (() => void) | null = null;

export function setWindow(w: BrowserWindow | null) {
  win = w;
  setLibraryChangeEmitter(w ? () => w.webContents.send("library:updated") : null);
  setNotificationEmitter(w ? (n) => w.webContents.send("library:notification", n) : null);
  setFolderChangeEmitter(w ? (payload) => w.webContents.send("folder:changed", payload) : null);
  if (w) {
    watchLibraryPath();
  } else {
    stopLibraryPathWatcher();
  }
}

export function setFileWatcherRefresh(callback: (() => void) | null) {
  refreshFileWatchers = callback;
}

function emitLibraryUpdated(result: { success?: boolean }) {
  if (result.success) {
    notifyFolderChanged();
    win?.webContents.send("library:updated");
  }
}

export function registerLibraryHandlers() {
  ipcMain.handle("library:get-path", () => {
    return LIBRARY_PATH();
  });

  ipcMain.handle("library:scan", async () => {
    return scanLibrary();
  });

  ipcMain.handle("thumbnail:ensure-many", async (_, requests) => {
    return queueThumbnailGeneration(Array.isArray(requests) ? requests.slice(0, 96) : []);
  });

  ipcMain.handle("thumbnail:regenerate-all", async () => {
    return queueAllThumbnailRegeneration();
  });

  ipcMain.handle("library:resync", async () => {
    const result = await resyncLibrary();
    notifyFolderChanged();
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

  ipcMain.handle("library:get-folder-structure", async (_, rootPath?: string | null) => {
    if (!rootPath) return getFolderStructureAsync(LIBRARY_PATH());
    const root = getLibraryRoots().find((candidate) => path.resolve(candidate.path) === path.resolve(rootPath));
    if (!root) return [];
    return getFolderStructureAsync(root.path, root.type === "source");
  });

  ipcMain.handle("library:get-folder-structure-cached", (_, rootPath?: string | null) => {
    if (!rootPath) return getFolderStructureCached(LIBRARY_PATH());
    const root = getLibraryRoots().find((candidate) => path.resolve(candidate.path) === path.resolve(rootPath));
    if (!root) return [];
    return getFolderStructureCached(root.path, root.type === "source");
  });

  ipcMain.handle("library:get-folder-children", (_, parentPath: string | null = null) => {
    return getFolderChildren(parentPath);
  });

  ipcMain.handle("library:get-folder-stats", (_, folderPath: string | null = null) => {
    return getFolderStats(folderPath);
  });

  ipcMain.handle("library:folder-exists", (_, folderPath: string | null = null) => {
    return folderExists(folderPath);
  });

  ipcMain.handle("library:get-library-roots", () => {
    return getLibraryRoots();
  });

  ipcMain.handle("library:get-all-folders", () => {
    return getAllFoldersFlatAsync(LIBRARY_PATH());
  });

  ipcMain.handle("library:get-books-in-folder", (_, folderPath: string | null) => {
    return getBooksInFolder(folderPath);
  });

  ipcMain.handle("library:create-folder", async (_, folderName: string, parentPath: string | null = null) => {
    const result = createManagedFolder(folderName, parentPath);
    emitLibraryUpdated(result);
    return result;
  });

  ipcMain.handle("library:rename-folder", async (_, oldPath: string, newName: string) => {
    const result = renameManagedFolder(oldPath, newName);
    emitLibraryUpdated(result);
    return result;
  });

  ipcMain.handle("library:delete-folder", async (_, folderPath: string, force = false) => {
    const result = deleteManagedFolder(folderPath, force);
    emitLibraryUpdated(result);
    return result;
  });

  ipcMain.handle("library:move-folder", async (_, sourcePath: string, targetPath: string | null) => {
    const result = moveManagedFolder(sourcePath, targetPath);
    emitLibraryUpdated(result);
    return result;
  });

  ipcMain.handle("library:move-book", async (_, fileHash: string, targetFolderPath: string | null) => {
    const result = moveManagedBook(fileHash, targetFolderPath);
    emitLibraryUpdated(result);
    return result;
  });

  ipcMain.handle("library:move-merged-book", async (_, bookId: string, targetFolderPath: string | null) => {
    const result = moveMergedManagedBook(bookId, targetFolderPath);
    emitLibraryUpdated(result);
    return result;
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
    return listManagedWatchFolders();
  });

  ipcMain.handle("library:add-watch-folder", (_, folderPath: string, label?: string) => {
    const record = addManagedWatchFolder(folderPath, label);
    notifyFolderChanged();
    win?.webContents.send("library:updated");
    return record;
  });

  ipcMain.handle("library:remove-watch-folder", (_, id: number) => {
    const result = removeManagedWatchFolder(id);
    emitLibraryUpdated(result);
    return result;
  });

  ipcMain.handle("library:add-source-folder", async (_, folderPath: string, label?: string) => {
    const result = await addManagedSourceFolder(folderPath, label);
    if (result.success) {
      refreshFileWatchers?.();
      refreshLibraryPathWatcher();
    }
    emitLibraryUpdated(result);
    return result;
  });

  ipcMain.handle("library:remove-source-folder", (_, id: number) => {
    const result = removeManagedSourceFolder(id);
    if (result.success) {
      refreshFileWatchers?.();
      refreshLibraryPathWatcher();
    }
    emitLibraryUpdated(result);
    return result;
  });

  ipcMain.handle("library:resync-source-folder", async (_, id: number) => {
    const result = await resyncManagedSourceFolder(id);
    emitLibraryUpdated(result);
    return result;
  });

  ipcMain.handle("library:get-watch-folder-books", (_, folderPath: string) => {
    return listManagedWatchFolderBooks(folderPath);
  });

  ipcMain.handle("library:get-watch-folder-book-count", (_, folderPath: string) => {
    return getManagedWatchFolderBookCount(folderPath);
  });
}
