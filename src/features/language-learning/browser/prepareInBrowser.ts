import type { LinguisticDocument } from "../../../core/language-learning/model";
import { normalizeLanguageCode } from "../../../core/language-learning/languages/registry";
import { analyzeBook, isCurrentAnalysis, type AnalyzeBookRequest, type AnalyzeBookResult } from "./analyzeBook";
import { readEpubChapters, readTextChapters } from "./sourceChapters";

/**
 * Prepares a book for the learning reader inside a WebView: reads the EPUB/TXT,
 * analyzes it in a worker and caches the linguistic document in IndexedDB, so
 * the next opening is instant. Vocabulary is never stored here.
 */

export type BrowserLearningFormat = "epub" | "txt";

export interface PrepareInBrowserInput {
  cacheKey: string;
  format: BrowserLearningFormat;
  title: string;
  loadBytes(): Promise<Uint8Array>;
  /** User override; otherwise detected from the text. */
  language?: string | null;
  onProgress?(value: number, stage: "import" | "analyze" | "ready"): void;
}

interface CachedDocument {
  key: string;
  document: LinguisticDocument;
  metadataLanguage: string | null;
  detectedLanguage: string | null;
  cachedAt: string;
}

const DB_NAME = "lyceum-learning-documents";

function openCache(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("documents")) request.result.createObjectStore("documents", { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
  });
}

async function cacheGet(key: string): Promise<CachedDocument | null> {
  try {
    const db = await openCache();
    return await new Promise((resolve) => {
      const request = db.transaction("documents", "readonly").objectStore("documents").get(key);
      request.onsuccess = () => resolve((request.result as CachedDocument | undefined) ?? null);
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function cachePut(entry: CachedDocument) {
  try {
    const db = await openCache();
    await new Promise<void>((resolve) => {
      const transaction = db.transaction("documents", "readwrite");
      transaction.objectStore("documents").put(entry);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
      transaction.onabort = () => resolve();
    });
  } catch {
    /* A cache miss only costs a re-analysis. */
  }
}

/** Removes cached analyses (all, or those of one book). */
export async function clearLearningDocumentCache(cacheKeyPrefix?: string) {
  const db = await openCache();
  const transaction = db.transaction("documents", "readwrite");
  const store = transaction.objectStore("documents");
  if (cacheKeyPrefix) store.delete(IDBKeyRange.bound(cacheKeyPrefix, `${cacheKeyPrefix}￿`));
  else store.clear();
}

function runInWorker(request: AnalyzeBookRequest, onProgress: (value: number) => void): Promise<AnalyzeBookResult> {
  if (typeof Worker === "undefined") return Promise.resolve(analyzeBook(request, onProgress));
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL("./analysis.worker.ts", import.meta.url), { type: "module" });
    } catch {
      resolve(analyzeBook(request, onProgress));
      return;
    }
    worker.onmessage = (event: MessageEvent<{ type: "progress"; value: number } | { type: "done"; result: AnalyzeBookResult } | { type: "error"; message: string }>) => {
      const message = event.data;
      if (message.type === "progress") onProgress(message.value);
      else {
        worker.terminate();
        if (message.type === "done") resolve(message.result);
        else reject(new Error(message.message));
      }
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message || "ANALYSIS_FAILED"));
    };
    worker.postMessage(request);
  });
}

export async function prepareLearningDocumentInBrowser(input: PrepareInBrowserInput): Promise<AnalyzeBookResult> {
  const progress = input.onProgress ?? (() => undefined);
  // The "auto" entry remembers which language detection chose for this book.
  const autoKey = `${input.cacheKey}:auto`;
  const key = input.language ? `${input.cacheKey}:${input.language}` : autoKey;
  const cached = await cacheGet(key);
  if (cached && isCurrentAnalysis(cached.document, cached.document.language)) {
    progress(1, "ready");
    return { ...cached, metadataLanguage: cached.metadataLanguage ? normalizeLanguageCode(cached.metadataLanguage) : null };
  }

  progress(0.02, "import");
  const bytes = await input.loadBytes();
  progress(0.1, "import");
  const book = input.format === "epub" ? await readEpubChapters(bytes, input.title) : readTextChapters(bytes, input.title);
  progress(0.2, "analyze");
  const result = await runInWorker(
    { documentId: `mobile:${input.cacheKey}`, book, language: input.language ?? null },
    (value) => progress(0.2 + value * 0.78, "analyze"),
  );
  await cachePut({ key, ...result, cachedAt: new Date().toISOString() });
  progress(1, "ready");
  return result;
}
