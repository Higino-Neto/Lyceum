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
import type { OutputPreviewRequest, OutputPreviewResult } from "./services/output-preview-types";
import type { ExerciseAnalysis, PdfToolThumbnail, ToolFileKind, ToolPickedFile, ToolRunRequest } from "./services/pdf-tools-types";
import type { KindleEmailPublicConfig, KindleEmailSaveInput } from "./services/kindle-email-types";
import type { KindleSendErrorCode, KindleSendStage } from "../src/features/kindle/kindleSendPlan";

type KindleSendProgressPayload = { fileHash: string; progress: number; stage: KindleSendStage; detail?: string };
import type { BookCategory } from "../src/core/library/category";
import type { LanguageSummary, LibrarySummary } from "../src/types/StatsTypes";
import type {
  FormKnowledgeRecord,
  KnowledgeRecord,
  KnowledgeSnapshot,
  KnowledgeState,
  LearningAnnotation,
  LearningReadingState,
  LinguisticDocument,
  ReviewItem,
  ReviewLogEntry,
  KnowledgeBucket,
  KnowledgeMergeResult,
  LearningImportResult,
  LearningBackup,
} from "../src/core/language-learning/model";

const { ipcRenderer, contextBridge, webUtils } = electron;

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
      printPageCount?: number | null;
    }>;
    convertToAzw3?: boolean;
    preserveMetadata?: boolean;
    organizeByAuthor?: boolean;
    destination?: string;
    pageNumbers?: "auto" | "off" | "target-count" | "estimate";
    charsPerPage?: number;
    conversionOptions?: LyceumConversionOptions;
  }) => ipcRenderer.invoke("kindle:send-books", options),

  /** Sends one book (conversion queue): progress arrives on onConversionProgress(jobId). */
  sendBookToKindle: (input: {
    jobId?: string;
    deviceId?: string;
    book: { fileHash: string; filePath: string; title: string; author?: string | null; fileType?: BookFormat | null; [key: string]: unknown };
    convertToAzw3?: boolean;
    preserveMetadata?: boolean;
    organizeByAuthor?: boolean;
    destination?: string;
    pageNumbers?: "auto" | "off" | "target-count" | "estimate";
    conversionOptions?: LyceumConversionOptions;
  }) => ipcRenderer.invoke("kindle:send-book", input),

  /** Stops the running USB or e-mail batch after the current step. */
  cancelKindleSend: () => invoke<boolean>("kindle:cancel-send"),

  /** Amazon's "Content & Devices" page (approved senders, @kindle.com address). */
  openKindlePersonalDocuments: () => invoke<boolean>("kindle:open-amazon-settings"),

  onKindleSendProgress: (callback: (payload: KindleSendProgressPayload) => void) => {
    const listener = (_: Electron.IpcRendererEvent, payload: KindleSendProgressPayload) => callback(payload);
    ipcRenderer.on("kindle:send-progress", listener);
    return () => { ipcRenderer.removeListener("kindle:send-progress", listener); };
  },

  getKindleEmailConfig: () =>
    invoke<KindleEmailPublicConfig>("kindle-email:get-config"),

  saveKindleEmailConfig: (input: KindleEmailSaveInput) =>
    invoke<{ success: boolean; config?: KindleEmailPublicConfig; error?: string; errorCode?: KindleSendErrorCode }>("kindle-email:save-config", input),

  connectKindleEmailGoogle: () =>
    invoke<{ success: boolean; config?: KindleEmailPublicConfig; error?: string }>("kindle-email:connect-google"),

  cancelKindleEmailGoogle: () =>
    invoke<boolean>("kindle-email:cancel-google"),

  disconnectKindleEmailGoogle: () =>
    invoke<KindleEmailPublicConfig>("kindle-email:disconnect-google"),

  verifyKindleEmail: () =>
    invoke<{ success: boolean; error?: string; errorCode?: KindleSendErrorCode; errorParams?: Record<string, string | number> }>("kindle-email:verify"),

  sendBooksToKindleEmail: (options: {
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
    preserveMetadata?: boolean;
    convertPdfToEpub?: boolean;
    compressImages?: boolean;
  }) =>
    invoke<{
      success: boolean;
      sent: number;
      failed: number;
      results: Array<{
        fileHash: string;
        title: string;
        success: boolean;
        status: "sent" | "converted" | "skipped" | "error";
        outputName?: string;
        bytes?: number;
        verified?: boolean;
        note?: string;
        error?: string;
        errorCode?: KindleSendErrorCode;
        errorParams?: Record<string, string | number>;
        outputFormat?: string;
      }>;
    }>("kindle-email:send-books", options),

  /** Absolute path of a File dropped from the OS file manager (File.path is gone in modern Electron). */
  getPathForFile: (file: File) => webUtils.getPathForFile(file),

  pickToolFiles: (kind: ToolFileKind) =>
    invoke<ToolPickedFile[]>("tools:pick-files", kind),

  describeToolFiles: (filePaths: string[]) =>
    invoke<ToolPickedFile[]>("tools:describe-files", filePaths),

  pickToolSavePath: (format: "pdf" | "cbz", suggestedName?: string, nearPath?: string) =>
    invoke<string | null>("tools:pick-save-path", format, suggestedName, nearPath),

  getToolImageThumbnail: (imagePath: string) =>
    invoke<{ success: boolean; dataUrl?: string; width?: number; height?: number; error?: string }>("tools:image-thumbnail", imagePath),

  getToolPdfInfo: (filePath: string) =>
    invoke<{ success: boolean; pageCount?: number; title?: string; fileSize?: number; error?: string }>("tools:pdf-info", filePath),

  getToolPdfThumbnails: (filePath: string, pages: number[]) =>
    invoke<{ success: boolean; thumbnails: PdfToolThumbnail[]; error?: string }>("tools:pdf-thumbnails", filePath, pages),

  analyzeToolPdfExercises: (filePath: string, jobId?: string) =>
    invoke<{ success: boolean; analysis?: ExerciseAnalysis; error?: string }>("tools:analyze-exercises", filePath, jobId),

  runTool: (request: ToolRunRequest, jobId?: string) =>
    invoke<{ success: boolean; outputPath?: string; fileSize?: number; pageCount?: number; error?: string }>("tools:run", request, jobId),

  showToolOutputInFolder: (filePath: string) =>
    invoke<boolean>("tools:show-in-folder", filePath),

  onToolProgress: (callback: (data: { jobId: string; progress: number; message?: string }) => void) => {
    const listener = (_: Electron.IpcRendererEvent, data: { jobId: string; progress: number; message?: string }) => callback(data);
    ipcRenderer.on("tools:progress", listener);
    return () => { ipcRenderer.removeListener("tools:progress", listener); };
  },

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

  previewConversionOutput: (fileHash: string, request: OutputPreviewRequest) =>
    invoke<{ success: boolean; preview?: OutputPreviewResult; error?: string }>("conversion:output-preview", fileHash, request),

  previewConversionOutputFile: (filePath: string, request: OutputPreviewRequest) =>
    invoke<{ success: boolean; preview?: OutputPreviewResult; error?: string }>("conversion:output-preview-file", filePath, request),

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

  renameFolder: (oldPath: string, newName: string) =>
    ipcRenderer.invoke("library:rename-folder", oldPath, newName),

  deleteFolder: (folderPath: string, force = false) =>
    ipcRenderer.invoke("library:delete-folder", folderPath, force),

  moveFolder: (sourcePath: string, targetPath: string | null) =>
    ipcRenderer.invoke("library:move-folder", sourcePath, targetPath),

  moveBook: (fileHash: string, targetFolderPath: string | null) =>
    ipcRenderer.invoke("library:move-book", fileHash, targetFolderPath),

  copyBooks: (fileHashes: string[], targetFolderPath: string | null) =>
    ipcRenderer.invoke("library:copy-books", fileHashes, targetFolderPath),

  getWatchFolders: () =>
    ipcRenderer.invoke("library:get-watch-folders"),

  addWatchFolder: (folderPath: string, label?: string) =>
    ipcRenderer.invoke("library:add-watch-folder", folderPath, label),

  removeWatchFolder: (id: number) =>
    ipcRenderer.invoke("library:remove-watch-folder", id),

  addSourceFolder: (folderPath: string, label?: string) =>
    ipcRenderer.invoke("library:add-source-folder", folderPath, label),

  deleteFolders: (folderPaths: string[]) =>
    ipcRenderer.invoke("library:delete-folders", folderPaths) as Promise<{
      success: boolean;
      error?: string;
      deleted: number;
      failed: number;
      errors: string[];
    }>,

  suggestSourceFolders: () =>
    ipcRenderer.invoke("library:suggest-source-folders") as Promise<
      | {
          success: true;
          suggestions: Array<{ path: string; bookCount: number; ebookCount: number; pdfCount: number; recommended: boolean }>;
          scannedDirectories: number;
          truncated: boolean;
        }
      | { success: false; error: string }
    >,

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
    fileType: "pdf" | "epub" | "lyceum";
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

  languageLearningOpen: (input: { filePath: string; fileHash: string; language?: string; force?: boolean }) =>
    invoke<
      | { success: true; document: LinguisticDocument; packageRoot: string; language: string; metadataLanguage: string | null; detectedLanguage?: string | null; reused: boolean }
      | { success: false; error: string }
    >("language-learning:open", input),

  onLanguageLearningProgress: (callback: (data: { fileHash: string; progress: number; stage: string }) => void) => {
    const listener = (_: Electron.IpcRendererEvent, data: { fileHash: string; progress: number; stage: string }) => callback(data);
    ipcRenderer.on("language-learning:progress", listener);
    return () => { ipcRenderer.removeListener("language-learning:progress", listener); };
  },

  languageLearningTranslateOnline: (text: string, source: string, target: string) =>
    invoke<{ success: true; translation: string } | { success: false; error: string }>("language-learning:translate-online", text, source, target),

  languageLearningLoadKnowledge: (userId: string, language: string) =>
    invoke<KnowledgeSnapshot>("language-learning:load-knowledge", userId, language),

  languageLearningSetLemmaState: (userId: string, record: { language: string; key: string; state: KnowledgeState; label: string; translation?: string | null; note?: string | null }) =>
    invoke<KnowledgeRecord>("language-learning:set-lemma-state", userId, record),

  languageLearningSetLemmaStates: (userId: string, records: Array<{ language: string; key: string; state: KnowledgeState; label: string }>) =>
    invoke<number>("language-learning:set-lemma-states", userId, records),

  languageLearningKnowledgeBuckets: (userIds: string[]) =>
    invoke<KnowledgeBucket[]>("language-learning:knowledge-buckets", userIds),

  languageLearningMergeKnowledge: (userId: string, fromUserId: string, fromLanguage: string, toLanguage: string) =>
    invoke<KnowledgeMergeResult>("language-learning:merge-knowledge", userId, fromUserId, fromLanguage, toLanguage),

  languageLearningExportBackup: (userId: string) =>
    invoke<{ success: true; path: string } | { success: false; error: string }>("language-learning:export-backup", userId),

  deviceSyncReadBook: (fileHash: string) =>
    invoke<{ success: true; fileName: string; bytes: Uint8Array } | { success: false; error: string }>("device-sync:read-book", fileHash),

  deviceSyncSaveBook: (fileName: string, bytes: Uint8Array) =>
    invoke<{ success: true; duplicate: boolean; fileName?: string; title?: string } | { success: false; error: string }>("device-sync:save-book", fileName, bytes),

  languageLearningExportData: (userId: string) =>
    invoke<LearningBackup>("language-learning:export-data", userId),

  languageLearningImportData: (userId: string, backup: LearningBackup) =>
    invoke<LearningImportResult>("language-learning:import-data", userId, backup),

  languageLearningImportBackup: (userId: string) =>
    invoke<({ success: true } & LearningImportResult) | { success: false; error: string }>("language-learning:import-backup", userId),

  reportRendererError: (input: { message: string; stack?: string | null; componentStack?: string | null; source?: string | null; route?: string | null }) =>
    ipcRenderer.invoke("diagnostics:report-renderer-error", input),
  openLogs: () => ipcRenderer.invoke("diagnostics:open-logs") as Promise<{ success: boolean; error?: string }>,
  languageLearningBackupStatus: (userId: string) =>
    ipcRenderer.invoke("language-learning:backup-status", userId),
  languageLearningChooseBackupMirror: (userId: string) =>
    ipcRenderer.invoke("language-learning:choose-backup-mirror", userId),
  languageLearningClearBackupMirror: (userId: string) =>
    ipcRenderer.invoke("language-learning:clear-backup-mirror", userId),

  languageLearningOpenBackupsFolder: (userId: string) =>
    invoke<{ success: boolean; error?: string }>("language-learning:open-backups-folder", userId),

  statsLibrarySummary: () => invoke<LibrarySummary>("stats:library-summary"),
  statsLanguageSummary: (userId: string) => invoke<LanguageSummary>("stats:language-summary", userId),

  languageLearningSetFormState: (userId: string, record: { language: string; key: string; form: string; state: KnowledgeState }) =>
    invoke<FormKnowledgeRecord>("language-learning:set-form-state", userId, record),

  languageLearningClearFormState: (userId: string, language: string, key: string, form: string) =>
    invoke<void>("language-learning:clear-form-state", userId, language, key, form),

  languageLearningRecordLookup: (userId: string, language: string, key: string, label: string) =>
    invoke<void>("language-learning:record-lookup", userId, language, key, label),

  languageLearningSetTranslation: (userId: string, language: string, key: string, label: string, translation: string | null) =>
    invoke<void>("language-learning:set-translation", userId, language, key, label, translation),

  languageLearningListReviewItems: (userId: string, language?: string) =>
    invoke<ReviewItem[]>("language-learning:list-review-items", userId, language),

  languageLearningUpsertReviewItem: (userId: string, item: ReviewItem) =>
    invoke<void>("language-learning:upsert-review-item", userId, item),

  languageLearningUpsertReviewItems: (userId: string, items: ReviewItem[]) =>
    invoke<number>("language-learning:upsert-review-items", userId, items),

  languageLearningDeleteReviewItem: (userId: string, id: string) =>
    invoke<void>("language-learning:delete-review-item", userId, id),

  languageLearningLogReview: (userId: string, entry: ReviewLogEntry) =>
    invoke<void>("language-learning:log-review", userId, entry),

  languageLearningListReviewLog: (userId: string, itemId?: string) =>
    invoke<ReviewLogEntry[]>("language-learning:list-review-log", userId, itemId),

  languageLearningListAnnotations: (userId: string, documentId?: string) =>
    invoke<LearningAnnotation[]>("language-learning:list-annotations", userId, documentId),

  languageLearningSaveAnnotation: (userId: string, annotation: LearningAnnotation) =>
    invoke<void>("language-learning:save-annotation", userId, annotation),

  languageLearningDeleteAnnotation: (userId: string, id: string) =>
    invoke<void>("language-learning:delete-annotation", userId, id),

  languageLearningGetReadingState: (userId: string, documentId: string) =>
    invoke<LearningReadingState | null>("language-learning:get-reading-state", userId, documentId),

  languageLearningSaveReadingState: (userId: string, state: LearningReadingState) =>
    invoke<void>("language-learning:save-reading-state", userId, state),

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
