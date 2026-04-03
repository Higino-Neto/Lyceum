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

declare namespace NodeJS {
  interface ProcessEnv {
    APP_ROOT: string;
    VITE_PUBLIC: string;
  }
}

interface Window {
  ipcRenderer: import("electron").IpcRenderer;
  electronAPI: {
    getFilePath: () => Promise<string>;
  };
  api: {
    addDocument: (data: any) => Promise<any>;
    getDocuments: () => Promise<DocumentRecord[]>;

    saveReadingState: (payload: any) => Promise<void>;
    getReadingState: (fileHash: string) => Promise<DocumentRecord | null>;

    openPdf: () => Promise<OpenPdfResult | null>;
    getLastDocument: () => Promise<DocumentRecord | null>;
    reopenPdf: (filePath: string, fileHash?: string) => Promise<{ fileBuffer: ArrayBuffer; fileHash: string; foundAt?: string } | { error: string; message: string } | null>;

    getThumbnail: (thumbnailPath: string) => Promise<string | null>;

    getLibraryPath: () => Promise<string>;
    scanLibrary: () => Promise<void>;
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
    deleteBook: (fileHash: string) => Promise<{ success: boolean; error?: string }>;
    getBookById: (id: number) => Promise<DocumentRecord | null>;
    getFavorites: () => Promise<DocumentRecord[]>;
    processPendingBooks: () => Promise<{ processed: number }>;
    regenerateThumbnail: (fileHash: string) => Promise<{ success: boolean; thumbnailPath?: string; error?: string }>;
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
    createFolder: (folderName: string) => Promise<{ success: boolean; error?: string }>;
    renameFolder: (oldPath: string, newName: string) => Promise<{ success: boolean; error?: string }>;
    deleteFolder: (folderPath: string) => Promise<{ success: boolean; error?: string }>;
  };
}

interface FolderInfo {
  name: string;
  path: string;
  fullPath: string;
  bookCount: number;
  subfolders: FolderInfo[];
}

interface OpenPdfResult extends DocumentRecord {
  fileBuffer: ArrayBuffer;
}

declare namespace NodeJS {
  interface ProcessEnv {
    /**
     * The built directory structure
     *
     * ```tree
     * ├─┬─┬ dist
     * │ │ └── index.html
     * │ │
     * │ ├─┬ dist-electron
     * │ │ ├── main.js
     * │ │ └── preload.js
     * │
     * ```
     */
    APP_ROOT: string;
    /** /dist/ or /public/ */
    VITE_PUBLIC: string;
  }
}

// Used in Renderer process, expose in `preload.ts`
interface Window {
  ipcRenderer: import("electron").IpcRenderer;
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

    openPdf: () => Promise<OpenPdfResult | null>;
    getLastDocument: () => Promise<any>;
    reopenPdf: (filePath: string) => Promise<any>;

    getThumbnail: (thumbnailPath: string) => Promise<string | null>;

    getLibraryPath: () => Promise<string>;
    scanLibrary: () => Promise<void>;
    moveToLibrary: (filePath: string) => Promise<void>;

    openFileDialog: () => Promise<string | null>;

    getDocumentsBySyncStatus: (synced: boolean) => Promise<any[]>;
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
  };
}
