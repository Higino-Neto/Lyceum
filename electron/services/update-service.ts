import electron, { type BrowserWindow as ElectronBrowserWindow, type IpcMain } from "electron";
import { autoUpdater } from "electron-updater";
import type { ProgressInfo, UpdateInfo } from "electron-updater";

const { app } = electron;

export type LyceumUpdateStatus =
  | "idle"
  | "disabled"
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "error";

export interface LyceumUpdateReleaseInfo {
  version?: string;
  releaseName?: string;
  releaseDate?: string;
  releaseNotes?: string | null;
}

export interface LyceumUpdateProgress {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

export interface LyceumUpdateState {
  status: LyceumUpdateStatus;
  currentVersion: string;
  source: "github";
  canCheck: boolean;
  canInstall: boolean;
  updateAvailable: boolean;
  checkedAt?: string;
  downloadedAt?: string;
  updateInfo?: LyceumUpdateReleaseInfo;
  progress?: LyceumUpdateProgress;
  error?: string;
}

let updateWindow: ElectronBrowserWindow | null = null;
let initialized = false;
let state: LyceumUpdateState = {
  status: app.isPackaged ? "idle" : "disabled",
  currentVersion: app.getVersion(),
  source: "github",
  canCheck: app.isPackaged,
  canInstall: false,
  updateAvailable: false,
  error: app.isPackaged
    ? undefined
    : "Atualizacoes automaticas ficam disponiveis apenas no aplicativo instalado.",
};

function normalizeReleaseNotes(notes: unknown): string | null {
  if (!notes) return null;
  if (typeof notes === "string") return notes;
  if (Array.isArray(notes)) {
    return notes
      .map((entry) => {
        if (typeof entry === "string") return entry;
        if (entry && typeof entry === "object" && "note" in entry) {
          return String((entry as { note?: unknown }).note ?? "");
        }
        return "";
      })
      .filter(Boolean)
      .join("\n\n");
  }
  return null;
}

function toReleaseInfo(info?: UpdateInfo | null): LyceumUpdateReleaseInfo | undefined {
  if (!info) return undefined;
  return {
    version: info.version,
    releaseName: info.releaseName || undefined,
    releaseDate: info.releaseDate,
    releaseNotes: normalizeReleaseNotes(info.releaseNotes),
  };
}

function toProgressInfo(progress: ProgressInfo): LyceumUpdateProgress {
  return {
    percent: Math.max(0, Math.min(100, progress.percent || 0)),
    bytesPerSecond: progress.bytesPerSecond || 0,
    transferred: progress.transferred || 0,
    total: progress.total || 0,
  };
}

function patchState(patch: Partial<LyceumUpdateState>) {
  const nextStatus = patch.status ?? state.status;
  state = {
    ...state,
    ...patch,
    currentVersion: app.getVersion(),
    canCheck: app.isPackaged && nextStatus !== "checking",
  };

  if (nextStatus === "checking") {
    state.canCheck = false;
  }

  if (nextStatus === "available") {
    state.canInstall = false;
    state.updateAvailable = true;
  }

  if (nextStatus === "downloading") {
    state.canInstall = false;
    state.updateAvailable = true;
  }

  if (nextStatus === "downloaded") {
    state.canInstall = true;
    state.updateAvailable = true;
  }

  if (nextStatus === "not-available" || nextStatus === "disabled") {
    state.canInstall = false;
    state.updateAvailable = false;
    state.progress = undefined;
  }

  updateWindow?.webContents.send("updates:status-changed", state);
}

export function setUpdateWindow(window: ElectronBrowserWindow | null) {
  updateWindow = window;
}

export function getUpdateState(): LyceumUpdateState {
  return state;
}

export function initializeUpdateService() {
  if (initialized) return;
  initialized = true;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => {
    patchState({
      status: "checking",
      error: undefined,
      progress: undefined,
    });
  });

  autoUpdater.on("update-available", (info) => {
    patchState({
      status: "available",
      updateAvailable: true,
      updateInfo: toReleaseInfo(info),
      error: undefined,
      checkedAt: new Date().toISOString(),
    });
  });

  autoUpdater.on("update-not-available", (info) => {
    patchState({
      status: "not-available",
      updateInfo: toReleaseInfo(info),
      error: undefined,
      checkedAt: new Date().toISOString(),
    });
  });

  autoUpdater.on("download-progress", (progress) => {
    patchState({
      status: "downloading",
      progress: toProgressInfo(progress),
      error: undefined,
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    patchState({
      status: "downloaded",
      updateInfo: toReleaseInfo(info),
      progress: { ...(state.progress || { bytesPerSecond: 0, transferred: 0, total: 0 }), percent: 100 },
      error: undefined,
      downloadedAt: new Date().toISOString(),
    });
  });

  autoUpdater.on("error", (error) => {
    patchState({
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

export async function checkForAppUpdates() {
  initializeUpdateService();

  if (!app.isPackaged) {
    patchState({
      status: "disabled",
      error: "Atualizacoes automaticas ficam disponiveis apenas no aplicativo instalado.",
    });
    return state;
  }

  try {
    patchState({ status: "checking", error: undefined, progress: undefined });
    await autoUpdater.checkForUpdates();
  } catch (error) {
    patchState({
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return state;
}

export async function downloadAppUpdate() {
  initializeUpdateService();

  if (!app.isPackaged) {
    patchState({
      status: "disabled",
      error: "Atualizacoes automaticas ficam disponiveis apenas no aplicativo instalado.",
    });
    return state;
  }

  try {
    await autoUpdater.downloadUpdate();
  } catch (error) {
    patchState({
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return state;
}

export function installDownloadedUpdate() {
  initializeUpdateService();

  if (state.status !== "downloaded") {
    return {
      success: false,
      error: "Nenhuma atualizacao baixada para instalar.",
      state,
    };
  }

  setImmediate(() => {
    autoUpdater.quitAndInstall(false, true);
  });

  return { success: true, state };
}

export function registerUpdateHandlers(ipcMain: IpcMain) {
  ipcMain.handle("updates:get-status", () => getUpdateState());
  ipcMain.handle("updates:check", () => checkForAppUpdates());
  ipcMain.handle("updates:download", () => downloadAppUpdate());
  ipcMain.handle("updates:install-now", () => installDownloadedUpdate());
}
