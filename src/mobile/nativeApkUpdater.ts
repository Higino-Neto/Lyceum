import {
  canRequestPackageInstalls,
  downloadAndInstallApk,
  getInstalledAppVersion,
  openInstallPermissionSettings,
  supportsNativeApkUpdater,
  type AppUpdaterDownloadProgress,
  type InstalledAppVersion,
} from "./appUpdaterBridge";
import { fetchLatestMobileReleaseJson, fetchWithTimeout, MobileReleaseError } from "./githubReleaseResolver";

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
  | "not-published"
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

const NATIVE_APK_MANIFEST_URL =
  import.meta.env.VITE_MOBILE_APK_UPDATE_MANIFEST_URL?.trim();

export function isNewerVersionCode(remoteVersionCode: number, installedVersionCode: number) {
  return Number.isFinite(remoteVersionCode)
    && Number.isFinite(installedVersionCode)
    && remoteVersionCode > installedVersionCode;
}

export function parseNativeApkManifest(value: unknown): NativeApkUpdateManifest {
  if (!value || typeof value !== "object") {
    throw new Error("Manifesto de atualizacao invalido");
  }

  const record = value as Partial<NativeApkUpdateManifest>;
  if (!record.version || typeof record.version !== "string") {
    throw new Error("Manifesto sem versao");
  }
  const versionCode = Number(record.versionCode);
  if (!Number.isSafeInteger(versionCode) || versionCode <= 0) {
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
  const sha256 = typeof record.sha256 === "string" ? record.sha256.trim().toLowerCase() : undefined;
  if (!sha256 || !/^[a-f0-9]{64}$/.test(sha256)) {
    throw new Error("Manifesto com SHA-256 invalido");
  }
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > 512 * 1024 * 1024) {
    throw new Error("Manifesto com tamanho de APK invalido");
  }

  return {
    version: record.version,
    versionCode,
    apkUrl: record.apkUrl,
    notes: typeof record.notes === "string" ? record.notes : undefined,
    sha256,
    sizeBytes,
    publishedAt: typeof record.publishedAt === "string" ? record.publishedAt : undefined,
    minSdk: Number.isFinite(minSdk) ? minSdk : undefined,
    mandatory: Boolean(record.mandatory),
  };
}

export async function fetchNativeApkUpdateManifest() {
  if (!NATIVE_APK_MANIFEST_URL) {
    return parseNativeApkManifest(await fetchLatestMobileReleaseJson("lyceum-mobile-latest.json"));
  }
  if (!NATIVE_APK_MANIFEST_URL.startsWith("https://")) {
    throw new Error("A URL do manifesto de APK precisa usar HTTPS");
  }
  const response = await fetchWithTimeout(`${NATIVE_APK_MANIFEST_URL}?t=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Manifesto de APK retornou HTTP ${response.status}`);
  return parseNativeApkManifest(await response.json());
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

    if (manifest.minSdk && installed.sdkInt && manifest.minSdk > installed.sdkInt) {
      return {
        status: "error",
        installed,
        manifest,
        checkedAt,
        error: `Esta versao exige Android API ${manifest.minSdk} ou mais recente.`,
      };
    }

    if (!isNewerVersionCode(manifest.versionCode, installed.versionCode)) {
      return { status: "not-available", installed, manifest, checkedAt };
    }

    return { status: "available", installed, manifest, checkedAt };
  } catch (error) {
    if (error instanceof MobileReleaseError && error.code === "NOT_PUBLISHED") {
      return {
        status: "not-published",
        checkedAt: new Date().toISOString(),
        error: error.message,
      };
    }
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
