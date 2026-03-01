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
    syncDocument: (fileHash: string, action: "move" | "copy", category?: string) => Promise<{ success: boolean; newPath?: string; error?: string }>;

  };
}
