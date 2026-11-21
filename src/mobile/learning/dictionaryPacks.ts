import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { FileTransfer } from "@capacitor/file-transfer";
import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from "@capacitor-community/sqlite";
import {
  PACK_MANIFEST_URL,
  isPackLanguage,
  lookupInPack,
  packAssetUrl,
  packCatalogEntries,
  parsePackManifest,
  type PackLookupResult,
  type PackManifest,
} from "../../core/dictionary-packs";
import { nativeFetch } from "./mobileHttp";

/**
 * Wiktionary dictionary packs on Android/iOS. The SQLite file is downloaded
 * natively (FileTransfer streams it to disk, with progress) into the app data
 * folder and opened read-only through the native SQLite plugin, so a 150 MB
 * pack never passes through the WebView's memory.
 */

const DIRECTORY = Directory.Data;
const FOLDER = "dictionary-packs";

interface InstalledPack {
  lang: string;
  version: string;
  file: string;
  size: number;
  installedAt: string;
}

const sqlite = new SQLiteConnection(CapacitorSQLite);
const connections = new Map<string, Promise<SQLiteDBConnection>>();
let manifest: PackManifest | null = null;
let manifestLoadedAt = 0;
let installedCache: Record<string, InstalledPack> | null = null;

async function ensureFolder() {
  await Filesystem.mkdir({ path: FOLDER, directory: DIRECTORY, recursive: true }).catch(() => undefined);
}

async function readJson<T>(name: string): Promise<T | null> {
  try {
    const file = await Filesystem.readFile({ path: `${FOLDER}/${name}`, directory: DIRECTORY, encoding: Encoding.UTF8 });
    return JSON.parse(typeof file.data === "string" ? file.data : await file.data.text()) as T;
  } catch {
    return null;
  }
}

async function writeJson(name: string, value: unknown) {
  await ensureFolder();
  await Filesystem.writeFile({ path: `${FOLDER}/${name}`, directory: DIRECTORY, encoding: Encoding.UTF8, data: JSON.stringify(value) });
}

async function readInstalled() {
  installedCache ??= (await readJson<Record<string, InstalledPack>>("installed.json")) ?? {};
  return installedCache;
}

async function writeInstalled(installed: Record<string, InstalledPack>) {
  installedCache = installed;
  await writeJson("installed.json", installed);
}

async function loadManifest(force = false) {
  manifest ??= parsePackManifest(await readJson("manifest.json"));
  if (force || !manifest || Date.now() - manifestLoadedAt > 6 * 3600_000) {
    try {
      const response = await nativeFetch(PACK_MANIFEST_URL);
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      const fresh = parsePackManifest(await response.json());
      if (fresh) {
        manifest = fresh;
        await writeJson("manifest.json", fresh);
      }
      manifestLoadedAt = Date.now();
    } catch (error) {
      console.warn("[DictionaryPacks] manifest refresh failed", error);
      manifestLoadedAt = 0;
    }
  }
  return manifest;
}

/** Absolute filesystem path (no `file://`) for the native SQLite plugin. */
async function absolutePath(path: string) {
  const { uri } = await Filesystem.getUri({ path, directory: DIRECTORY });
  return decodeURIComponent(uri.replace(/^file:\/\//, ""));
}

/** An APK older than 1.12 can receive this code over the air without the native plugins. */
export function packsSupported() {
  return Capacitor.isPluginAvailable("CapacitorSQLite") && Capacitor.isPluginAvailable("FileTransfer");
}

export async function packCatalog() {
  if (!packsSupported()) return [];
  const [current, installed] = await Promise.all([loadManifest(), readInstalled()]);
  return packCatalogEntries(current, (lang) => Boolean(installed[lang]));
}

/** GitHub release assets redirect to a signed URL; resolve it if the native downloader does not follow. */
async function resolveRedirect(url: string) {
  const response = await CapacitorHttp.request({ url, method: "HEAD", connectTimeout: 15_000, readTimeout: 15_000 });
  return response.url || url;
}

export async function downloadPack(lang: string, onProgress: (percent: number) => void) {
  if (!isPackLanguage(lang)) throw new Error(`Unknown dictionary pack: ${lang}`);
  const current = await loadManifest(true);
  const item = current?.packs.find((pack) => pack.lang === lang);
  if (!current || !item) throw new Error("CATALOG_UNAVAILABLE");
  await ensureFolder();
  const partial = `${FOLDER}/${item.file}.part`;
  const target = `${FOLDER}/${item.file}`;
  const url = packAssetUrl(current.version, item.file);
  const path = (await Filesystem.getUri({ path: partial, directory: DIRECTORY })).uri;

  let lastPercent = -1;
  const listener = await FileTransfer.addListener("progress", (status) => {
    const total = status.lengthComputable && status.contentLength > 0 ? status.contentLength : item.size;
    if (!total) return;
    const percent = Math.min(100, Math.floor(status.bytes / total * 100));
    if (percent !== lastPercent) {
      lastPercent = percent;
      onProgress(percent);
    }
  });
  try {
    try {
      await FileTransfer.downloadFile({ url, path, progress: true });
    } catch (error) {
      console.warn("[DictionaryPacks] direct download failed, resolving redirect", error);
      await FileTransfer.downloadFile({ url: await resolveRedirect(url), path, progress: true });
    }
    const stat = await Filesystem.stat({ path: partial, directory: DIRECTORY });
    if (item.size && stat.size !== item.size) throw new Error(`INCOMPLETE_DOWNLOAD (${stat.size}/${item.size})`);
    await closePack(lang);
    await Filesystem.deleteFile({ path: target, directory: DIRECTORY }).catch(() => undefined);
    await Filesystem.rename({ from: partial, to: target, directory: DIRECTORY, toDirectory: DIRECTORY });
  } catch (error) {
    await Filesystem.deleteFile({ path: partial, directory: DIRECTORY }).catch(() => undefined);
    throw error;
  } finally {
    await listener.remove();
  }
  const installed = { ...(await readInstalled()) };
  installed[lang] = { lang, version: current.version, file: item.file, size: item.size, installedAt: new Date().toISOString() };
  await writeInstalled(installed);
}

async function closePack(lang: string) {
  const pending = connections.get(lang);
  connections.delete(lang);
  if (!pending) return;
  try {
    const connection = await pending;
    await connection.close().catch(() => undefined);
    await sqlite.closeNCConnection(await absolutePath(`${FOLDER}/${(await readInstalled())[lang]?.file ?? `${lang}.db`}`)).catch(() => undefined);
  } catch {
    // Already closed.
  }
}

export async function deletePack(lang: string) {
  const installed = { ...(await readInstalled()) };
  const pack = installed[lang];
  await closePack(lang);
  if (pack) await Filesystem.deleteFile({ path: `${FOLDER}/${pack.file}`, directory: DIRECTORY }).catch(() => undefined);
  delete installed[lang];
  await writeInstalled(installed);
  return true;
}

function openPack(lang: string, file: string) {
  let pending = connections.get(lang);
  if (!pending) {
    pending = (async () => {
      const path = await absolutePath(`${FOLDER}/${file}`);
      const existing = await sqlite.isNCConnection(path).catch(() => ({ result: false }));
      const connection = existing.result
        ? await sqlite.retrieveNCConnection(path)
        : await sqlite.createNCConnection(path, 1);
      if (!(await connection.isDBOpen()).result) await connection.open();
      return connection;
    })();
    pending.catch(() => connections.delete(lang));
    connections.set(lang, pending);
  }
  return pending;
}

async function inflateRaw(bytes: Uint8Array) {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Response(stream).text();
}

export async function lookupPack(word: string, lang: string, target: string, lemmaHint?: string | null): Promise<PackLookupResult> {
  const pack = (await readInstalled())[lang];
  if (!pack) return { found: false, query: word, lang, target, entries: [] };
  const connection = await openPack(lang, pack.file);
  return lookupInPack(
    { all: async (sql, params) => ((await connection.query(sql, params)).values ?? []) as Record<string, unknown>[] },
    inflateRaw,
    { word, lang, target, lemmaHint },
  );
}
