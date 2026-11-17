import { CURATED_DICTIONARIES } from "../../core/dictionaries/curated";
import { freeDictCatalog } from "../../core/dictionaries/freedictCatalog";
import {
  isGzipName,
  normalizeLookupWord,
  parseTar,
  pickStarDictFiles,
  readStarDictEntries,
  type TarEntry,
} from "../../core/dictionaries/stardict";
import type { DictionaryCatalogEntry, LearningBridge } from "..";

/**
 * Offline dictionaries for WebView builds, stored in IndexedDB.
 *
 * Same catalog as desktop (curated Lyceum zips + FreeDict StarDict releases)
 * and the same lookup rules, so `OfflineDictionaryProvider` behaves alike on
 * every platform. An entry is only listed as downloaded once all its words are
 * committed, so an interrupted import is never used half-way.
 */

const DB_NAME = "lyceum-dictionaries";
const DB_VERSION = 1;
const BATCH = 4000;

interface CatalogItem extends DictionaryCatalogEntry {
  url: string;
  format: "zip" | "tar.xz";
}

interface InstalledMeta {
  id: string;
  entries: number;
  downloadedAt: string;
}

export interface DictionaryStoreOptions {
  /** Downloads a URL as bytes (native HTTP on Capacitor, to avoid CORS). */
  fetchBytes(url: string): Promise<Uint8Array>;
  factory?: IDBFactory;
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function done(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
  });
}

function catalog(): CatalogItem[] {
  const curated: CatalogItem[] = CURATED_DICTIONARIES.map((dict) => ({ ...dict, format: "zip" }));
  const ids = new Set(curated.map((dict) => dict.id));
  const free: CatalogItem[] = freeDictCatalog()
    .filter((dict) => !ids.has(dict.id))
    .map((dict) => ({ ...dict, format: "tar.xz" }));
  return [...curated, ...free];
}

async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  const { ungzip } = await import("pako");
  return ungzip(bytes);
}

async function unzip(bytes: Uint8Array): Promise<TarEntry[]> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(bytes);
  const files = Object.values(zip.files).filter((file) => !file.dir);
  return Promise.all(files.map(async (file) => ({ name: file.name, data: await file.async("uint8array") })));
}

async function unxz(bytes: Uint8Array): Promise<Uint8Array> {
  const { XzReadableStream } = await import("xz-decompress");
  const input = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
  const reader = new XzReadableStream(input).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done: finished, value } = await reader.read();
    if (finished) break;
    chunks.push(value);
    total += value.length;
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

/** Expands an archive into files, following tarballs nested inside it. */
async function extract(bytes: Uint8Array, format: CatalogItem["format"]): Promise<TarEntry[]> {
  let entries = format === "zip" ? await unzip(bytes) : parseTar(await unxz(bytes));
  for (let depth = 0; depth < 2; depth += 1) {
    const nested = entries.filter((entry) => /\.tar$/i.test(entry.name));
    if (nested.length === 0) break;
    entries = [...entries.filter((entry) => !nested.includes(entry)), ...nested.flatMap((entry) => parseTar(entry.data))];
  }
  return entries;
}

export async function createDictionaryStore(options: DictionaryStoreOptions): Promise<LearningBridge> {
  const request = (options.factory ?? indexedDB).open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "id" });
    if (!db.objectStoreNames.contains("entries")) db.createObjectStore("entries");
  };
  const db = await promisify(request);
  const listeners = new Set<(data: { dictId: string; progress: number }) => void>();
  const progress = (dictId: string, value: number) => listeners.forEach((listener) => listener({ dictId, progress: value }));
  const active = new Map<string, Promise<{ success: boolean; error?: string }>>();

  async function installed(): Promise<Map<string, InstalledMeta>> {
    const rows = await promisify(db.transaction("meta", "readonly").objectStore("meta").getAll()) as InstalledMeta[];
    return new Map(rows.map((row) => [row.id, row]));
  }

  async function removeEntries(id: string) {
    const transaction = db.transaction(["entries", "meta"], "readwrite");
    transaction.objectStore("entries").delete(IDBKeyRange.bound([id, ""], [id, "￿"]));
    transaction.objectStore("meta").delete(id);
    await done(transaction);
  }

  async function install(item: CatalogItem): Promise<{ success: boolean; error?: string }> {
    try {
      progress(item.id, 2);
      const archive = await options.fetchBytes(item.url);
      progress(item.id, 55);
      const files = pickStarDictFiles(await extract(archive, item.format), item.id);
      if (!files) throw new Error("STARDICT_FILES_NOT_FOUND");
      const idx = isGzipName(files.idx.name) ? await gunzip(files.idx.data) : files.idx.data;
      const dict = isGzipName(files.dict.name) ? await gunzip(files.dict.data) : files.dict.data;
      progress(item.id, 70);

      await removeEntries(item.id);
      const seen = new Set<string>();
      let batch: Array<[string, string]> = [];
      let count = 0;
      const writeBatch = async () => {
        if (batch.length === 0) return;
        const transaction = db.transaction("entries", "readwrite");
        const store = transaction.objectStore("entries");
        for (const [word, content] of batch) store.put(content, [item.id, word]);
        await done(transaction);
        batch = [];
      };
      const estimate = Math.max(1, item.headwords ?? 20_000);
      for (const [word, content] of readStarDictEntries(idx, dict)) {
        if (seen.has(word)) continue; // INSERT OR IGNORE on desktop: the first entry wins.
        seen.add(word);
        batch.push([word, content]);
        count += 1;
        if (batch.length >= BATCH) {
          await writeBatch();
          progress(item.id, Math.min(99, 70 + Math.round((count / estimate) * 29)));
        }
      }
      await writeBatch();
      if (count === 0) throw new Error("EMPTY_DICTIONARY");
      const meta: InstalledMeta = { id: item.id, entries: count, downloadedAt: new Date().toISOString() };
      const transaction = db.transaction("meta", "readwrite");
      transaction.objectStore("meta").put(meta);
      await done(transaction);
      progress(item.id, 100);
      return { success: true };
    } catch (error) {
      await removeEntries(item.id).catch(() => undefined);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async function get(id: string, word: string): Promise<string | undefined> {
    return promisify(db.transaction("entries", "readonly").objectStore("entries").get([id, word])) as Promise<string | undefined>;
  }

  return {
    async dictionaryGetIndex() {
      const ready = await installed();
      return catalog().map(({ url: _url, format: _format, ...entry }) => ({ ...entry, isDownloaded: ready.has(entry.id) }));
    },
    async dictionaryLookup(word, dictId) {
      if (!dictId) return { found: false };
      const original = word.trim();
      const normalized = normalizeLookupWord(original);
      if (!normalized) return { found: false };
      const candidates = [...new Set([normalized, original.toLowerCase()])];
      for (const candidate of candidates) {
        const content = await get(dictId, candidate);
        if (content) return { found: true, content };
      }
      return { found: false };
    },
    dictionaryDownload(id) {
      const item = catalog().find((entry) => entry.id === id);
      if (!item) return Promise.resolve({ success: false, error: "UNKNOWN_DICTIONARY" });
      let job = active.get(id);
      if (!job) {
        job = install(item).finally(() => active.delete(id));
        active.set(id, job);
      }
      return job;
    },
    async dictionaryDelete(id) {
      await removeEntries(id);
      return true;
    },
    onDictionaryDownloadProgress(callback) {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },
  };
}
