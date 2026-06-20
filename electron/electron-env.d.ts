/// <reference types="vite-plugin-electron/electron-env" />

type DocumentRecord = import("../src/types/LibraryTypes").DocumentRecord;
type LibraryListQuery = import("../src/types/LibraryTypes").LibraryListQuery;
type LibraryListResult = import("../src/types/LibraryTypes").LibraryListResult;
type ReadingStatus = import("../src/types/LibraryTypes").ReadingStatus;
type ReadingMapPayload = import("../src/types/LibraryTypes").ReadingMapPayload;
type ReadingStatusPayload = import("../src/types/LibraryTypes").ReadingStatusPayload;
type ReadingStatusNotePayload = import("../src/types/LibraryTypes").ReadingStatusNotePayload;

interface BookCategory {
  id: number;
  name: string;
  color: string;
  bookCount: number;
  createdAt: string;
}

type WatchFolderInfo = import("../src/types/LibraryTypes").WatchFolderInfo;
type LibraryRootInfo = import("../src/types/LibraryTypes").LibraryRootInfo;
type FolderInfo = import("../src/types/LibraryTypes").FolderInfo;
type FolderStats = import("../src/types/LibraryTypes").FolderStats;
type FolderChangedPayload = import("../src/types/LibraryTypes").FolderChangedPayload;

interface OpenPdfResult extends DocumentRecord {
  fileBuffer: ArrayBuffer;
}

interface NativePdfViewerState {
  page: number;
  currentScale: number;
  scrollTop: number;
  totalPages: number;
  canAccess: boolean;
}

type BookFormat = import("../src/types/LibraryTypes").BookFormat;

type MetadataSearchSource = "openlibrary" | "google" | "loc" | "all";
type MetadataSearchField = "title" | "author" | "isbn";

interface BookMetadataCandidate {
  id: string;
  source: "openlibrary" | "google" | "loc";
  sourceLabel: string;
  title: string;
  subtitle?: string;
  authors: string[];
  publisher?: string;
  publishedDate?: string;
  language?: string;
  isbn10?: string;
  isbn13?: string;
  pageCount?: number;
  categories: string[];
  description?: string;
  thumbnailUrl?: string;
  externalUrl?: string;
}

interface ConversionTarget {
  format: BookFormat;
  supported: boolean;
  reason?: string;
}

interface GenericConversionResult {
  success: boolean;
  outputPath?: string;
  fileHash?: string;
  packageRoot?: string;
  report?: Record<string, unknown> & { warnings?: string[] };
  error?: string;
}

interface AtlasMapResult {
  success: boolean;
  payload?: ReadingMapPayload;
  error?: string;
}

interface AtlasStatusResult {
  success: boolean;
  payload?: ReadingStatusPayload;
  error?: string;
}

interface AtlasStatusNoteResult {
  success: boolean;
  payload?: ReadingStatusNotePayload;
  error?: string;
}

declare namespace NodeJS {
  interface ProcessEnv {
    APP_ROOT: string;
    VITE_PUBLIC: string;
  }
}

interface Window {
  electronAPI: {
    getFilePath: () => Promise<string>;
  };
  api: {
    addDocument: (data: any) => Promise<any>;
    getDocuments: () => Promise<DocumentRecord[]>;
    listBooks: (query: LibraryListQuery) => Promise<LibraryListResult>;

    saveReadingState: (payload: any) => Promise<void>;
    getReadingState: (fileHash: string) => Promise<DocumentRecord | null>;
    getNativePdfViewerState: (sourceUrl: string) => Promise<NativePdfViewerState | null>;
    applyNativePdfViewerState: (
      sourceUrl: string,
      state: Omit<NativePdfViewerState, "totalPages" | "canAccess">,
    ) => Promise<NativePdfViewerState | null>;

    openPdf: () => Promise<OpenPdfResult | null>;
    openEpub: () => Promise<OpenPdfResult | null>;
    openReadableFile: () => Promise<(OpenPdfResult & { fileType: "pdf" | "epub" }) | null>;
    getTempPdfFile: (fileBuffer: ArrayBuffer, fileHash: string) => Promise<string | null>;
    convertPdfToEpub: (fileHash: string) => Promise<{
      success: boolean;
      outputPath?: string;
      fileHash?: string;
      report?: {
        pageCount: number;
        sectionCount: number;
        blockCount: number;
        warnings: string[];
      };
      error?: string;
    }>;
    convertEpubToPdf: (fileHash: string) => Promise<{
      success: boolean;
      outputPath?: string;
      fileHash?: string;
      report?: {
        chapterCount: number;
        pageCount: number;
        wordCount: number;
        imageCount: number;
        skippedImageCount: number;
        unsupportedCharacterCount: number;
        warnings: string[];
      };
      error?: string;
    }>;
    listConversionTargets: (fileHash: string) => Promise<{
      success: boolean;
      sourceFormat?: BookFormat;
      targets: ConversionTarget[];
      error?: string;
    }>;
    convertBook: (fileHash: string, targetFormat: BookFormat) => Promise<GenericConversionResult>;
    importPdf: (targetFolder: string | null, action?: "move" | "copy") => Promise<{ success: boolean; canceled?: boolean; imported: string[]; errors: string[]; message: string }>;
    openImageDialog: () => Promise<string | null>;
    getLastDocument: () => Promise<DocumentRecord | null>;
    reopenPdf: (filePath?: string, fileHash?: string) => Promise<{
      fileBuffer: ArrayBuffer;
      fileHash: string;
      filePath?: string;
      fileType?: "pdf" | "epub";
      fileName?: string;
      foundAt?: string;
    } | { error: string; message: string } | null>;
    openDocumentByHash: (fileHash: string, filePath?: string) => Promise<{
      fileBuffer: ArrayBuffer;
      fileHash: string;
      filePath?: string;
      fileType?: "pdf" | "epub";
      fileName?: string;
      foundAt?: string;
    } | { error: string; message: string } | null>;

    getThumbnail: (thumbnailPath: string) => Promise<string | null>;
    getThumbnails: (thumbnailPaths: string[]) => Promise<Record<string, string | null>>;
    ensureThumbnails: (books: Array<{ fileHash: string; filePath: string; fileType?: BookFormat | null }>) => Promise<{ queued: number; skipped: number }>;
    regenerateAllThumbnails: () => Promise<{ queued: number; skipped: number; total: number }>;

    getLibraryPath: () => Promise<string>;
    scanLibrary: () => Promise<{ queued: number; skipped: number; total: number }>;
    resyncLibrary: () => Promise<{ added: number; removed: number; updated: number }>;
    moveToLibrary: (filePath: string) => Promise<void>;

    openFileDialog: () => Promise<string | null>;

    getDocumentsBySyncStatus: (synced: boolean) => Promise<DocumentRecord[]>;
    getCategories: () => Promise<string[]>;
    syncDocument: (
      fileHash: string,
      action: "move" | "copy",
      category?: string,
    ) => Promise<{ success: boolean; newPath?: string; error?: string }>;
    searchLocalBooks: (query: string) => Promise<DocumentRecord[]>;

    windowMinimize: () => Promise<void>;
    windowMaximize: () => Promise<void>;
    windowClose: () => Promise<void>;
    windowIsMaximized: () => Promise<boolean>;

    toggleFavorite: (fileHash: string) => Promise<boolean>;
    updateRating: (fileHash: string, rating: number) => Promise<boolean>;
    updateNotes: (fileHash: string, notes: string) => Promise<boolean>;
    updateReadingStatus: (fileHash: string, status: ReadingStatus) => Promise<{ success: boolean; error?: string }>;
    getReadingMap: (mapId?: string | null) => Promise<AtlasMapResult>;
    createReadingMap: (title: string, description?: string | null) => Promise<AtlasMapResult>;
    createReadingMapSection: (mapId: string, title: string, description?: string) => Promise<AtlasMapResult>;
    updateReadingMapSection: (sectionId: string, updates: { title?: string; description?: string }) => Promise<AtlasMapResult>;
    addLibraryBookToReadingMap: (sectionId: string, fileHash: string) => Promise<AtlasMapResult>;
    addManualBookToReadingMap: (sectionId: string, data: { title: string; author?: string | null; status?: ReadingStatus }) => Promise<AtlasMapResult>;
    updateReadingMapItemStatus: (itemId: string, status: ReadingStatus) => Promise<AtlasMapResult>;
    reorderReadingMapItem: (itemId: string, direction: "up" | "down") => Promise<AtlasMapResult>;
    moveReadingMapItem: (itemId: string, targetSectionId: string) => Promise<AtlasMapResult>;
    positionReadingMapItem: (itemId: string, targetSectionId: string, targetIndex: number) => Promise<AtlasMapResult>;
    deleteReadingMapItem: (itemId: string) => Promise<AtlasMapResult>;
    getReadingStatusItems: () => Promise<AtlasStatusResult>;
    addLibraryBookToReadingStatus: (status: ReadingStatus, fileHash: string) => Promise<AtlasStatusResult>;
    addManualBookToReadingStatus: (data: { title: string; author?: string | null; status: ReadingStatus }) => Promise<AtlasStatusResult>;
    updateReadingStatusItemStatus: (itemId: string, status: ReadingStatus) => Promise<AtlasStatusResult>;
    positionReadingStatusItem: (itemId: string, status: ReadingStatus, targetIndex: number) => Promise<AtlasStatusResult>;
    updateReadingStatusItemProgress: (itemId: string, updates: { manualBasePage?: number; manualCurrentPage?: number; manualTotalPages?: number | null }) => Promise<AtlasStatusResult>;
    addReadingStatusProgressEvent: (itemId: string, pages: number, note?: string | null) => Promise<AtlasStatusResult>;
    deleteReadingStatusItem: (itemId: string) => Promise<AtlasStatusResult>;
    setPrimaryReadingStatusItem: (itemId: string) => Promise<AtlasStatusResult>;
    updateReadingStatusItemCover: (itemId: string, coverPath: string | null) => Promise<AtlasStatusResult>;
    updateReadingStatusItemMetadata: (itemId: string, updates: {
      title?: string;
      author?: string | null;
      description?: string | null;
      isbn?: string | null;
      publisher?: string | null;
      publishDate?: string | null;
      subject?: string | null;
      manualTotalPages?: number | null;
      coverPath?: string | null;
    }) => Promise<AtlasStatusResult>;
    setAtlasNotesVault: (vaultPath: string | null) => Promise<AtlasStatusResult>;
    getReadingStatusItemNote: (itemId: string) => Promise<AtlasStatusNoteResult>;
    saveReadingStatusItemNote: (itemId: string, content: string) => Promise<AtlasStatusNoteResult>;
    searchBookMetadata: (source: MetadataSearchSource, query: string, field: MetadataSearchField, limit?: number) => Promise<{
      success: boolean;
      results: BookMetadataCandidate[];
      warnings: string[];
      error?: string;
    }>;
    updateMetadata: (fileHash: string, metadata: {
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
    }) => Promise<{ success: boolean; fileHash?: string; warnings?: string[]; error?: string }>;
    updateTitle: (fileHash: string, newTitle: string) => Promise<boolean>;
    renameBook: (fileHash: string, newTitle: string, newAuthor: string) => Promise<{ success: boolean; error?: string }>;
    deleteBook: (fileHash: string, deleteFile?: boolean) => Promise<{ success: boolean; error?: string }>;
    getBookById: (id: number) => Promise<DocumentRecord | null>;
    getFavorites: () => Promise<DocumentRecord[]>;
    processPendingBooks: () => Promise<{ processed: number }>;
    regenerateThumbnail: (fileHash: string) => Promise<{ success: boolean; thumbnailPath?: string; error?: string }>;
    setThumbnail: (fileHash: string, imagePath: string, mode: "replace" | "prepend") => Promise<{ success: boolean; fileHash?: string; thumbnailPath?: string; warnings?: string[]; error?: string }>;
    setThumbnailFromUrl: (fileHash: string, imageUrl: string, mode: "replace" | "prepend") => Promise<{ success: boolean; fileHash?: string; thumbnailPath?: string; warnings?: string[]; error?: string }>;
    updateBookId: (fileHash: string, bookId: string) => Promise<{ success: boolean }>;
    getDocumentsByBookId: (bookId: string) => Promise<DocumentRecord[]>;
    mergeBooks: (fileHashes: string[]) => Promise<{ success: boolean; bookId: string; mergedCount: number; documents: DocumentRecord[]; error?: string }>;
    mergeBooksIntoFolder: (fileHashes: string[], parentPath?: string | null) => Promise<{ success: boolean; folderPath?: string; fullPath?: string; moved?: number; mergedCount?: number; error?: string }>;
    getDocumentByTitle: (title: string) => Promise<DocumentRecord | undefined>;
    openLibraryFolder: () => Promise<string>;
    showBookInFolder: (filePath: string) => Promise<boolean>;
    onLibraryUpdated: (callback: () => void) => () => void;
    onLibraryNotification: (callback: (notification: { type: "success" | "error" | "warning"; message: string }) => void) => () => void;

    categoryCreate: (name: string, color?: string) => Promise<BookCategory | null>;
    categoryUpdate: (id: number, name: string, color: string) => Promise<boolean>;
    categoryDelete: (id: number) => Promise<boolean>;
    categoryGetAll: () => Promise<BookCategory[]>;
    categoryGetById: (id: number) => Promise<BookCategory | null>;
    categoryGetForDocument: (documentId: number) => Promise<BookCategory[]>;
    categoryGetForDocumentByHash: (fileHash: string) => Promise<BookCategory[]>;
    categorySetForDocument: (documentId: number, categoryIds: number[]) => Promise<boolean>;
    categoryAddToDocument: (documentId: number, categoryId: number) => Promise<boolean>;
    categoryRemoveFromDocument: (documentId: number, categoryId: number) => Promise<boolean>;
    categoryGetColors: () => Promise<string[]>;
    categoryImportFromFolders: () => Promise<{ imported: number }>;

    getFolderStructure: (rootPath?: string | null) => Promise<FolderInfo[]>;
    getFolderStructureCached: (rootPath?: string | null) => Promise<FolderInfo[]>;
    getFolderChildren: (parentPath?: string | null) => Promise<FolderInfo[]>;
    getFolderStats: (folderPath?: string | null) => Promise<FolderStats>;
    folderExists: (folderPath?: string | null) => Promise<boolean>;
    onFolderChanged: (callback: (payload: FolderChangedPayload) => void) => () => void;
    getLibraryRoots: () => Promise<LibraryRootInfo[]>;
    getAllFolders: () => Promise<string[]>;
    getBooksInFolder: (folderPath: string | null) => Promise<DocumentRecord[]>;
    createFolder: (folderName: string, parentPath?: string | null) => Promise<{ success: boolean; error?: string }>;
    createCollection: (name: string, fileHashes: string[], parentPath?: string | null) => Promise<{ success: boolean; folderPath?: string; fullPath?: string; moved?: number; error?: string }>;
    renameFolder: (oldPath: string, newName: string) => Promise<{ success: boolean; error?: string }>;
    deleteFolder: (folderPath: string, force?: boolean) => Promise<{ success: boolean; error?: string }>;
    moveFolder: (sourcePath: string, targetPath: string | null) => Promise<{ success: boolean; error?: string }>;
    moveBook: (fileHash: string, targetFolderPath: string | null) => Promise<{ success: boolean; error?: string }>;
    moveMergedBook: (bookId: string, targetFolderPath: string | null) => Promise<{ success: boolean; moved?: number; error?: string }>;

    selectFolder: () => Promise<{ canceled: boolean; filePaths: string[] }>;

    getWatchFolders: () => Promise<WatchFolderInfo[]>;
    addWatchFolder: (folderPath: string, label?: string) => Promise<WatchFolderInfo>;
    removeWatchFolder: (id: number) => Promise<{ success: boolean }>;
    addSourceFolder: (folderPath: string, label?: string) => Promise<{ success: boolean; folder?: WatchFolderInfo; error?: string }>;
    removeSourceFolder: (id: number) => Promise<{ success: boolean; removedDocuments: number; error?: string }>;
    resyncSourceFolder: (id: number) => Promise<{ success: boolean; scanned?: number; error?: string }>;
    getWatchFolderBooks: (folderPath: string) => Promise<DocumentRecord[]>;
    getWatchFolderBookCount: (folderPath: string) => Promise<number>;

    backupInit: (supabaseUrl: string, supabaseAnonKey: string) => Promise<{ success: boolean; error?: string }>;
    backupSetSession: (accessToken: string, refreshToken: string) => Promise<{ success: boolean; error?: string }>;
    backupClearSession: () => Promise<{ success: boolean; error?: string }>;
    backupAllDocuments: () => Promise<{ success: number; failed: number; errors: string[] }>;
    backupAllHabits: () => Promise<{ success: number; failed: number; errors: string[] }>;
    backupAllCategories: () => Promise<{ success: number; failed: number; errors: string[] }>;

    habitsGetAll: () => Promise<any[]>;
    habitsGetById: (id: string) => Promise<any | undefined>;
    habitsAdd: (habit: { id: string; name: string; unit: string | null; valueMode: string }) => Promise<{ success: boolean }>;
    habitsUpdate: (id: string, updates: { name?: string; unit?: string | null; valueMode?: string }) => Promise<{ success: boolean }>;
    habitsDelete: (id: string) => Promise<{ success: boolean }>;
    habitsGetCompletions: (habitId: string) => Promise<any[]>;
    habitsGetAllCompletions: () => Promise<any[]>;
    habitsSetCompletion: (habitId: string, dateKey: string, value: string | null) => Promise<{ success: boolean }>;
    habitsDeleteCompletion: (habitId: string, dateKey: string) => Promise<{ success: boolean }>;

openExternalFile: (filePath: string) => Promise<{ success: boolean; error?: string } & OpenPdfResult>;
    onFileOpened: (callback: (data: OpenPdfResult & { fileType: "pdf" | "epub" }) => void) => () => void;
    onReadingShortcut: (callback: (data: { key: string; shift?: boolean }) => void) => () => void;
    openDefaultAppsSettings: () => Promise<{ success: boolean }>;
    openInNewWindow: (data: {
      fileHash: string;
      fileName: string;
      fileType: "pdf" | "epub";
      filePath?: string;
      libraryDocumentId?: string;
      pdfRenderer?: "embedpdf" | "pdfjs";
      source?: "library" | "local";
    }) => Promise<void>;

    zoomIn: () => Promise<void>;
    zoomOut: () => Promise<void>;
    zoomReset: () => Promise<void>;
    getZoomFactor: () => Promise<number>;
    setZoomFactor: (factor: number) => Promise<void>;
    onZoomFactorChanged: (callback: (factor: number) => void) => () => void;
  };
}

// Used in Renderer process, expose in `preload.ts`
interface Window {
  electronAPI: {
    getFilePath: () => Promise<string>;
  };
  api: {
    // addDocument: (data: any) => Promise<any>;
    // getDocuments: () => Promise<any>;
    // saveReadingState: (payload: any) => Promise<void>;
    // getReadingState: (fileHash: string) => Promise<any>;
    // openPdf: () => any;
    // getLastDocument: () => any;
    // reopenPdf: (filePath: string) => any;
    // getThumbnail: (thumbnailPath: string) => Promise<string | null>;
    // getLibraryPath: () => any;

    addDocument: (data: any) => Promise<any>;
    getDocuments: () => Promise<any[]>;

    saveReadingState: (payload: any) => Promise<void>;
    getReadingState: (fileHash: string) => Promise<any>;
    getNativePdfViewerState: (sourceUrl: string) => Promise<NativePdfViewerState | null>;
    applyNativePdfViewerState: (
      sourceUrl: string,
      state: Omit<NativePdfViewerState, "totalPages" | "canAccess">,
    ) => Promise<NativePdfViewerState | null>;

    openPdf: () => Promise<OpenPdfResult | null>;
    openEpub: () => Promise<OpenPdfResult | null>;
    openReadableFile: () => Promise<(OpenPdfResult & { fileType: "pdf" | "epub" }) | null>;
    convertPdfToEpub: (fileHash: string) => Promise<{
      success: boolean;
      outputPath?: string;
      fileHash?: string;
      report?: {
        pageCount: number;
        sectionCount: number;
        blockCount: number;
        warnings: string[];
      };
      error?: string;
    }>;
    convertEpubToPdf: (fileHash: string) => Promise<{
      success: boolean;
      outputPath?: string;
      fileHash?: string;
      report?: {
        chapterCount: number;
        pageCount: number;
        wordCount: number;
        imageCount: number;
        skippedImageCount: number;
        unsupportedCharacterCount: number;
        warnings: string[];
      };
      error?: string;
    }>;
    listConversionTargets: (fileHash: string) => Promise<{
      success: boolean;
      sourceFormat?: BookFormat;
      targets: ConversionTarget[];
      error?: string;
    }>;
    convertBook: (fileHash: string, targetFormat: BookFormat) => Promise<GenericConversionResult>;
    getLastDocument: () => Promise<any>;
    reopenPdf: (filePath?: string, fileHash?: string) => Promise<any>;
    openDocumentByHash: (fileHash: string, filePath?: string) => Promise<any>;

    getThumbnail: (thumbnailPath: string) => Promise<string | null>;
    getThumbnails: (thumbnailPaths: string[]) => Promise<Record<string, string | null>>;
    ensureThumbnails: (books: Array<{ fileHash: string; filePath: string; fileType?: BookFormat | null }>) => Promise<{ queued: number; skipped: number }>;
    regenerateAllThumbnails: () => Promise<{ queued: number; skipped: number; total: number }>;

    getLibraryPath: () => Promise<string>;
    scanLibrary: () => Promise<{ queued: number; skipped: number; total: number }>;
    resyncLibrary: () => Promise<{ added: number; removed: number; updated: number }>;
    moveToLibrary: (filePath: string) => Promise<void>;

    openFileDialog: () => Promise<string | null>;

    getDocumentsBySyncStatus: (synced: boolean) => Promise<any[]>;
    getCategories: () => Promise<string[]>;
    syncDocument: (
      fileHash: string,
      action: "move" | "copy",
      category?: string,
    ) => Promise<{ success: boolean; newPath?: string; error?: string }>;
    searchLocalBooks: (query: string) => Promise<any[]>;

    getWatchFolders: () => Promise<any[]>;
    addWatchFolder: (folderPath: string, label?: string) => Promise<any>;
    removeWatchFolder: (id: number) => Promise<{ success: boolean }>;
    getWatchFolderBooks: (folderPath: string) => Promise<any[]>;
    getWatchFolderBookCount: (folderPath: string) => Promise<number>;

    windowMinimize: () => Promise<void>;
    windowMaximize: () => Promise<void>;
    windowClose: () => Promise<void>;
    windowIsMaximized: () => Promise<boolean>;
    updateReadingStatus: (fileHash: string, status: ReadingStatus) => Promise<{ success: boolean; error?: string }>;
    getReadingMap: (mapId?: string | null) => Promise<AtlasMapResult>;
    createReadingMap: (title: string, description?: string | null) => Promise<AtlasMapResult>;
    createReadingMapSection: (mapId: string, title: string, description?: string) => Promise<AtlasMapResult>;
    updateReadingMapSection: (sectionId: string, updates: { title?: string; description?: string }) => Promise<AtlasMapResult>;
    addLibraryBookToReadingMap: (sectionId: string, fileHash: string) => Promise<AtlasMapResult>;
    addManualBookToReadingMap: (sectionId: string, data: { title: string; author?: string | null; status?: ReadingStatus }) => Promise<AtlasMapResult>;
    updateReadingMapItemStatus: (itemId: string, status: ReadingStatus) => Promise<AtlasMapResult>;
    reorderReadingMapItem: (itemId: string, direction: "up" | "down") => Promise<AtlasMapResult>;
    moveReadingMapItem: (itemId: string, targetSectionId: string) => Promise<AtlasMapResult>;
    positionReadingMapItem: (itemId: string, targetSectionId: string, targetIndex: number) => Promise<AtlasMapResult>;
    deleteReadingMapItem: (itemId: string) => Promise<AtlasMapResult>;
    getReadingStatusItems: () => Promise<AtlasStatusResult>;
    addLibraryBookToReadingStatus: (status: ReadingStatus, fileHash: string) => Promise<AtlasStatusResult>;
    addManualBookToReadingStatus: (data: { title: string; author?: string | null; status: ReadingStatus }) => Promise<AtlasStatusResult>;
    updateReadingStatusItemStatus: (itemId: string, status: ReadingStatus) => Promise<AtlasStatusResult>;
    positionReadingStatusItem: (itemId: string, status: ReadingStatus, targetIndex: number) => Promise<AtlasStatusResult>;
    updateReadingStatusItemProgress: (itemId: string, updates: { manualBasePage?: number; manualCurrentPage?: number; manualTotalPages?: number | null }) => Promise<AtlasStatusResult>;
    addReadingStatusProgressEvent: (itemId: string, pages: number, note?: string | null) => Promise<AtlasStatusResult>;
    deleteReadingStatusItem: (itemId: string) => Promise<AtlasStatusResult>;
    setPrimaryReadingStatusItem: (itemId: string) => Promise<AtlasStatusResult>;
    updateReadingStatusItemCover: (itemId: string, coverPath: string | null) => Promise<AtlasStatusResult>;
    updateReadingStatusItemMetadata: (itemId: string, updates: {
      title?: string;
      author?: string | null;
      description?: string | null;
      isbn?: string | null;
      publisher?: string | null;
      publishDate?: string | null;
      subject?: string | null;
      manualTotalPages?: number | null;
      coverPath?: string | null;
    }) => Promise<AtlasStatusResult>;
    setAtlasNotesVault: (vaultPath: string | null) => Promise<AtlasStatusResult>;
    getReadingStatusItemNote: (itemId: string) => Promise<AtlasStatusNoteResult>;
    saveReadingStatusItemNote: (itemId: string, content: string) => Promise<AtlasStatusNoteResult>;

    backupInit: (supabaseUrl: string, supabaseAnonKey: string) => Promise<{ success: boolean; error?: string }>;
    backupSetSession: (accessToken: string, refreshToken: string) => Promise<{ success: boolean; error?: string }>;
    backupClearSession: () => Promise<{ success: boolean; error?: string }>;
    backupAllDocuments: () => Promise<{ success: number; failed: number; errors: string[] }>;
    backupAllHabits: () => Promise<{ success: number; failed: number; errors: string[] }>;

    habitsGetAll: () => Promise<any[]>;
    habitsGetById: (id: string) => Promise<any | undefined>;
    habitsAdd: (habit: { id: string; name: string; unit: string | null; valueMode: string }) => Promise<{ success: boolean }>;
    habitsUpdate: (id: string, updates: { name?: string; unit?: string | null; valueMode?: string }) => Promise<{ success: boolean }>;
    habitsDelete: (id: string) => Promise<{ success: boolean }>;
    habitsGetCompletions: (habitId: string) => Promise<any[]>;
    habitsGetAllCompletions: () => Promise<any[]>;
    habitsSetCompletion: (habitId: string, dateKey: string, value: string | null) => Promise<{ success: boolean }>;
    habitsDeleteCompletion: (habitId: string, dateKey: string) => Promise<{ success: boolean }>;

    openExternalFile: (filePath: string) => Promise<{ success: boolean; error?: string } & OpenPdfResult>;
    onFileOpened: (callback: (data: OpenPdfResult & { fileType: "pdf" | "epub" }) => void) => () => void;
    onReadingShortcut: (callback: (data: { key: string; shift?: boolean }) => void) => () => void;
    openDefaultAppsSettings: () => Promise<{ success: boolean }>;

    zoomIn: () => Promise<void>;
    zoomOut: () => Promise<void>;
    zoomReset: () => Promise<void>;
    getZoomFactor: () => Promise<number>;
    setZoomFactor: (factor: number) => Promise<void>;
    onZoomFactorChanged: (callback: (factor: number) => void) => () => void;
  };
}
