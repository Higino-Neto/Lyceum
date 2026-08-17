import os from "node:os";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import {
  generateThumbnail,
  getPdfPageCount,
  getEpubChapterCount,
  type BookFileType,
  type PdfMetadata,
} from "../services/document-processing";
import { generateFileHashFromBuffer } from "../services/file-service";

const WORKER_PATH = fileURLToPath(new URL("./processing.worker.js", import.meta.url));

export interface ReadFileResult {
  buffer: ArrayBuffer;
  fileHash: string;
  fileSize: number;
}

export interface OpenFileResult extends ReadFileResult {
  thumbnailPath?: string;
  numPages?: number;
  metadata?: PdfMetadata;
}

export interface OpenFileInput {
  filePath: string;
  thumbnailsDir: string;
  fileType: BookFileType;
  force?: boolean;
}

function inferFileType(filePath: string): BookFileType {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".epub")) return "epub";
  if (lower.endsWith(".cbz")) return "cbz";
  if (lower.endsWith(".azw3")) return "azw3";
  if (lower.endsWith(".kfx")) return "kfx";
  return "pdf";
}

// ---------------------------------------------------------------------------
// Main-thread fallback (used when workers are unavailable or crash)
// ---------------------------------------------------------------------------

async function readAndHashMainThread(filePath: string): Promise<ReadFileResult> {
  const nodeBuffer = await fs.promises.readFile(filePath);
  const uint8 = Uint8Array.from(nodeBuffer);
  return {
    buffer: uint8.buffer.slice(0) as ArrayBuffer,
    fileHash: generateFileHashFromBuffer(uint8),
    fileSize: nodeBuffer.length,
  };
}

async function openAndProcessMainThread(input: OpenFileInput): Promise<OpenFileResult> {
  const base = await readAndHashMainThread(input.filePath);
  const numPages =
    input.fileType === "epub"
      ? await getEpubChapterCount(input.filePath)
      : input.fileType === "pdf"
        ? await getPdfPageCount(input.filePath)
        : undefined;

  const thumbnailPath = await generateThumbnail(input.filePath, base.fileHash, {
    thumbnailsDir: input.thumbnailsDir,
    force: Boolean(input.force),
    fileType: input.fileType,
  });

  return {
    ...base,
    thumbnailPath: thumbnailPath || undefined,
    numPages,
  };
}

// ---------------------------------------------------------------------------
// Worker pool
// ---------------------------------------------------------------------------

interface WorkerOpenFileTask {
  type: "open-file";
  filePath: string;
  fileType: BookFileType;
  thumbnailsDir?: string;
  includeBuffer?: boolean;
  computeMeta?: boolean;
  force?: boolean;
  requestId: string;
}

interface PendingTask {
  task: WorkerOpenFileTask;
  resolve: (value: OpenFileResult) => void;
  reject: (reason: Error) => void;
}

interface WorkerMessage extends OpenFileResult {
  requestId: string;
  success: boolean;
  error?: string;
}

class ProcessingWorkerPool {
  private workers: Worker[] = [];
  private idle: Worker[] = [];
  private busy = new Set<Worker>();
  private queue: PendingTask[] = [];
  private callbacks = new Map<string, PendingTask>();
  private counter = 0;
  private disposed = false;

  constructor(size: number) {
    for (let i = 0; i < size; i += 1) {
      this.workers.push(this.createWorker());
    }
  }

  get available(): boolean {
    return !this.disposed && this.workers.length > 0;
  }

  run(task: Omit<WorkerOpenFileTask, "requestId" | "type">): Promise<OpenFileResult> {
    const requestId = `t${++this.counter}`;
    const fullTask: WorkerOpenFileTask = { ...task, requestId, type: "open-file" };

    return new Promise<OpenFileResult>((resolve, reject) => {
      const item: PendingTask = { task: fullTask, resolve, reject };
      this.callbacks.set(requestId, item);
      this.dispatch(item);
    });
  }

  dispose(): void {
    this.disposed = true;
    for (const worker of this.workers) {
      try {
        worker.terminate();
      } catch {
        // ignore
      }
    }
    this.workers = [];
    this.idle = [];
    this.busy.clear();
    this.queue = [];
  }

  private createWorker(): Worker {
    const worker = new Worker(WORKER_PATH);
    worker.on("message", (message: WorkerMessage) => this.onMessage(worker, message));
    worker.on("error", (error) => this.onWorkerFailure(worker, error));
    worker.on("exit", (code) => {
      if (code !== 0) this.onWorkerFailure(worker, new Error(`Worker exited with code ${code}`));
    });
    this.idle.push(worker);
    return worker;
  }

  private onMessage(worker: Worker, message: WorkerMessage): void {
    const item = this.callbacks.get(message.requestId);
    if (item) {
      this.callbacks.delete(message.requestId);
      if (message.success === false) {
        item.reject(new Error(message.error || "Worker task failed"));
      } else {
        item.resolve(message);
      }
    }
    this.returnWorker(worker);
  }

  private onWorkerFailure(worker: Worker, error: Error): void {
    this.busy.delete(worker);
    this.idle = this.idle.filter((entry) => entry !== worker);
    this.workers = this.workers.filter((entry) => entry !== worker);
    try {
      worker.terminate();
    } catch {
      // ignore
    }

    if (this.workers.length === 0) {
      this.failAll(error);
    }
  }

  private failAll(error: Error): void {
    for (const item of this.callbacks.values()) {
      item.reject(error);
    }
    this.callbacks.clear();
    this.queue = [];
  }

  private returnWorker(worker: Worker): void {
    this.busy.delete(worker);
    if (this.disposed) {
      try {
        worker.terminate();
      } catch {
        // ignore
      }
      return;
    }
    this.idle.push(worker);
    this.pump();
  }

  private dispatch(item: PendingTask): void {
    const worker = this.idle.pop();
    if (worker) {
      this.busy.add(worker);
      worker.postMessage(item.task);
    } else {
      this.queue.push(item);
    }
  }

  private pump(): void {
    while (this.idle.length > 0 && this.queue.length > 0) {
      const worker = this.idle.pop() as Worker;
      const item = this.queue.shift() as PendingTask;
      this.busy.add(worker);
      worker.postMessage(item.task);
    }
  }
}

let pool: ProcessingWorkerPool | null = null;
let poolDisabled = false;

function workerUsable(): boolean {
  if (poolDisabled) return false;
  if (!fs.existsSync(WORKER_PATH)) return false;
  return true;
}

function getPool(): ProcessingWorkerPool | null {
  if (!workerUsable()) {
    poolDisabled = true;
    return null;
  }
  if (!pool) {
    const size = Math.max(1, Math.min(4, (os.cpus().length || 4) - 1));
    try {
      pool = new ProcessingWorkerPool(size);
    } catch (error) {
      console.error("[processingClient] Failed to create worker pool:", error);
      poolDisabled = true;
      return null;
    }
  }
  return pool;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function readAndHash(filePath: string): Promise<ReadFileResult> {
  const poolInstance = getPool();
  if (poolInstance) {
    try {
      const result = await poolInstance.run({
        filePath,
        fileType: inferFileType(filePath),
        includeBuffer: true,
        computeMeta: false,
      });
      return {
        buffer: result.buffer as ArrayBuffer,
        fileHash: result.fileHash as string,
        fileSize: result.fileSize as number,
      };
    } catch (error) {
      console.warn("[processingClient] Worker readAndHash failed, falling back to main thread:", error);
      poolDisabled = true;
    }
  }
  return readAndHashMainThread(filePath);
}

export async function openAndProcess(input: OpenFileInput): Promise<OpenFileResult> {
  const poolInstance = getPool();
  if (poolInstance) {
    try {
      const result = await poolInstance.run({
        filePath: input.filePath,
        fileType: input.fileType,
        thumbnailsDir: input.thumbnailsDir,
        includeBuffer: true,
        computeMeta: true,
        force: Boolean(input.force),
      });
      return {
        buffer: result.buffer as ArrayBuffer,
        fileHash: result.fileHash as string,
        fileSize: result.fileSize as number,
        thumbnailPath: result.thumbnailPath,
        numPages: result.numPages,
        metadata: result.metadata,
      };
    } catch (error) {
      console.warn("[processingClient] Worker openAndProcess failed, falling back to main thread:", error);
      poolDisabled = true;
    }
  }
  return openAndProcessMainThread(input);
}
