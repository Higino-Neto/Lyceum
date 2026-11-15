import fs from "node:fs";
import path from "node:path";
import electron from "electron";
import type { BookFormat } from "../../src/lib/lyceum/schema/types";
import { convertViaLyceumInWorker } from "../workers/processingClient";

const { app } = electron;

/**
 * The reader only renders PDF and EPUB. Every other library format is turned
 * into an EPUB once (through the same Lyceum pipeline the Conversion screen
 * uses) and cached by content hash, so reopening the book is instant and
 * reading progress stays attached to the original file's hash.
 */

export type ReaderErrorCode =
  | "drm"
  | "kfx"
  | "unsupported"
  | "rar-extractor-missing"
  | "corrupt"
  | "conversion-failed";

export class ReaderOpenError extends Error {
  constructor(readonly code: ReaderErrorCode, message: string) {
    super(message);
    this.name = "ReaderOpenError";
  }
}

export type ReaderStrategy =
  | { kind: "pdf" }
  | { kind: "epub" }
  | { kind: "convert"; format: BookFormat }
  | { kind: "print-replica" }
  | { kind: "unsupported"; code: ReaderErrorCode };

/** Bump when the importers change enough that cached EPUBs should be rebuilt. */
const READER_CACHE_VERSION = 1;
const MAX_CACHE_ENTRIES = 40;

const CONVERTIBLE_EXTENSIONS: Record<string, BookFormat> = {
  ".mobi": "mobi",
  ".azw": "azw",
  ".azw3": "azw3",
  ".prc": "prc",
  ".txt": "txt",
  ".html": "html",
  ".htm": "html",
  ".docx": "docx",
  ".fb2": "fb2",
  ".cbz": "cbz",
  ".cbr": "cbr",
};

export function readerStrategyForPath(filePath: string): ReaderStrategy {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".pdf")) return { kind: "pdf" };
  if (lower.endsWith(".epub")) return { kind: "epub" };
  if (lower.endsWith(".fb2.zip")) return { kind: "convert", format: "fb2" };
  const extension = path.extname(lower);
  if (extension === ".azw4") return { kind: "print-replica" };
  if (extension === ".kfx") return { kind: "unsupported", code: "kfx" };
  const format = CONVERTIBLE_EXTENSIONS[extension];
  return format ? { kind: "convert", format } : { kind: "unsupported", code: "unsupported" };
}

/** True for formats the reader can open, natively or through conversion. */
export function isReaderSupportedPath(filePath: string): boolean {
  return readerStrategyForPath(filePath).kind !== "unsupported";
}

function cacheDir() {
  return path.join(app.getPath("userData"), "reader-cache");
}

const inFlight = new Map<string, Promise<string>>();

async function touch(filePath: string) {
  const now = new Date();
  await fs.promises.utimes(filePath, now, now).catch(() => undefined);
}

async function pruneCache(keep: string) {
  try {
    const directory = cacheDir();
    const entries = await Promise.all((await fs.promises.readdir(directory)).map(async (name) => {
      const fullPath = path.join(directory, name);
      const stat = await fs.promises.stat(fullPath);
      return { fullPath, mtime: stat.mtimeMs, isFile: stat.isFile() };
    }));
    const files = entries.filter((entry) => entry.isFile && entry.fullPath !== keep).sort((a, b) => b.mtime - a.mtime);
    for (const stale of files.slice(MAX_CACHE_ENTRIES - 1)) {
      await fs.promises.rm(stale.fullPath, { force: true });
    }
  } catch (error) {
    console.warn("[ReaderFormat] cache prune failed:", error);
  }
}

/** Finds the embedded PDF of a Print Replica (AZW4) book. */
function extractPrintReplicaPdf(buffer: Buffer): Buffer | null {
  if (buffer.length < 86 || buffer.toString("ascii", 60, 68) !== "BOOKMOBI") return null;
  const count = buffer.readUInt16BE(76);
  for (let index = 0; index < count; index += 1) {
    const start = buffer.readUInt32BE(78 + index * 8);
    const end = index + 1 < count ? buffer.readUInt32BE(78 + (index + 1) * 8) : buffer.length;
    if (end > start && buffer.toString("latin1", start, start + 5) === "%PDF-") {
      return buffer.subarray(start, end);
    }
  }
  return null;
}

function toReaderError(error: unknown): ReaderOpenError {
  if (error instanceof ReaderOpenError) return error;
  const message = error instanceof Error ? error.message : String(error);
  const code = /\[lyceum:([a-z-]+)\]/.exec(message)?.[1];
  if (code === "drm") return new ReaderOpenError("drm", message);
  if (code === "rar-extractor-missing") return new ReaderOpenError("rar-extractor-missing", message);
  if (code === "corrupt" || code === "unsupported-compression" || code === "no-content") {
    return new ReaderOpenError("corrupt", message);
  }
  return new ReaderOpenError("conversion-failed", message);
}

async function buildCachedCopy(
  sourcePath: string,
  fileHash: string,
  strategy: ReaderStrategy,
  cachePath: string,
): Promise<string> {
  await fs.promises.mkdir(cacheDir(), { recursive: true });
  const tempOutput = `${cachePath}.${process.pid}.tmp`;
  try {
    if (strategy.kind === "print-replica") {
      const pdf = extractPrintReplicaPdf(await fs.promises.readFile(sourcePath));
      if (!pdf) throw new ReaderOpenError("corrupt", "AZW4 sem PDF embutido.");
      await fs.promises.writeFile(tempOutput, pdf);
    } else if (strategy.kind === "convert") {
      const packageRoot = path.join(app.getPath("temp"), "lyceum-reader", `${fileHash}-${Date.now()}`);
      try {
        await convertViaLyceumInWorker({
          sourcePath,
          sourceFormat: strategy.format,
          targetFormat: "epub",
          packageRoot,
          outputPath: tempOutput,
        });
      } finally {
        await fs.promises.rm(packageRoot, { recursive: true, force: true }).catch(() => undefined);
      }
    }
    await fs.promises.rename(tempOutput, cachePath);
    void pruneCache(cachePath);
    return cachePath;
  } catch (error) {
    await fs.promises.rm(tempOutput, { force: true }).catch(() => undefined);
    throw toReaderError(error);
  }
}

export interface ReaderCopy {
  /** File the reader should load (the original for PDF/EPUB). */
  readPath: string;
  fileType: "pdf" | "epub";
  converted: boolean;
}

/**
 * Returns a file the reader can render for `sourcePath`. Throws
 * {@link ReaderOpenError} with a code the UI can translate.
 */
export async function prepareReaderCopy(sourcePath: string, fileHash: string): Promise<ReaderCopy> {
  const strategy = readerStrategyForPath(sourcePath);
  if (strategy.kind === "pdf" || strategy.kind === "epub") {
    return { readPath: sourcePath, fileType: strategy.kind, converted: false };
  }
  if (strategy.kind === "unsupported") {
    throw new ReaderOpenError(strategy.code, `Formato nao suportado no leitor: ${path.extname(sourcePath)}`);
  }

  const fileType = strategy.kind === "print-replica" ? "pdf" : "epub";
  const cachePath = path.join(cacheDir(), `${fileHash}-v${READER_CACHE_VERSION}.${fileType}`);
  if (fs.existsSync(cachePath)) {
    await touch(cachePath);
    return { readPath: cachePath, fileType, converted: true };
  }

  let pending = inFlight.get(cachePath);
  if (!pending) {
    pending = buildCachedCopy(sourcePath, fileHash, strategy, cachePath).finally(() => inFlight.delete(cachePath));
    inFlight.set(cachePath, pending);
  }
  return { readPath: await pending, fileType, converted: true };
}
