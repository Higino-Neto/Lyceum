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

  openPdf: () => ipcRenderer.invoke("dialog:open-pdf"),

  getLastDocument: () => ipcRenderer.invoke("app:get-last-document"),

  reopenPdf: (filePath: string) => ipcRenderer.invoke("pdf:reopen", filePath),

  getThumbnail: (thumbnailPath: string) =>
    ipcRenderer.invoke("thumbnail:get", thumbnailPath),

  getLibraryPath: () => ipcRenderer.invoke("library:get-path"),

  scanLibrary: () => ipcRenderer.invoke("library:scan"),

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

  deleteBook: (fileHash: string) =>
    ipcRenderer.invoke("book:delete", fileHash),

  getBookById: (id: number) =>
    ipcRenderer.invoke("book:get-by-id", id),

  getFavorites: () =>
    ipcRenderer.invoke("book:get-favorites"),

  processPendingBooks: () =>
    ipcRenderer.invoke("book:process-pending"),

  regenerateThumbnail: (fileHash: string) =>
    ipcRenderer.invoke("book:regenerate-thumbnail", fileHash),

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
});

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld("ipcRenderer", {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args;
    return ipcRenderer.on(channel, (event, ...args) =>
      listener(event, ...args),
    );
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args;
    return ipcRenderer.off(channel, ...omit);
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args;
    return ipcRenderer.send(channel, ...omit);
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args;
    return ipcRenderer.invoke(channel, ...omit);
  },

  // You can expose other APTs you need here.
  // ...
});
