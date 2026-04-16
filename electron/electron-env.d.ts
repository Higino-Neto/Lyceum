/// <reference types="vite-plugin-electron/electron-env" />

interface DocumentRecord {
  id: number;
  title: string;
  filePath: string;
  fileHash: string;
  currentPage: number;
  currentZoom: number | null;
  currentScroll: number | null;
  annotations: string | null;
  thumbnailPath: string | null;
  numPages: number;
  createdAt: string;
  lastOpenedAt: string;
  isSynced: number;
  category: string | null;
  isFavorite: number;
  rating: number;
  notes: string | null;
  author: string | null;
  description: string | null;
  isbn: string | null;
  publisher: string | null;
  publishDate: string | null;
  fileSize: number;
  processingStatus: "pending" | "processing" | "completed" | "failed";
  bookId: string | null;
}

interface BookCategory {
  id: number;
  name: string;
  color: string;
  bookCount: number;
  createdAt: string;
}

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

    saveReadingState: (payload: any) => Promise<void>;
    getReadingState: (fileHash: string) => Promise<DocumentRecord | null>;
    getNativePdfViewerState: (sourceUrl: string) => Promise<NativePdfViewerState | null>;
    applyNativePdfViewerState: (
      sourceUrl: string,
      state: Omit<NativePdfViewerState, "totalPages" | "canAccess">,
    ) => Promise<NativePdfViewerState | null>;

    openPdf: () => Promise<OpenPdfResult | null>;
    openEpub: () => Promise<OpenPdfResult | null>;
    getTempPdfFile: (fileBuffer: ArrayBuffer, fileHash: string) => Promise<string | null>;
    importPdf: (targetFolder: string | null, action?: "move" | "copy") => Promise<{ success: boolean; canceled?: boolean; imported: string[]; errors: string[]; message: string }>;
    openImageDialog: () => Promise<string | null>;
    getLastDocument: () => Promise<DocumentRecord | null>;
    reopenPdf: (filePath: string, fileHash?: string) => Promise<{ fileBuffer: ArrayBuffer; fileHash: string; foundAt?: string } | { error: string; message: string } | null>;

    getThumbnail: (thumbnailPath: string) => Promise<string | null>;

    getLibraryPath: () => Promise<string>;
    scanLibrary: () => Promise<void>;
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
    updateMetadata: (fileHash: string, metadata: {
      author?: string;
      description?: string;
      isbn?: string;
      publisher?: string;
      publishDate?: string;
    }) => Promise<boolean>;
    updateTitle: (fileHash: string, newTitle: string) => Promise<boolean>;
    renameBook: (fileHash: string, newTitle: string, newAuthor: string) => Promise<{ success: boolean; error?: string }>;
    deleteBook: (fileHash: string, deleteFile?: boolean) => Promise<{ success: boolean; error?: string }>;
    getBookById: (id: number) => Promise<DocumentRecord | null>;
    getFavorites: () => Promise<DocumentRecord[]>;
    processPendingBooks: () => Promise<{ processed: number }>;
    regenerateThumbnail: (fileHash: string) => Promise<{ success: boolean; thumbnailPath?: string; error?: string }>;
    setThumbnail: (fileHash: string, imagePath: string, mode: "replace" | "prepend") => Promise<{ success: boolean; error?: string }>;
    updateBookId: (fileHash: string, bookId: string) => Promise<{ success: boolean }>;
    getDocumentsByBookId: (bookId: string) => Promise<DocumentRecord[]>;
    getDocumentByTitle: (title: string) => Promise<DocumentRecord | undefined>;
    openLibraryFolder: () => Promise<string>;
    showBookInFolder: (filePath: string) => Promise<boolean>;
    onLibraryUpdated: (callback: () => void) => () => void;

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

    getFolderStructure: () => Promise<FolderInfo[]>;
    getAllFolders: () => Promise<string[]>;
    getBooksInFolder: (folderPath: string | null) => Promise<DocumentRecord[]>;
    createFolder: (folderName: string, parentPath?: string | null) => Promise<{ success: boolean; error?: string }>;
    renameFolder: (oldPath: string, newName: string) => Promise<{ success: boolean; error?: string }>;
    deleteFolder: (folderPath: string, force?: boolean) => Promise<{ success: boolean; error?: string }>;
    moveFolder: (sourcePath: string, targetPath: string | null) => Promise<{ success: boolean; error?: string }>;
    moveBook: (fileHash: string, targetFolderPath: string | null) => Promise<{ success: boolean; error?: string }>;

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
    openDefaultAppsSettings: () => Promise<{ success: boolean }>;
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
    getLastDocument: () => Promise<any>;
    reopenPdf: (filePath: string) => Promise<any>;

    getThumbnail: (thumbnailPath: string) => Promise<string | null>;

    getLibraryPath: () => Promise<string>;
    scanLibrary: () => Promise<void>;
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

    windowMinimize: () => Promise<void>;
    windowMaximize: () => Promise<void>;
    windowClose: () => Promise<void>;
    windowIsMaximized: () => Promise<boolean>;

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
    openDefaultAppsSettings: () => Promise<{ success: boolean }>;
  };
}
