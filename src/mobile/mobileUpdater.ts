import { Capacitor } from "@capacitor/core";
import { CapacitorUpdater } from "@capgo/capacitor-updater";
import { fetchLatestMobileReleaseJson, fetchWithTimeout } from "./githubReleaseResolver";

type MobileOtaManifest = {
  version: string;
  url: string;
  checksum?: string;
  notes?: string;
};

export function parseMobileOtaManifest(value: unknown): MobileOtaManifest {
  if (!value || typeof value !== "object") throw new Error("Manifesto OTA invalido");
  const record = value as Partial<MobileOtaManifest>;
  const version = typeof record.version === "string" ? record.version.trim() : "";
  const url = typeof record.url === "string" ? record.url.trim() : "";
  const checksum = typeof record.checksum === "string" ? record.checksum.trim().toLowerCase() : "";
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) throw new Error("Manifesto OTA sem versao valida");
  if (!url.startsWith("https://")) throw new Error("Manifesto OTA sem URL HTTPS valida");
  if (!/^[a-f0-9]{64}$/.test(checksum)) throw new Error("Manifesto OTA sem checksum SHA-256 valido");
  return {
    version,
    url,
    checksum,
    notes: typeof record.notes === "string" ? record.notes : undefined,
  };
}

const UPDATE_MANIFEST_URL =
  import.meta.env.VITE_MOBILE_UPDATE_MANIFEST_URL?.trim();

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
    const current = await CapacitorUpdater.current();
    if (current.bundle?.version && current.bundle.version !== "builtin") {
      return current.bundle.version;
    }
  } catch {
    // The updater is native-only; web preview and unsupported platforms land here.
  }

  return import.meta.env.VITE_APP_VERSION || "0.0.0";
}

async function fetchManifest() {
  if (!UPDATE_MANIFEST_URL) {
    return parseMobileOtaManifest(await fetchLatestMobileReleaseJson("lyceum-mobile-ota.json"));
  }
  if (!UPDATE_MANIFEST_URL.startsWith("https://")) throw new Error("A URL do OTA precisa usar HTTPS");
  const response = await fetchWithTimeout(`${UPDATE_MANIFEST_URL}?t=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Mobile update manifest returned ${response.status}`);
  return parseMobileOtaManifest(await response.json());
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
    if (!manifest.version || !manifest.url || !manifest.url.startsWith("https://")) return;

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
