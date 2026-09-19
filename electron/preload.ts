import electron from "electron";
import type {
  BookFormat,
  DocumentRecord,
  FolderChangedPayload,
  LibraryListQuery,
  LibrarySortOption,
  ReadingStatus,
} from "../src/types/LibraryTypes";
import type {
  CreateKeyConceptInput,
  UpdateKeyConceptInput,
} from "../src/types/AnnotationTypes";
import type { LyceumConversionOptions } from "../src/lib/lyceum/schema/types";
import type { BookCategory } from "../src/core/library/category";
import type {
  Habit,
  HabitCompletion,
  HabitUpdate,
  NewHabit,
} from "../src/core/habits/model";

const { ipcRenderer, contextBridge } = electron;

function invoke<Result>(channel: string, ...args: unknown[]): Promise<Result> {
  return ipcRenderer.invoke(channel, ...args);
}

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
  title?: string;
  author?: string;
  description?: string;
  isbn?: string;
  publisher?: string;
  publishDate?: string;
  language?: string;
  identifier?: string;
  asin?: string;
  subject?: string;
  series?: string;
  seriesIndex?: string;
  authorSort?: string;
  titleSort?: string;
  pageCount?: number;
}

type MetadataSearchSource = "openlibrary" | "google" | "loc" | "all";
type MetadataSearchField = "title" | "author" | "isbn";

const api = {
  openExternalFile: (filePath: string) => ipcRenderer.invoke("file:open-external", filePath),

  onFileOpened: (callback: (data: DocumentRecord & { fileType: "pdf" | "epub"; fileBuffer?: ArrayBuffer }) => void) => {
    const listener = (_: Electron.IpcRendererEvent, data: DocumentRecord & { fileType: "pdf" | "epub"; fileBuffer?: ArrayBuffer }) => callback(data);
    ipcRenderer.on("file-opened", listener);
    return () => { ipcRenderer.removeListener("file-opened", listener); };
  },

  onReadingShortcut: (callback: (data: { key: string; shift?: boolean }) => void) => {
    const listener = (
      _: Electron.IpcRendererEvent,
      data: { key: string; shift?: boolean },
    ) => callback(data);
    ipcRenderer.on("reading-shortcut", listener);
    return () => { ipcRenderer.removeListener("reading-shortcut", listener); };
  },

  zoomIn: () => ipcRenderer.invoke("zoom:in"),
  zoomOut: () => ipcRenderer.invoke("zoom:out"),
  zoomReset: () => ipcRenderer.invoke("zoom:reset"),
  getZoomFactor: () => ipcRenderer.invoke("zoom:get-factor"),
  setZoomFactor: (factor: number) => ipcRenderer.invoke("zoom:set-factor", factor),
  onZoomFactorChanged: (callback: (factor: number) => void) => {
    const listener = (_: Electron.IpcRendererEvent, factor: number) => callback(factor);
    ipcRenderer.on("zoom-factor-changed", listener);
    return () => { ipcRenderer.removeListener("zoom-factor-changed", listener); };
  },

  updatesGetStatus: () => ipcRenderer.invoke("updates:get-status"),
  updatesCheck: () => ipcRenderer.invoke("updates:check"),
  updatesDownload: () => ipcRenderer.invoke("updates:download"),
  updatesInstallNow: () => ipcRenderer.invoke("updates:install-now"),
  onUpdatesStatusChanged: (callback: (state: unknown) => void) => {
    const listener = (_: Electron.IpcRendererEvent, state: unknown) => callback(state);
    ipcRenderer.on("updates:status-changed", listener);
    return () => { ipcRenderer.removeListener("updates:status-changed", listener); };
  },

  openDefaultAppsSettings: () => ipcRenderer.invoke("settings:open-default-apps"),
  consumeAuthDeepLinkParams: () => ipcRenderer.invoke("auth:consume-deep-link-params"),
  onAuthDeepLink: (
    callback: (payload: { route: string; params: Record<string, string> }) => void,
  ) => {
    const listener = (
      _: Electron.IpcRendererEvent,
      payload: { route: string; params: Record<string, string> },
    ) => callback(payload);
    ipcRenderer.on("auth:deep-link", listener);
    return () => { ipcRenderer.removeListener("auth:deep-link", listener); };
  },

  addDocument: (data: DocumentData) => ipcRenderer.invoke("add-document", data),

  getDocuments: () => ipcRenderer.invoke("get-documents"),

  listBooks: (query: LibraryListQuery) => ipcRenderer.invoke("library:list-books", query),

  getFolderBookCounts: () =>
    ipcRenderer.invoke("library:get-folder-book-counts"),

  getUsbDevices: () => ipcRenderer.invoke("usb:get-devices"),

  listUsbBooks: (query: {
    search?: string;
    fileType?: string;
    sort?: LibrarySortOption;
    limit?: number;
    offset?: number;
  }) => ipcRenderer.invoke("usb:list-books", query),

  scanUsbBooks: () => ipcRenderer.invoke("usb:scan-books"),

  openUsbBook: (filePath: string) => ipcRenderer.invoke("usb:open-book", filePath),

  listKindleDevices: () => ipcRenderer.invoke("kindle:list-devices"),

  sendBooksToKindle: (options: {
    deviceId?: string;
    books: Array<{
      fileHash: string;
      filePath: string;
      title: string;
      author?: string | null;
      fileType?: BookFormat | null;
      fileName?: string | null;
      publisher?: string | null;
      description?: string | null;
      publishDate?: string | null;
      language?: string | null;
      identifier?: string | null;
      asin?: string | null;
      subject?: string | null;
      series?: string | null;
      seriesIndex?: string | null;
      authorSort?: string | null;
      titleSort?: string | null;
    }>;
    convertToAzw3?: boolean;
    preserveMetadata?: boolean;
    organizeByAuthor?: boolean;
    destination?: string;
  }) => ipcRenderer.invoke("kindle:send-books", options),

  saveReadingState: (payload: ReadingState) =>
    ipcRenderer.invoke("reading:save", payload),

  getReadingState: (fileHash: string) =>
    ipcRenderer.invoke("reading:get", fileHash),

  openPdf: () => ipcRenderer.invoke("dialog:open-pdf"),

  openEpub: () => ipcRenderer.invoke("dialog:open-epub"),

  openReadableFile: () => ipcRenderer.invoke("dialog:open-readable-file"),

  getTempPdfFile: (fileBuffer: ArrayBuffer, fileHash: string) =>
    ipcRenderer.invoke("temp:get-pdf-file", fileBuffer, fileHash),

  convertPdfToEpub: (fileHash: string) =>
    ipcRenderer.invoke("pdf:convert-to-epub", fileHash),

  convertEpubToPdf: (fileHash: string) =>
    ipcRenderer.invoke("epub:convert-to-pdf", fileHash),

  listConversionTargets: (fileHash: string) =>
    ipcRenderer.invoke("conversion:list-targets", fileHash),

  convertBook: (fileHash: string, targetFormat: BookFormat, requestOptions?: { jobId?: string; conversionOptions?: LyceumConversionOptions; outputDirectory?: string }) =>
    ipcRenderer.invoke("conversion:run", fileHash, targetFormat, requestOptions),

  convertBookFile: (filePath: string, targetFormat: BookFormat, requestOptions?: { jobId?: string; conversionOptions?: LyceumConversionOptions; outputDirectory?: string }) =>
    ipcRenderer.invoke("conversion:run-file", filePath, targetFormat, requestOptions),

  cancelConversion: (jobId: string) =>
    ipcRenderer.invoke("conversion:cancel", jobId),

  deleteConvertedOutput: (outputPath: string, outputHash: string) =>
    ipcRenderer.invoke("conversion:delete-output", outputPath, outputHash),

  onConversionProgress: (callback: (payload: { jobId: string; progress: number; message?: string }) => void) => {
    const listener = (_: Electron.IpcRendererEvent, payload: { jobId: string; progress: number; message?: string }) => callback(payload);
    ipcRenderer.on("conversion:progress", listener);
    return () => { ipcRenderer.removeListener("conversion:progress", listener); };
  },

  importPdf: (targetFolder: string | null, action?: "move" | "copy") =>
    ipcRenderer.invoke("dialog:import-pdf", targetFolder, action),

  openImageDialog: () => ipcRenderer.invoke("dialog:open-image"),
  readImageDataUrl: (filePath: string) => ipcRenderer.invoke("read-image-data-url", filePath),
  selectFolder: () => ipcRenderer.invoke("dialog:select-folder"),

  getLastDocument: () => ipcRenderer.invoke("app:get-last-document"),

  reopenPdf: (filePath?: string, fileHash?: string, metadataOnly = false) =>
    ipcRenderer.invoke("pdf:reopen", filePath, fileHash, metadataOnly),
  openDocumentByHash: (fileHash: string, filePath?: string, metadataOnly = false) =>
    ipcRenderer.invoke("pdf:reopen", filePath, fileHash, metadataOnly),

  getThumbnail: (thumbnailPath: string) =>
    ipcRenderer.invoke("thumbnail:get", thumbnailPath),
  getThumbnails: (thumbnailPaths: string[]) =>
    ipcRenderer.invoke("thumbnail:get-many", thumbnailPaths),
  ensureThumbnails: (books: Array<{ fileHash: string; filePath: string; fileType?: BookFormat | null }>) =>
    ipcRenderer.invoke("thumbnail:ensure-many", books),
  regenerateAllThumbnails: () =>
    ipcRenderer.invoke("thumbnail:regenerate-all"),

  getLibraryPath: () => ipcRenderer.invoke("library:get-path"),

  scanLibrary: () => ipcRenderer.invoke("library:scan"),

  resyncLibrary: () => ipcRenderer.invoke("library:resync"),

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

  updateReadingStatus: (fileHash: string, status: ReadingStatus) =>
    ipcRenderer.invoke("book:update-reading-status", fileHash, status),

  getConceptGraph: (bookId: string) =>
    ipcRenderer.invoke("annotations:get-graph", bookId),
  getPageKeyConcepts: (bookId: string, page: number) =>
    ipcRenderer.invoke("annotations:get-page-concepts", bookId, page),
  getAnnotatedPages: (bookId: string) =>
    ipcRenderer.invoke("annotations:get-annotated-pages", bookId),
  createKeyConcept: (input: CreateKeyConceptInput) =>
    ipcRenderer.invoke("annotations:create-concept", input),
  updateKeyConcept: (id: string, updates: UpdateKeyConceptInput) =>
    ipcRenderer.invoke("annotations:update-concept", id, updates),
  deleteKeyConcept: (id: string, bookId: string) =>
    ipcRenderer.invoke("annotations:delete-concept", id, bookId),
  createConceptRelation: (bookId: string, conceptAId: string, conceptBId: string) =>
    ipcRenderer.invoke("annotations:create-relation", bookId, conceptAId, conceptBId),
  deleteConceptRelation: (bookId: string, conceptAId: string, conceptBId: string) =>
    ipcRenderer.invoke("annotations:delete-relation", bookId, conceptAId, conceptBId),
  getAnnotationPageThumbnail: (bookId: string, page: number) =>
    ipcRenderer.invoke("annotations:get-page-thumbnail", bookId, page),

  getReadingStatusItems: () =>
    ipcRenderer.invoke("atlas:get-status-items"),

  addLibraryBookToReadingStatus: (status: ReadingStatus, fileHash: string) =>
    ipcRenderer.invoke("atlas:add-status-library-book", status, fileHash),

  addManualBookToReadingStatus: (data: { title: string; author?: string | null; status: ReadingStatus }) =>
    ipcRenderer.invoke("atlas:add-status-manual-book", data),

  updateReadingStatusItemStatus: (itemId: string, status: ReadingStatus) =>
    ipcRenderer.invoke("atlas:update-status-item-status", itemId, status),

  positionReadingStatusItem: (itemId: string, status: ReadingStatus, targetIndex: number) =>
    ipcRenderer.invoke("atlas:position-status-item", itemId, status, targetIndex),

  updateReadingStatusItemProgress: (itemId: string, updates: { manualBasePage?: number; manualCurrentPage?: number; manualTotalPages?: number | null }) =>
    ipcRenderer.invoke("atlas:update-status-item-progress", itemId, updates),

  addReadingStatusProgressEvent: (itemId: string, pages: number, note?: string | null) =>
    ipcRenderer.invoke("atlas:add-status-progress-event", itemId, pages, note ?? null),

  deleteReadingStatusItem: (itemId: string) =>
    ipcRenderer.invoke("atlas:delete-status-item", itemId),

  setPrimaryReadingStatusItem: (itemId: string) =>
    ipcRenderer.invoke("atlas:set-primary-status-item", itemId),

  updateReadingStatusItemCover: (itemId: string, coverPath: string | null) =>
    ipcRenderer.invoke("atlas:update-status-item-cover", itemId, coverPath),

  updateReadingStatusItemMetadata: (itemId: string, updates: Partial<{
    title: string;
    author: string | null;
    description: string | null;
    isbn: string | null;
    publisher: string | null;
    publishDate: string | null;
    subject: string | null;
    manualTotalPages: number | null;
    coverPath: string | null;
    rating: number;
  }>) =>
    ipcRenderer.invoke("atlas:update-status-item-metadata", itemId, updates),

  searchBookMetadata: (source: MetadataSearchSource, query: string, field: MetadataSearchField, limit?: number) =>
    ipcRenderer.invoke("book:search-metadata", source, query, field, limit),

  updateMetadata: (fileHash: string, metadata: MetadataUpdate) => 
    ipcRenderer.invoke("book:update-metadata", fileHash, metadata),

  updateTitle: (fileHash: string, newTitle: string) =>
    ipcRenderer.invoke("book:update-title", fileHash, newTitle),

  renameBook: (fileHash: string, newTitle: string, newAuthor: string) =>
    ipcRenderer.invoke("book:rename", fileHash, newTitle, newAuthor),

  startBookFileDrag: (fileHashes: string[], dragImageDataUrl?: string) =>
    ipcRenderer.invoke("book:start-native-drag", fileHashes, dragImageDataUrl),

  copyBookFiles: (fileHashes: string[]) =>
    ipcRenderer.invoke("book:copy-files", fileHashes),

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

  setThumbnailFromUrl: (fileHash: string, imageUrl: string, mode: "replace" | "prepend") =>
    ipcRenderer.invoke("book:set-thumbnail-from-url", fileHash, imageUrl, mode),

  updateBookId: (fileHash: string, bookId: string) =>
    ipcRenderer.invoke("book:update-book-id", fileHash, bookId),

  removeBookFromGroup: (fileHash: string) =>
    ipcRenderer.invoke("book:remove-from-group", fileHash),

  getDocumentsByBookId: (bookId: string) =>
    ipcRenderer.invoke("book:get-by-book-id", bookId),

  mergeBooks: (fileHashes: string[]) =>
    ipcRenderer.invoke("book:merge", fileHashes),

  unmergeBooks: (bookId: string) =>
    ipcRenderer.invoke("book:unmerge", bookId),

  mergeBooksIntoFolder: (fileHashes: string[], parentPath?: string | null) =>
    ipcRenderer.invoke("book:merge-into-folder", fileHashes, parentPath ?? null),

  getDocumentByTitle: (title: string) =>
    ipcRenderer.invoke("book:get-by-title", title),

  openLibraryFolder: () =>
    ipcRenderer.invoke("library:open-folder"),

  showBookInFolder: (filePath: string) =>
    ipcRenderer.invoke("book:show-in-folder", filePath),

  onLibraryUpdated: (callback: () => void) => {
    ipcRenderer.on("library:updated", callback);
    return () => { ipcRenderer.removeListener("library:updated", callback); };
  },

  onLibraryNotification: (callback: (notification: { type: "success" | "error" | "warning"; message: string }) => void) => {
    const listener = (_: Electron.IpcRendererEvent, notification: { type: "success" | "error" | "warning"; message: string }) => callback(notification);
    ipcRenderer.on("library:notification", listener);
    return () => { ipcRenderer.removeListener("library:notification", listener); };
  },

  onUsbDevicesUpdated: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on("usb:devices-updated", listener);
    return () => { ipcRenderer.removeListener("usb:devices-updated", listener); };
  },

  categoryCreate: (name: string, color?: string) =>
    invoke<BookCategory | null>("category:create", name, color),

  categoryUpdate: (id: number, name: string, color: string) =>
    invoke<boolean>("category:update", id, name, color),

  categoryDelete: (id: number) =>
    invoke<boolean>("category:delete", id),

  categoryGetAll: () =>
    invoke<BookCategory[]>("category:get-all"),

  categoryGetById: (id: number) =>
    invoke<BookCategory | null>("category:get-by-id", id),

  categoryGetForDocument: (documentId: number) =>
    invoke<BookCategory[]>("category:get-for-document", documentId),

  categoryGetForDocumentByHash: (fileHash: string) =>
    invoke<BookCategory[]>("category:get-for-document-by-hash", fileHash),

  categorySetForDocument: (documentId: number, categoryIds: number[]) =>
    invoke<boolean>("category:set-for-document", documentId, categoryIds),

  categoryAddToDocument: (documentId: number, categoryId: number) =>
    invoke<boolean>("category:add-to-document", documentId, categoryId),

  categoryRemoveFromDocument: (documentId: number, categoryId: number) =>
    invoke<boolean>("category:remove-from-document", documentId, categoryId),

  categoryGetColors: () =>
    invoke<string[]>("category:get-colors"),

  categoryImportFromFolders: () =>
    invoke<{ imported: number }>("category:import-from-folders"),

  getFolderStructure: (rootPath?: string | null) =>
    ipcRenderer.invoke("library:get-folder-structure", rootPath),

  getFolderStructureCached: (rootPath?: string | null) =>
    ipcRenderer.invoke("library:get-folder-structure-cached", rootPath),

  getFolderChildren: (parentPath?: string | null) =>
    ipcRenderer.invoke("library:get-folder-children", parentPath ?? null),

  getFolderStats: (folderPath?: string | null) =>
    ipcRenderer.invoke("library:get-folder-stats", folderPath ?? null),

  folderExists: (folderPath?: string | null) =>
    ipcRenderer.invoke("library:folder-exists", folderPath ?? null),

  onFolderChanged: (callback: (payload: FolderChangedPayload) => void) => {
    const listener = (_: Electron.IpcRendererEvent, payload: FolderChangedPayload) => callback(payload);
    ipcRenderer.on("folder:changed", listener);
    return () => { ipcRenderer.removeListener("folder:changed", listener); };
  },

  getLibraryRoots: () =>
    ipcRenderer.invoke("library:get-library-roots"),

  getAllFolders: () =>
    ipcRenderer.invoke("library:get-all-folders"),

  getBooksInFolder: (folderPath: string | null) =>
    ipcRenderer.invoke("library:get-books-in-folder", folderPath),

   createFolder: (folderName: string, parentPath: string | null = null) =>
     ipcRenderer.invoke("library:create-folder", folderName, parentPath),

  createCollection: (name: string, fileHashes: string[], parentPath?: string | null) =>
    ipcRenderer.invoke("library:create-collection", name, fileHashes, parentPath ?? null),

  renameFolder: (oldPath: string, newName: string) =>
    ipcRenderer.invoke("library:rename-folder", oldPath, newName),

  deleteFolder: (folderPath: string, force = false) =>
    ipcRenderer.invoke("library:delete-folder", folderPath, force),

  dissolveFolder: (folderPath: string) =>
    ipcRenderer.invoke("library:dissolve-folder", folderPath),

  moveFolder: (sourcePath: string, targetPath: string | null) =>
    ipcRenderer.invoke("library:move-folder", sourcePath, targetPath),

  moveBook: (fileHash: string, targetFolderPath: string | null) =>
    ipcRenderer.invoke("library:move-book", fileHash, targetFolderPath),

  copyBooks: (fileHashes: string[], targetFolderPath: string | null) =>
    ipcRenderer.invoke("library:copy-books", fileHashes, targetFolderPath),

  moveMergedBook: (bookId: string, targetFolderPath: string | null) =>
    ipcRenderer.invoke("library:move-merged-book", bookId, targetFolderPath),

  getWatchFolders: () =>
    ipcRenderer.invoke("library:get-watch-folders"),

  addWatchFolder: (folderPath: string, label?: string) =>
    ipcRenderer.invoke("library:add-watch-folder", folderPath, label),

  removeWatchFolder: (id: number) =>
    ipcRenderer.invoke("library:remove-watch-folder", id),

  addSourceFolder: (folderPath: string, label?: string) =>
    ipcRenderer.invoke("library:add-source-folder", folderPath, label),

  removeSourceFolder: (id: number) =>
    ipcRenderer.invoke("library:remove-source-folder", id),

  resyncSourceFolder: (id: number) =>
    ipcRenderer.invoke("library:resync-source-folder", id),

  getWatchFolderBooks: (folderPath: string) =>
    ipcRenderer.invoke("library:get-watch-folder-books", folderPath),

  getWatchFolderBookCount: (folderPath: string) =>
    ipcRenderer.invoke("library:get-watch-folder-book-count", folderPath),

  backupInit: (supabaseUrl: string, supabaseAnonKey: string) =>
    ipcRenderer.invoke("backup:init", supabaseUrl, supabaseAnonKey),

  backupSetSession: (accessToken: string, refreshToken: string) =>
    ipcRenderer.invoke("backup:set-session", accessToken, refreshToken),

  backupClearSession: () =>
    ipcRenderer.invoke("backup:clear-session"),

  backupAllDocuments: () =>
    ipcRenderer.invoke("backup:all-documents"),

  habitsGetAll: () => invoke<Habit[]>("habits:get-all"),

  habitsGetById: (id: string) => invoke<Habit | undefined>("habits:get-by-id", id),

  habitsAdd: (habit: NewHabit) =>
    invoke<{ success: true }>("habits:add", habit),

  habitsUpdate: (id: string, updates: HabitUpdate) =>
    invoke<{ success: true }>("habits:update", id, updates),

  habitsDelete: (id: string) => invoke<{ success: true }>("habits:delete", id),

  habitsGetCompletions: (habitId: string) =>
    invoke<HabitCompletion[]>("habits:get-completions", habitId),

  habitsGetAllCompletions: () =>
    invoke<HabitCompletion[]>("habits:get-all-completions"),

  habitsSetCompletion: (habitId: string, dateKey: string, value: string | null) =>
    invoke<{ success: true }>("habits:set-completion", habitId, dateKey, value),

  habitsDeleteCompletion: (habitId: string, dateKey: string) =>
    invoke<{ success: true }>("habits:delete-completion", habitId, dateKey),

  backupAllHabits: () =>
    ipcRenderer.invoke("backup:all-habits"),

backupAllCategories: () =>
    ipcRenderer.invoke("backup:all-categories"),

  extractVocabulary: (fileHash: string) =>
    ipcRenderer.invoke("book:extract-vocabulary", fileHash),

  getVocabularyStats: (fileHash: string) =>
    ipcRenderer.invoke("book:get-vocabulary-stats", fileHash),

  getWordCount: (fileHash: string, word: string) =>
    ipcRenderer.invoke("book:get-word-count", fileHash, word),

  deleteVocabulary: (fileHash: string) =>
    ipcRenderer.invoke("book:delete-vocabulary", fileHash),

openInNewWindow: (data: {
    fileHash: string;
    fileName: string;
    fileType: "pdf" | "epub";
    filePath?: string;
    libraryDocumentId?: string;
    pdfRenderer?: "pdfjs";
    source?: "library" | "local";
  }) =>
    ipcRenderer.invoke("window:open-new", data),

  dictionaryGetIndex: () => ipcRenderer.invoke("dictionary:get-index"),

  dictionaryFetchIndex: () => ipcRenderer.invoke("dictionary:fetch-index"),

  dictionaryDownload: (dictId: string) => ipcRenderer.invoke("dictionary:download", dictId),

  dictionaryDelete: (dictId: string) => ipcRenderer.invoke("dictionary:delete", dictId),

  dictionaryLookup: (word: string, dictId?: string) =>
    ipcRenderer.invoke("dictionary:lookup", word, dictId),

  dictionaryGetInfo: (dictId: string) => ipcRenderer.invoke("dictionary:get-info", dictId),

  onDictionaryDownloadProgress: (callback: (data: { dictId: string; progress: number }) => void) => {
    const listener = (_: Electron.IpcRendererEvent, data: { dictId: string; progress: number }) => callback(data);
    ipcRenderer.on("dictionary:download-progress", listener);
    return () => { ipcRenderer.removeListener("dictionary:download-progress", listener); };
  },
};

/**
 * The renderer contract is derived from the actual bridge implementation.
 * Keep this as the single source of truth instead of maintaining a parallel
 * handwritten Window.api declaration.
 */
export type LyceumApi = typeof api;

contextBridge.exposeInMainWorld("api", api);
