import { parentPort, workerData } from "worker_threads";
import { createRequire } from "node:module";
import path from "node:path";
import fs from "fs";
import { PDFDocument } from "pdf-lib";

const require = createRequire(import.meta.url);

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
  metadata?: {
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string;
    creator?: string;
    producer?: string;
    creationDate?: string;
    modificationDate?: string;
  };
  numPages?: number;
  fileSize?: number;
  error?: string;
}

async function generateThumbnail(
  filePath: string,
  fileHash: string,
  thumbnailsDir: string
): Promise<string | null> {
  try {
    const pdfRequire = require("pdf-poppler");

    const findExistingThumbnail = () => {
      const files = fs.readdirSync(thumbnailsDir);
      const matchingFile = files.find(
        (f: string) => f.startsWith(`${fileHash}-`) && f.endsWith(".jpg")
      );
      if (matchingFile) {
        return path.join(thumbnailsDir, matchingFile);
      }
      return null;
    };

    const existingPath = findExistingThumbnail();
    if (existingPath) {
      return existingPath;
    }

    const opts = {
      format: "jpeg",
      out_dir: thumbnailsDir,
      out_prefix: fileHash,
      page: 1,
    };

    await pdfRequire.convert(filePath, opts);
    return findExistingThumbnail();
  } catch (error) {
    console.error("[Worker] Thumbnail generation error:", error);
    return null;
  }
}

async function extractMetadata(
  filePath: string
): Promise<{
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
  creationDate?: string;
  modificationDate?: string;
} | null> {
  try {
    const pdfBytes = fs.readFileSync(filePath);
    const pdfDoc = await PDFDocument.load(pdfBytes, {
      ignoreEncryption: true,
    });

    const formatPdfDate = (pdfDate: string | undefined): string | undefined => {
      if (!pdfDate) return undefined;
      const match = pdfDate.match(/D:(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?/);
      if (match) {
        const year = match[1];
        const month = match[2] || "01";
        const day = match[3] || "01";
        const hour = match[4] || "00";
        const minute = match[5] || "00";
        const second = match[6] || "00";
        return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
      }
      return pdfDate;
    };

    const metadata: {
      title?: string;
      author?: string;
      subject?: string;
      keywords?: string;
      creator?: string;
      producer?: string;
      creationDate?: string;
      modificationDate?: string;
    } = {
      title: undefined,
      author: undefined,
      subject: undefined,
      keywords: undefined,
      creator: undefined,
      producer: undefined,
      creationDate: undefined,
      modificationDate: undefined,
    };

    try {
      const catalog = pdfDoc.catalog as unknown as { get?: (key: string) => unknown } | undefined;
      if (catalog) {
        const infoRef = catalog.get?.("Info");
        if (infoRef) {
          const info = infoRef as { [key: string]: unknown };
          const getStr = (key: string): string | undefined => {
            try {
              const val = info[key];
              return typeof val?.toString === "function" ? val.toString() : undefined;
            } catch {
              return undefined;
            }
          };
          metadata.title = getStr("Title");
          metadata.author = getStr("Author");
          metadata.subject = getStr("Subject");
          metadata.keywords = getStr("Keywords");
          metadata.creator = getStr("Creator");
          metadata.producer = getStr("Producer");
          
          const creationDate = getStr("CreationDate");
          const modDate = getStr("ModDate");
          if (creationDate) metadata.creationDate = formatPdfDate(creationDate);
          if (modDate) metadata.modificationDate = formatPdfDate(modDate);
        }
      }
    } catch (e) {
      console.error("[Worker] Catalog metadata extraction failed:", e);
    }

    return {
      title: metadata.title,
      author: metadata.author,
      subject: metadata.subject,
      keywords: metadata.keywords,
      creator: metadata.creator,
      producer: metadata.producer,
      creationDate: metadata.creationDate,
      modificationDate: metadata.modificationDate,
    };
  } catch (error) {
    console.error("[Worker] Metadata extraction error:", error);
    return null;
  }
}

async function processFile(task: ProcessingTask): Promise<ProcessingResult> {
  const { filePath, fileHash, thumbnailsDir, requestId } = task;

  try {
    if (!fs.existsSync(filePath)) {
      return { requestId, success: false, error: "File not found" };
    }

    const stats = fs.statSync(filePath);
    const numPages = await getPdfPageCount(filePath);
    const metadata = await extractMetadata(filePath);
    const thumbnailPath = await generateThumbnail(filePath, fileHash, thumbnailsDir);

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

async function getPdfPageCount(filePath: string): Promise<number> {
  try {
    const pdfBytes = fs.readFileSync(filePath);
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    return pdfDoc.getPageCount();
  } catch {
    return 1;
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
