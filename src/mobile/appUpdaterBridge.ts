import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

export interface InstalledAppVersion {
  packageName: string;
  versionName: string;
  versionCode: number;
}

export interface AppUpdaterDownloadOptions {
  url: string;
  sha256?: string;
  fileName?: string;
  sizeBytes?: number;
}

export interface AppUpdaterDownloadProgress {
  loaded: number;
  total: number;
  percent: number;
}

interface AppUpdaterPlugin {
  getInstalledVersion(): Promise<InstalledAppVersion>;
  canRequestPackageInstalls(): Promise<{ value: boolean }>;
  openInstallPermissionSettings(): Promise<void>;
  downloadAndInstall(options: AppUpdaterDownloadOptions): Promise<{ path: string; bytes: number }>;
  addListener(
    eventName: "downloadProgress",
    listener: (event: AppUpdaterDownloadProgress) => void,
  ): Promise<PluginListenerHandle>;
}

const AppUpdater = registerPlugin<AppUpdaterPlugin>("AppUpdater");

export function supportsNativeApkUpdater() {
  return Capacitor.getPlatform() === "android";
}

export async function getInstalledAppVersion() {
  return AppUpdater.getInstalledVersion();
}

export async function canRequestPackageInstalls() {
  return (await AppUpdater.canRequestPackageInstalls()).value;
}

export async function openInstallPermissionSettings() {
  await AppUpdater.openInstallPermissionSettings();
}

export async function downloadAndInstallApk(
  options: AppUpdaterDownloadOptions,
  onProgress?: (progress: AppUpdaterDownloadProgress) => void,
) {
  let listener: PluginListenerHandle | null = null;
  if (onProgress) {
    listener = await AppUpdater.addListener("downloadProgress", onProgress);
  }

  try {
    return await AppUpdater.downloadAndInstall(options);
  } finally {
    await listener?.remove();
  }
}
