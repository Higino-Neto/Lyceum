import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import {
  extractEpubMetadata,
  extractPdfMetadata,
  generateThumbnail,
  getCbzPageCount,
  getEpubChapterCount,
  getPdfPageCount,
  type BookFileType,
  type EpubMetadata,
  type GenerateThumbnailOptions,
  type PdfMetadata,
} from "../services/document-processing";
import { generateFileHash, generateFileHashFromBuffer } from "../services/file-service";
import type { EditableBookMetadata } from "../services/book-file-metadata";
import type {
  FileConversionWorkerResult,
  HashFileResult,
  InspectBookResult,
  MetadataMutationWorkerResult,
  WorkerRequest,
  WorkerResponse,
  WorkerTaskKind,
  WorkerTaskPayloads,
  WorkerTaskResults,
} from "./protocol";

const STARTUP_TIMEOUT_MS = 20_000;
const DEFAULT_TASK_TIMEOUT_MS = 2 * 60_000;
const CONVERSION_TIMEOUT_MS = 45 * 60_000;

export class WorkerTaskError extends Error {
  constructor(message: string, readonly taskKind: WorkerTaskKind, readonly workerStack?: string) {
    super(message);
    this.name = "WorkerTaskError";
  }
}

export function resolveProcessingWorkerPath(): string {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const appRoot = process.env.APP_ROOT;
  const candidates = [
    path.resolve(currentDir, "../workers/processing.worker.js"),
    path.resolve(currentDir, "processing.worker.js"),
    appRoot ? path.resolve(appRoot, "dist-electron/workers/processing.worker.js") : "",
    path.resolve(process.cwd(), "dist-electron/workers/processing.worker.js"),
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}

interface RunOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  onProgress?: (progress: number, message?: string) => void;
}

interface PendingTask<K extends WorkerTaskKind = WorkerTaskKind> {
  request: WorkerRequest<WorkerTaskPayloads[K]>;
  resolve: (value: WorkerTaskResults[K]) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
  signal?: AbortSignal;
  abortListener?: () => void;
  onProgress?: RunOptions["onProgress"];
  slot?: WorkerSlot;
}

interface WorkerSlot {
  worker: Worker;
  ready: boolean;
  busy: boolean;
  startupTimeout: ReturnType<typeof setTimeout>;
  current?: PendingTask;
}

class ProcessingWorkerPool {
  private slots = new Set<WorkerSlot>();
  private queue: PendingTask[] = [];
  private counter = 0;
  private disposed = false;

  constructor(private readonly size: number, private readonly workerPath: string) {
    if (!fs.existsSync(workerPath)) throw new Error(`Processing worker bundle not found: ${workerPath}`);
    this.spawnWorker();
  }

  get available() {
    return !this.disposed && this.slots.size > 0;
  }

  run<K extends WorkerTaskKind>(kind: K, payload: WorkerTaskPayloads[K], options: RunOptions = {}): Promise<WorkerTaskResults[K]> {
    if (this.disposed) return Promise.reject(new Error("Processing worker pool is disposed"));
    const requestId = `worker-${process.pid}-${Date.now().toString(36)}-${++this.counter}`;
    return new Promise<WorkerTaskResults[K]>((resolve, reject) => {
      const timeoutMs = options.timeoutMs ?? (kind.startsWith("convert-") ? CONVERSION_TIMEOUT_MS : DEFAULT_TASK_TIMEOUT_MS);
      const task = {
        request: { requestId, kind, payload },
        resolve,
        reject,
        signal: options.signal,
        onProgress: options.onProgress,
        timeout: setTimeout(() => this.cancelTask(requestId, new Error(`Worker task timed out after ${timeoutMs} ms: ${kind}`)), timeoutMs),
      } as PendingTask<K>;
      if (options.signal?.aborted) {
        clearTimeout(task.timeout);
        reject(new DOMException("Worker task aborted", "AbortError"));
        return;
      }
      if (options.signal) {
        task.abortListener = () => this.cancelTask(requestId, new DOMException("Worker task aborted", "AbortError"));
        options.signal.addEventListener("abort", task.abortListener, { once: true });
      }
      this.queue.push(task as PendingTask);
      this.scaleToDemand();
      this.pump();
    });
  }

  dispose() {
    this.disposed = true;
    const error = new Error("Processing worker pool disposed");
    for (const task of this.queue) this.finishTask(task, error);
    this.queue = [];
    for (const slot of this.slots) {
      clearTimeout(slot.startupTimeout);
      if (slot.current) this.finishTask(slot.current, error);
      void slot.worker.terminate();
    }
    this.slots.clear();
  }

  private spawnWorker() {
    if (this.disposed) return;
    const worker = new Worker(this.workerPath, { name: "lyceum-processing" });
    const slot: WorkerSlot = {
      worker,
      ready: false,
      busy: false,
      startupTimeout: setTimeout(() => this.handleWorkerFailure(slot, new Error("Processing worker startup timed out")), STARTUP_TIMEOUT_MS),
    };
    this.slots.add(slot);
    worker.on("message", (message: WorkerResponse) => this.handleMessage(slot, message));
    worker.on("error", (error) => this.handleWorkerFailure(slot, error));
    worker.on("exit", (code) => {
      if (!this.disposed && this.slots.has(slot)) this.handleWorkerFailure(slot, new Error(`Processing worker exited with code ${code}`));
    });
  }

  private handleMessage(slot: WorkerSlot, message: WorkerResponse) {
    if (message.type === "ready") {
      clearTimeout(slot.startupTimeout);
      slot.ready = true;
      this.pump();
      return;
    }
    if (message.type === "progress") {
      slot.current?.onProgress?.(message.progress, message.message);
      return;
    }
    const task = slot.current;
    if (!task || task.request.requestId !== message.requestId) return;
    slot.current = undefined;
    slot.busy = false;
    if (message.success) this.finishTask(task, undefined, message.value);
    else if ("error" in message) this.finishTask(task, new WorkerTaskError(message.error, task.request.kind, message.stack));
    this.pump();
  }

  private handleWorkerFailure(slot: WorkerSlot, error: Error) {
    if (!this.slots.delete(slot)) return;
    clearTimeout(slot.startupTimeout);
    if (slot.current) this.finishTask(slot.current, error);
    void slot.worker.terminate().catch(() => undefined);
    if (!this.disposed) {
      setTimeout(() => {
        if (!this.disposed && this.slots.size < this.size) {
          this.spawnWorker();
          this.scaleToDemand();
        }
      }, 100);
    }
  }

  private cancelTask(requestId: string, error: Error) {
    const queuedIndex = this.queue.findIndex((task) => task.request.requestId === requestId);
    if (queuedIndex >= 0) {
      const [task] = this.queue.splice(queuedIndex, 1);
      this.finishTask(task, error);
      return;
    }
    const slot = Array.from(this.slots).find((candidate) => candidate.current?.request.requestId === requestId);
    if (slot?.current) {
      this.finishTask(slot.current, error);
      slot.current = undefined;
      this.handleWorkerFailure(slot, error);
    }
  }

  private finishTask(task: PendingTask, error?: Error, value?: unknown) {
    clearTimeout(task.timeout);
    if (task.signal && task.abortListener) task.signal.removeEventListener("abort", task.abortListener);
    if (error) task.reject(error);
    else task.resolve(value as never);
  }

  private pump() {
    if (this.disposed) return;
    for (const slot of this.slots) {
      if (!slot.ready || slot.busy || this.queue.length === 0) continue;
      const task = this.queue.shift()!;
      slot.busy = true;
      slot.current = task;
      task.slot = slot;
      slot.worker.postMessage(task.request);
    }
  }

  private scaleToDemand() {
    const busyCount = Array.from(this.slots).filter((slot) => slot.busy).length;
    const demand = busyCount + this.queue.length;
    while (!this.disposed && this.slots.size < this.size && this.slots.size < demand) this.spawnWorker();
  }
}

let pool: ProcessingWorkerPool | null = null;

function getPool() {
  if (pool?.available) return pool;
  const workerPath = resolveProcessingWorkerPath();
  if (!fs.existsSync(workerPath)) return null;
  const cpuCount = os.availableParallelism?.() || os.cpus().length || 2;
  const size = Math.max(1, Math.min(4, cpuCount - 1));
  try {
    pool = new ProcessingWorkerPool(size, workerPath);
    return pool;
  } catch (error) {
    console.error("[processingClient] Could not start processing workers:", error);
    return null;
  }
}

export function runProcessingTask<K extends WorkerTaskKind>(kind: K, payload: WorkerTaskPayloads[K], options?: RunOptions) {
  const activePool = getPool();
  if (!activePool) return Promise.reject(new Error(`Processing worker is unavailable at ${resolveProcessingWorkerPath()}`));
  return activePool.run(kind, payload, options);
}

export async function checkProcessingWorkers() {
  const result = await runProcessingTask("ping", {}, { timeoutMs: STARTUP_TIMEOUT_MS });
  return result.pong;
}

export function disposeProcessingWorkers() {
  pool?.dispose();
  pool = null;
}

function inferFileType(filePath: string): BookFileType {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".epub") return "epub";
  if (extension === ".cbz") return "cbz";
  if (extension === ".azw3") return "azw3";
  if (extension === ".kfx") return "kfx";
  return "pdf";
}

export async function hashFile(filePath: string): Promise<HashFileResult> {
  try {
    return await runProcessingTask("hash-file", { filePath });
  } catch (error) {
    console.warn("[processingClient] hash worker failed; using main-thread fallback:", error);
    const stats = await fs.promises.stat(filePath);
    return { fileHash: generateFileHash(filePath), fileSize: stats.size };
  }
}

export async function findFileByHashInWorker(fileHash: string, searchPaths: string[]) {
  return (await runProcessingTask("find-file-by-hash", { fileHash, searchPaths })).filePath || null;
}

export async function readAndHash(filePath: string): Promise<HashFileResult & { buffer: ArrayBuffer }> {
  try {
    return await runProcessingTask("hash-file", { filePath, includeBuffer: true }) as HashFileResult & { buffer: ArrayBuffer };
  } catch (error) {
    console.warn("[processingClient] read/hash worker failed; using main-thread fallback:", error);
    const nodeBuffer = await fs.promises.readFile(filePath);
    const bytes = Uint8Array.from(nodeBuffer);
    return { buffer: bytes.buffer.slice(0), fileHash: generateFileHashFromBuffer(bytes), fileSize: nodeBuffer.length };
  }
}

export interface OpenFileInput { filePath: string; thumbnailsDir: string; fileType: BookFileType; force?: boolean }

export async function openAndProcess(input: OpenFileInput): Promise<InspectBookResult & { buffer: ArrayBuffer }> {
  try {
    return await runProcessingTask("inspect-book", {
      ...input,
      includeBuffer: true,
      includeMetadata: true,
      includeThumbnail: true,
    }) as InspectBookResult & { buffer: ArrayBuffer };
  } catch (error) {
    console.warn("[processingClient] inspection worker failed; using main-thread fallback:", error);
    const base = await readAndHash(input.filePath);
    const [metadata, numPages, thumbnailPath] = await Promise.all([
      input.fileType === "pdf" ? extractPdfMetadata(input.filePath) : input.fileType === "epub" ? extractEpubMetadata(input.filePath) : null,
      input.fileType === "pdf" ? getPdfPageCount(input.filePath) : input.fileType === "epub" ? getEpubChapterCount(input.filePath) : input.fileType === "cbz" ? getCbzPageCount(input.filePath) : undefined,
      generateThumbnail(input.filePath, base.fileHash, { thumbnailsDir: input.thumbnailsDir, force: input.force, fileType: input.fileType }),
    ]);
    return { ...base, metadata: metadata || undefined, numPages, thumbnailPath: thumbnailPath || undefined };
  }
}

export async function inspectBookFile(input: WorkerTaskPayloads["inspect-book"]): Promise<InspectBookResult> {
  return runProcessingTask("inspect-book", input);
}

export async function generateThumbnailInWorker(filePath: string, fileHash: string, options: GenerateThumbnailOptions) {
  const fileType = options.fileType || inferFileType(filePath);
  try {
    return (await runProcessingTask("generate-thumbnail", {
      filePath,
      fileHash,
      thumbnailsDir: options.thumbnailsDir,
      fileType,
      force: options.force,
    })).thumbnailPath || null;
  } catch (error) {
    console.warn("[processingClient] thumbnail worker failed; using main-thread fallback:", error);
    return generateThumbnail(filePath, fileHash, options);
  }
}

export async function convertViaLyceumInWorker(payload: WorkerTaskPayloads["convert-via-lyceum"], options?: RunOptions) {
  return runProcessingTask("convert-via-lyceum", payload, { timeoutMs: CONVERSION_TIMEOUT_MS, ...options });
}

export async function convertPdfToEpubInWorker(payload: WorkerTaskPayloads["convert-pdf-to-epub"], options?: RunOptions) {
  return runProcessingTask("convert-pdf-to-epub", payload, { timeoutMs: CONVERSION_TIMEOUT_MS, ...options });
}

export async function convertEpubToPdfInWorker(payload: WorkerTaskPayloads["convert-epub-to-pdf"], options?: RunOptions) {
  return runProcessingTask("convert-epub-to-pdf", payload, { timeoutMs: CONVERSION_TIMEOUT_MS, ...options });
}

export async function extractVocabularyInWorker(filePath: string) {
  return (await runProcessingTask("extract-vocabulary", { filePath })).words;
}

export async function writeBookMetadataInWorker(filePath: string, fileType: string | null | undefined, metadata: EditableBookMetadata) {
  return runProcessingTask("write-book-metadata", { filePath, fileType, metadata });
}

export async function applyBookCoverInWorker(payload: WorkerTaskPayloads["apply-book-cover"]): Promise<MetadataMutationWorkerResult> {
  return runProcessingTask("apply-book-cover", payload, { timeoutMs: CONVERSION_TIMEOUT_MS });
}

export async function prepareCoverImageInWorker(sourcePath: string, outputPath: string) {
  return (await runProcessingTask("prepare-cover-image", { sourcePath, outputPath })).outputPath;
}

export async function validateAzw3InWorker(filePath: string) {
  return runProcessingTask("validate-azw3", { filePath });
}

export type { BookFileType, PdfMetadata, EpubMetadata, FileConversionWorkerResult };
