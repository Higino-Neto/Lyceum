import {
  canRequestPackageInstalls,
  downloadAndInstallApk,
  getInstalledAppVersion,
  openInstallPermissionSettings,
  supportsNativeApkUpdater,
  type AppUpdaterDownloadProgress,
  type InstalledAppVersion,
} from "./appUpdaterBridge";

export interface NativeApkUpdateManifest {
  version: string;
  versionCode: number;
  apkUrl: string;
  notes?: string;
  sha256?: string;
  sizeBytes?: number;
  publishedAt?: string;
  minSdk?: number;
  mandatory?: boolean;
}

export type NativeApkUpdateStatus =
  | "unsupported"
  | "idle"
  | "checking"
  | "available"
  | "not-available"
  | "permission-required"
  | "downloading"
  | "installing"
  | "error";

export interface NativeApkUpdateState {
  status: NativeApkUpdateStatus;
  installed?: InstalledAppVersion;
  manifest?: NativeApkUpdateManifest;
  checkedAt?: string;
  progress?: AppUpdaterDownloadProgress;
  error?: string;
}

const DEFAULT_NATIVE_APK_MANIFEST_URL =
  "https://github.com/Higino-Neto/Lyceum/releases/latest/download/lyceum-mobile-latest.json";

const NATIVE_APK_MANIFEST_URL =
  import.meta.env.VITE_MOBILE_APK_UPDATE_MANIFEST_URL || DEFAULT_NATIVE_APK_MANIFEST_URL;

export function isNewerVersionCode(remoteVersionCode: number, installedVersionCode: number) {
  return Number.isFinite(remoteVersionCode)
    && Number.isFinite(installedVersionCode)
    && remoteVersionCode > installedVersionCode;
}

function parseManifest(value: unknown): NativeApkUpdateManifest {
  if (!value || typeof value !== "object") {
    throw new Error("Manifesto de atualizacao invalido");
  }

  const record = value as Partial<NativeApkUpdateManifest>;
  if (!record.version || typeof record.version !== "string") {
    throw new Error("Manifesto sem versao");
  }
  const versionCode = Number(record.versionCode);
  if (!Number.isFinite(versionCode)) {
    throw new Error("Manifesto sem versionCode");
  }
  if (!record.apkUrl || typeof record.apkUrl !== "string") {
    throw new Error("Manifesto sem apkUrl");
  }
  if (!record.apkUrl.startsWith("https://")) {
    throw new Error("apkUrl precisa usar HTTPS");
  }

  const sizeBytes = Number(record.sizeBytes);
  const minSdk = Number(record.minSdk);

  return {
    version: record.version,
    versionCode,
    apkUrl: record.apkUrl,
    notes: typeof record.notes === "string" ? record.notes : undefined,
    sha256: typeof record.sha256 === "string" ? record.sha256 : undefined,
    sizeBytes: Number.isFinite(sizeBytes) ? sizeBytes : undefined,
    publishedAt: typeof record.publishedAt === "string" ? record.publishedAt : undefined,
    minSdk: Number.isFinite(minSdk) ? minSdk : undefined,
    mandatory: Boolean(record.mandatory),
  };
}

export async function fetchNativeApkUpdateManifest() {
  const response = await fetch(`${NATIVE_APK_MANIFEST_URL}?t=${Date.now()}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Manifesto de APK retornou HTTP ${response.status}`);
  }
  return parseManifest(await response.json());
}

export async function checkNativeApkUpdate(): Promise<NativeApkUpdateState> {
  if (!supportsNativeApkUpdater()) {
    return {
      status: "unsupported",
      error: "Atualizacao por APK esta disponivel apenas no Android.",
    };
  }

  try {
    const installed = await getInstalledAppVersion();
    const manifest = await fetchNativeApkUpdateManifest();
    const checkedAt = new Date().toISOString();

    if (!isNewerVersionCode(manifest.versionCode, installed.versionCode)) {
      return { status: "not-available", installed, manifest, checkedAt };
    }

    return { status: "available", installed, manifest, checkedAt };
  } catch (error) {
    return {
      status: "error",
      checkedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function installNativeApkUpdate(
  manifest: NativeApkUpdateManifest,
  onProgress: (progress: AppUpdaterDownloadProgress) => void,
): Promise<NativeApkUpdateState> {
  if (!supportsNativeApkUpdater()) {
    return {
      status: "unsupported",
      manifest,
      error: "Atualizacao por APK esta disponivel apenas no Android.",
    };
  }

  const hasInstallPermission = await canRequestPackageInstalls();
  if (!hasInstallPermission) {
    return { status: "permission-required", manifest };
  }

  try {
    await downloadAndInstallApk(
      {
        url: manifest.apkUrl,
        sha256: manifest.sha256,
        sizeBytes: manifest.sizeBytes,
        fileName: `lyceum-${manifest.version}.apk`,
      },
      onProgress,
    );
    return { status: "installing", manifest };
  } catch (error) {
    return {
      status: "error",
      manifest,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export { openInstallPermissionSettings };
