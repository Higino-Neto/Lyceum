import { ipcRenderer, contextBridge } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  getFilePath: () => {
    return new Promise((resolve) => {
      ipcRenderer.once("file-opened", (_, filePath) => resolve(filePath));
      ipcRenderer.send("open-file-dialog");
    });
  },
});

interface DocumentData {
  title: string;
  filePath: string;
  fileHash: string;
}

interface ReadingState {
  fileHash: string;
  state: {
    currentPage: number;
    currentZoom: number;
    currentScroll: number;
    annotations: string;
  };
}

interface NativePdfViewerState {
  page: number;
  currentScale: number;
  scrollTop: number;
  totalPages: number;
  canAccess: boolean;
}

interface MetadataUpdate {
  author?: string;
  description?: string;
  isbn?: string;
  publisher?: string;
  publishDate?: string;
}

interface BookCategory {
  id: number;
  name: string;
  color: string;
  bookCount: number;
  createdAt: string;
}

contextBridge.exposeInMainWorld("api", {
  addDocument: (data: DocumentData) => ipcRenderer.invoke("add-document", data),

  getDocuments: () => ipcRenderer.invoke("get-documents"),

  saveReadingState: (payload: ReadingState) =>
    ipcRenderer.invoke("reading:save", payload),

  getReadingState: (fileHash: string) =>
    ipcRenderer.invoke("reading:get", fileHash),

  getNativePdfViewerState: (sourceUrl: string) =>
    ipcRenderer.invoke("native-pdf-viewer:get-state", sourceUrl),

  applyNativePdfViewerState: (
    sourceUrl: string,
    state: Omit<NativePdfViewerState, "totalPages" | "canAccess">,
  ) => ipcRenderer.invoke("native-pdf-viewer:apply-state", sourceUrl, state),

  openPdf: () => ipcRenderer.invoke("dialog:open-pdf"),

  getTempPdfFile: (fileBuffer: ArrayBuffer, fileHash: string) =>
    ipcRenderer.invoke("temp:get-pdf-file", fileBuffer, fileHash),

  importPdf: (targetFolder: string | null, action?: "move" | "copy") =>
    ipcRenderer.invoke("dialog:import-pdf", targetFolder, action),

  openImageDialog: () => ipcRenderer.invoke("dialog:open-image"),

  getLastDocument: () => ipcRenderer.invoke("app:get-last-document"),

  reopenPdf: (filePath: string, fileHash?: string) => ipcRenderer.invoke("pdf:reopen", filePath, fileHash),

  getThumbnail: (thumbnailPath: string) =>
    ipcRenderer.invoke("thumbnail:get", thumbnailPath),

  getLibraryPath: () => ipcRenderer.invoke("library:get-path"),

  scanLibrary: () => ipcRenderer.invoke("library:scan"),

  resyncLibrary: () => ipcRenderer.invoke("library:resync"),

  moveToLibrary: (filePath: string) =>
    ipcRenderer.invoke("library:move", filePath),

  openFileDialog: () => ipcRenderer.invoke("dialog:open-file"),

  getDocumentsBySyncStatus: (synced: boolean) =>
    ipcRenderer.invoke("library:get-sync-status", synced),

  getCategories: () => ipcRenderer.invoke("library:get-categories"),

  syncDocument: (fileHash: string, action: "move" | "copy", category?: string) =>
    ipcRenderer.invoke("library:sync-document", fileHash, action, category),

  searchLocalBooks: (query: string) => ipcRenderer.invoke("library:search-local", query),

  windowMinimize: () => ipcRenderer.invoke("window:minimize"),

  windowMaximize: () => ipcRenderer.invoke("window:maximize"),

  windowClose: () => ipcRenderer.invoke("window:close"),

  windowIsMaximized: () => ipcRenderer.invoke("window:isMaximized"),

  toggleFavorite: (fileHash: string) =>
    ipcRenderer.invoke("book:toggle-favorite", fileHash),

  updateRating: (fileHash: string, rating: number) =>
    ipcRenderer.invoke("book:update-rating", fileHash, rating),

  updateNotes: (fileHash: string, notes: string) =>
    ipcRenderer.invoke("book:update-notes", fileHash, notes),

  updateMetadata: (fileHash: string, metadata: MetadataUpdate) => 
    ipcRenderer.invoke("book:update-metadata", fileHash, metadata),

  updateTitle: (fileHash: string, newTitle: string) =>
    ipcRenderer.invoke("book:update-title", fileHash, newTitle),

  renameBook: (fileHash: string, newTitle: string, newAuthor: string) =>
    ipcRenderer.invoke("book:rename", fileHash, newTitle, newAuthor),

  deleteBook: (fileHash: string, deleteFile?: boolean) =>
    ipcRenderer.invoke("book:delete", fileHash, deleteFile),

  getBookById: (id: number) =>
    ipcRenderer.invoke("book:get-by-id", id),

  getFavorites: () =>
    ipcRenderer.invoke("book:get-favorites"),

  processPendingBooks: () =>
    ipcRenderer.invoke("book:process-pending"),

  regenerateThumbnail: (fileHash: string) =>
    ipcRenderer.invoke("book:regenerate-thumbnail", fileHash),

  setThumbnail: (fileHash: string, imagePath: string, mode: "replace" | "prepend") =>
    ipcRenderer.invoke("pdf:set-thumbnail", fileHash, imagePath, mode),

  updateBookId: (fileHash: string, bookId: string) =>
    ipcRenderer.invoke("book:update-book-id", fileHash, bookId),

  getDocumentsByBookId: (bookId: string) =>
    ipcRenderer.invoke("book:get-by-book-id", bookId),

  getDocumentByTitle: (title: string) =>
    ipcRenderer.invoke("book:get-by-title", title),

  openLibraryFolder: () =>
    ipcRenderer.invoke("library:open-folder"),

  showBookInFolder: (filePath: string) =>
    ipcRenderer.invoke("book:show-in-folder", filePath),

  onLibraryUpdated: (callback: () => void) => {
    ipcRenderer.on("library:updated", callback);
    return () => ipcRenderer.removeListener("library:updated", callback);
  },

  categoryCreate: (name: string, color?: string) =>
    ipcRenderer.invoke("category:create", name, color),

  categoryUpdate: (id: number, name: string, color: string) =>
    ipcRenderer.invoke("category:update", id, name, color),

  categoryDelete: (id: number) =>
    ipcRenderer.invoke("category:delete", id),

  categoryGetAll: () =>
    ipcRenderer.invoke("category:get-all"),

  categoryGetById: (id: number) =>
    ipcRenderer.invoke("category:get-by-id", id),

  categoryGetForDocument: (documentId: number) =>
    ipcRenderer.invoke("category:get-for-document", documentId),

  categoryGetForDocumentByHash: (fileHash: string) =>
    ipcRenderer.invoke("category:get-for-document-by-hash", fileHash),

  categorySetForDocument: (documentId: number, categoryIds: number[]) =>
    ipcRenderer.invoke("category:set-for-document", documentId, categoryIds),

  categoryAddToDocument: (documentId: number, categoryId: number) =>
    ipcRenderer.invoke("category:add-to-document", documentId, categoryId),

  categoryRemoveFromDocument: (documentId: number, categoryId: number) =>
    ipcRenderer.invoke("category:remove-from-document", documentId, categoryId),

  categoryGetColors: () =>
    ipcRenderer.invoke("category:get-colors"),

  categoryImportFromFolders: () =>
    ipcRenderer.invoke("category:import-from-folders"),

  getFolderStructure: () =>
    ipcRenderer.invoke("library:get-folder-structure"),

  getAllFolders: () =>
    ipcRenderer.invoke("library:get-all-folders"),

  getBooksInFolder: (folderPath: string | null) =>
    ipcRenderer.invoke("library:get-books-in-folder", folderPath),

   createFolder: (folderName: string, parentPath: string | null = null) =>
     ipcRenderer.invoke("library:create-folder", folderName, parentPath),

  renameFolder: (oldPath: string, newName: string) =>
    ipcRenderer.invoke("library:rename-folder", oldPath, newName),

  deleteFolder: (folderPath: string, force = false) =>
    ipcRenderer.invoke("library:delete-folder", folderPath, force),

  moveFolder: (sourcePath: string, targetPath: string | null) =>
    ipcRenderer.invoke("library:move-folder", sourcePath, targetPath),

  moveBook: (fileHash: string, targetFolderPath: string | null) =>
    ipcRenderer.invoke("library:move-book", fileHash, targetFolderPath),

  backupInit: (supabaseUrl: string, supabaseAnonKey: string) =>
    ipcRenderer.invoke("backup:init", supabaseUrl, supabaseAnonKey),

  backupSetSession: (accessToken: string, refreshToken: string) =>
    ipcRenderer.invoke("backup:set-session", accessToken, refreshToken),

  backupClearSession: () =>
    ipcRenderer.invoke("backup:clear-session"),

  backupAllDocuments: () =>
    ipcRenderer.invoke("backup:all-documents"),

  habitsGetAll: () => ipcRenderer.invoke("habits:get-all"),

  habitsGetById: (id: string) => ipcRenderer.invoke("habits:get-by-id", id),

  habitsAdd: (habit: { id: string; name: string; unit: string | null; valueMode: string }) =>
    ipcRenderer.invoke("habits:add", habit),

  habitsUpdate: (id: string, updates: { name?: string; unit?: string | null; valueMode?: string }) =>
    ipcRenderer.invoke("habits:update", id, updates),

  habitsDelete: (id: string) => ipcRenderer.invoke("habits:delete", id),

  habitsGetCompletions: (habitId: string) => ipcRenderer.invoke("habits:get-completions", habitId),

  habitsGetAllCompletions: () => ipcRenderer.invoke("habits:get-all-completions"),

  habitsSetCompletion: (habitId: string, dateKey: string, value: string | null) =>
    ipcRenderer.invoke("habits:set-completion", habitId, dateKey, value),

  habitsDeleteCompletion: (habitId: string, dateKey: string) =>
    ipcRenderer.invoke("habits:delete-completion", habitId, dateKey),

  backupAllHabits: () =>
    ipcRenderer.invoke("backup:all-habits"),

  backupAllCategories: () =>
    ipcRenderer.invoke("backup:all-categories"),
});
