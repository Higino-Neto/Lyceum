/// <reference types="vite-plugin-electron/electron-env" />

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
    addDocument: (data: any) => Promise<any>;
    getDocuments: () => Promise<any>;
    saveReadingState: (payload: any) => Promise<void>;
    getReadingState: (fileHash: string) => Promise<any>;
    openPdf: () => any;
    getLastDocument: () => any;
    reopenPdf: (filePath: string) => any;
    getThumbnail: (thumbnailPath: string) => Promise<string | null>;
  };
}
