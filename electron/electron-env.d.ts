/// <reference types="vite-plugin-electron/electron-env" />

type LyceumApi = import("./preload").LyceumApi;

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
  api: LyceumApi;
}
