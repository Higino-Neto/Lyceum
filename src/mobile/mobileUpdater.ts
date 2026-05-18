import { Capacitor } from "@capacitor/core";
import { CapacitorUpdater } from "@capgo/capacitor-updater";

type MobileOtaManifest = {
  version: string;
  url: string;
  checksum?: string;
  notes?: string;
};

const DEFAULT_UPDATE_MANIFEST_URL =
  "https://github.com/higino-neto/lyceum/releases/latest/download/lyceum-mobile-ota.json";

const UPDATE_MANIFEST_URL =
  import.meta.env.VITE_MOBILE_UPDATE_MANIFEST_URL || DEFAULT_UPDATE_MANIFEST_URL;

function compareSemver(left: string, right: string) {
  const leftParts = left.split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = right.split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(leftParts.length, rightParts.length, 3);

  for (let index = 0; index < length; index += 1) {
    const diff = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (diff !== 0) return diff;
  }

  return 0;
}

async function getInstalledBundleVersion() {
  try {
    const current = await CapacitorUpdater.getCurrentBundle();
    if (current.bundle?.version && current.bundle.version !== "builtin") {
      return current.bundle.version;
    }
  } catch {
    // The updater is native-only; web preview and unsupported platforms land here.
  }

  return import.meta.env.VITE_APP_VERSION || "0.0.0";
}

async function fetchManifest() {
  const response = await fetch(`${UPDATE_MANIFEST_URL}?t=${Date.now()}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Mobile update manifest returned ${response.status}`);
  }
  return response.json() as Promise<MobileOtaManifest>;
}

export async function initializeMobileUpdater() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await CapacitorUpdater.notifyAppReady();
  } catch (error) {
    console.warn("[mobile-updater] notifyAppReady failed", error);
  }

  try {
    const manifest = await fetchManifest();
    if (!manifest.version || !manifest.url) return;

    const installedVersion = await getInstalledBundleVersion();
    if (compareSemver(manifest.version, installedVersion) <= 0) return;

    const bundle = await CapacitorUpdater.download({
      version: manifest.version,
      url: manifest.url,
      checksum: manifest.checksum,
    });

    await CapacitorUpdater.next({ id: bundle.id });
    console.info(`[mobile-updater] ${manifest.version} downloaded; it will apply on next background/restart.`);
  } catch (error) {
    console.warn("[mobile-updater] update check failed", error);
  }
}
