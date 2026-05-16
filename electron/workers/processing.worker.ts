import { parentPort, workerData } from "worker_threads";
import fs from "fs";
import {
  extractPdfMetadata,
  generateThumbnail,
  getPdfPageCount,
  type PdfMetadata,
} from "../services/document-processing";

interface ProcessingTask {
  type: "process-file";
  filePath: string;
  fileHash: string;
  thumbnailsDir: string;
  requestId: string;
}

interface ProcessingResult {
  requestId: string;
  success: boolean;
  thumbnailPath?: string;
  metadata?: PdfMetadata;
  numPages?: number;
  fileSize?: number;
  error?: string;
}

async function processFile(task: ProcessingTask): Promise<ProcessingResult> {
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

parentPort?.on("message", async (task: ProcessingTask) => {
  if (task.type === "process-file") {
    const result = await processFile(task);
    parentPort?.postMessage(result);
  }
});

if (workerData?.type === "process-file") {
  processFile(workerData as ProcessingTask).then((result) => {
    parentPort?.postMessage(result);
  });
}
