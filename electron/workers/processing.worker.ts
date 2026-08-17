import { parentPort, workerData } from "worker_threads";
import fs from "node:fs";
import crypto from "node:crypto";
import {
  extractPdfMetadata,
  generateThumbnail,
  getPdfPageCount,
  getEpubChapterCount,
  type PdfMetadata,
  type BookFileType,
} from "../services/document-processing";

interface ProcessFileTask {
  type: "process-file";
  filePath: string;
  fileHash: string;
  thumbnailsDir: string;
  requestId: string;
}

interface OpenFileTask {
  type: "open-file";
  filePath: string;
  thumbnailsDir: string;
  fileType: BookFileType;
  includeBuffer?: boolean;
  computeMeta?: boolean;
  force?: boolean;
  requestId: string;
}

type WorkerTask = ProcessFileTask | OpenFileTask;

interface OpenFileResult {
  requestId: string;
  success: boolean;
  buffer?: ArrayBuffer;
  fileHash?: string;
  fileSize?: number;
  thumbnailPath?: string;
  numPages?: number;
  metadata?: PdfMetadata;
  error?: string;
}

function sha256(buffer: Uint8Array): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function openFile(task: OpenFileTask): Promise<OpenFileResult> {
  const {
    filePath,
    thumbnailsDir,
    fileType,
    includeBuffer = true,
    computeMeta = false,
    force = false,
    requestId,
  } = task;

  try {
    if (!fs.existsSync(filePath)) {
      return { requestId, success: false, error: "File not found" };
    }

    const nodeBuffer = await fs.promises.readFile(filePath);
    const uint8 = Uint8Array.from(nodeBuffer);
    const fileHash = sha256(uint8);
    const arrayBuffer = uint8.buffer.slice(0) as ArrayBuffer;

    const result: OpenFileResult = {
      requestId,
      success: true,
      fileHash,
      fileSize: nodeBuffer.length,
    };

    if (includeBuffer) {
      result.buffer = arrayBuffer;
    }

    if (computeMeta) {
      const numPages =
        fileType === "epub"
          ? await getEpubChapterCount(filePath)
          : fileType === "pdf"
            ? await getPdfPageCount(filePath)
            : undefined;

      const thumbnailPath = await generateThumbnail(filePath, fileHash, {
        thumbnailsDir,
        force,
        fileType,
        logPrefix: "[Worker]",
      });

      result.numPages = numPages;
      result.thumbnailPath = thumbnailPath || undefined;
    }

    return result;
  } catch (error) {
    return { requestId, success: false, error: String(error) };
  }
}

async function processFile(task: ProcessFileTask): Promise<OpenFileResult> {
  const { filePath, fileHash, thumbnailsDir, requestId } = task;

  try {
    if (!fs.existsSync(filePath)) {
      return { requestId, success: false, error: "File not found" };
    }

    const stats = fs.statSync(filePath);
    const numPages = await getPdfPageCount(filePath);
    const metadata = await extractPdfMetadata(filePath, "[Worker]");
    const thumbnailPath = await generateThumbnail(filePath, fileHash, {
      thumbnailsDir,
      logPrefix: "[Worker]",
    });

    return {
      requestId,
      success: true,
      thumbnailPath: thumbnailPath || undefined,
      metadata: metadata || undefined,
      numPages,
      fileSize: stats.size,
    };
  } catch (error) {
    return { requestId, success: false, error: String(error) };
  }
}

async function handleTask(task: WorkerTask): Promise<{ result: OpenFileResult; transfer?: ArrayBuffer[] }> {
  if (task.type === "open-file") {
    const result = await openFile(task);
    return { result, transfer: result.buffer ? [result.buffer] : [] };
  }
  const result = await processFile(task);
  return { result };
}

parentPort?.on("message", async (task: WorkerTask) => {
  const { result, transfer } = await handleTask(task);
  if (transfer && transfer.length > 0) {
    parentPort?.postMessage(result, transfer);
  } else {
    parentPort?.postMessage(result);
  }
});

if (workerData?.type === "process-file") {
  processFile(workerData as ProcessFileTask).then((result) => {
    parentPort?.postMessage(result);
  });
}
