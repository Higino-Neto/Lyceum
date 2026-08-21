import { parentPort, threadId } from "node:worker_threads";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { PDFDocument } from "pdf-lib";
import {
  extractEpubMetadata,
  extractPdfMetadata,
  generateThumbnail,
  getCbzPageCount,
  getEpubChapterCount,
  getPdfPageCount,
  validateCbzFile,
} from "../services/document-processing";
import {
  setBookCoverInFile,
  writeBookMetadataToFile,
  writeCoverImageFile,
  writeThumbnailFile,
} from "../services/book-file-metadata";
import { extractVocabularyFromEpub } from "../services/vocabulary-service";
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

if (!parentPort) throw new Error("Lyceum processing worker must run inside worker_threads.");
const workerPort = parentPort;
const require = createRequire(import.meta.url);

async function hashStream(filePath: string, hash: ReturnType<typeof crypto.createHash>) {
  let fileSize = 0;
  await new Promise<void>((resolve, reject) => {
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk: Buffer) => {
      fileSize += chunk.byteLength;
      hash.update(chunk);
    });
    stream.on("error", reject);
    stream.on("end", resolve);
  });
  return fileSize;
}

async function hashRegularFile(filePath: string, includeBuffer = false): Promise<HashFileResult> {
  if (includeBuffer) {
    const nodeBuffer = await fs.promises.readFile(filePath);
    const bytes = Uint8Array.from(nodeBuffer);
    return {
      fileHash: crypto.createHash("sha256").update(bytes).digest("hex"),
      fileSize: nodeBuffer.byteLength,
      buffer: bytes.buffer.slice(0),
    };
  }
  const hash = crypto.createHash("sha256");
  const fileSize = await hashStream(filePath, hash);
  return { fileHash: hash.digest("hex"), fileSize };
}

async function hashDirectory(directoryPath: string): Promise<HashFileResult> {
  const hash = crypto.createHash("sha256");
  let fileSize = 0;
  hash.update("lyceum-directory:");
  const visit = async (currentPath: string, relativeRoot = "") => {
    const entries = (await fs.promises.readdir(currentPath, { withFileTypes: true }))
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const entryPath = path.join(currentPath, entry.name);
      const relativePath = path.join(relativeRoot, entry.name).replace(/\\/g, "/");
      hash.update(relativePath);
      if (entry.isDirectory()) await visit(entryPath, relativePath);
      else if (entry.isFile()) fileSize += await hashStream(entryPath, hash);
    }
  };
  await visit(directoryPath);
  return { fileHash: hash.digest("hex"), fileSize };
}

async function hashPath(filePath: string, includeBuffer = false): Promise<HashFileResult> {
  const stats = await fs.promises.stat(filePath);
  return stats.isDirectory() ? hashDirectory(filePath) : hashRegularFile(filePath, includeBuffer);
}

async function findFileByHash(fileHash: string, searchPaths: string[]) {
  const pending = [...searchPaths];
  while (pending.length > 0) {
    const candidate = pending.pop()!;
    let stats: fs.Stats;
    try { stats = await fs.promises.stat(candidate); } catch { continue; }
    if (stats.isDirectory()) {
      let entries: fs.Dirent[];
      try { entries = await fs.promises.readdir(candidate, { withFileTypes: true }); } catch { continue; }
      for (const entry of entries) pending.push(path.join(candidate, entry.name));
      continue;
    }
    if (!stats.isFile()) continue;
    if ((await hashRegularFile(candidate)).fileHash === fileHash) return candidate;
  }
  return undefined;
}

async function inspectBook(payload: WorkerTaskPayloads["inspect-book"]): Promise<InspectBookResult> {
  if (payload.fileType === "cbz") await validateCbzFile(payload.filePath);
  const base = await hashPath(payload.filePath, payload.includeBuffer === true);
  const metadataPromise = payload.includeMetadata
    ? payload.fileType === "pdf"
      ? extractPdfMetadata(payload.filePath, "[Worker]")
      : payload.fileType === "epub"
        ? extractEpubMetadata(payload.filePath, "[Worker]")
        : Promise.resolve(null)
    : Promise.resolve(null);
  const pageCountPromise = payload.fileType === "pdf"
    ? getPdfPageCount(payload.filePath, "[Worker]")
    : payload.fileType === "epub"
      ? getEpubChapterCount(payload.filePath, "[Worker]")
      : payload.fileType === "cbz"
        ? getCbzPageCount(payload.filePath, "[Worker]")
        : Promise.resolve(undefined);
  const thumbnailPromise = payload.includeThumbnail && payload.thumbnailsDir
    ? generateThumbnail(payload.filePath, base.fileHash, {
        thumbnailsDir: payload.thumbnailsDir,
        force: payload.force === true,
        fileType: payload.fileType,
        logPrefix: "[Worker]",
      })
    : Promise.resolve(null);
  const [metadata, numPages, thumbnailPath] = await Promise.all([metadataPromise, pageCountPromise, thumbnailPromise]);
  return { ...base, metadata: metadata || undefined, numPages, thumbnailPath: thumbnailPath || undefined };
}

function createPdfImageAssetRenderer(pdfPath: string, tempDir: string) {
  const renderedPages = new Map<number, Promise<{ path: string; width: number; height: number } | null>>();
  const renderPage = (pageNumber: number) => {
    if (!renderedPages.has(pageNumber)) {
      renderedPages.set(pageNumber, (async () => {
        const pdfPoppler = require("pdf-poppler");
        const sharp = require("sharp");
        await fs.promises.mkdir(tempDir, { recursive: true });
        const outPrefix = `page-hq-${pageNumber}`;
        await pdfPoppler.convert(pdfPath, { format: "png", out_dir: tempDir, out_prefix: outPrefix, page: pageNumber });
        const renderedName = (await fs.promises.readdir(tempDir)).find((fileName) =>
          fileName.toLowerCase().startsWith(outPrefix.toLowerCase()) && /\.(jpg|jpeg|png)$/i.test(fileName),
        );
        if (!renderedName) return null;
        const renderedPath = path.join(tempDir, renderedName);
        const metadata = await sharp(renderedPath).metadata();
        return { path: renderedPath, width: metadata.width || 1, height: metadata.height || 1 };
      })());
    }
    return renderedPages.get(pageNumber)!;
  };

  return async (candidate: any) => {
    const rendered = await renderPage(candidate.pageNumber);
    if (!rendered) return null;
    const sharp = require("sharp");
    const scaleX = rendered.width / Math.max(1, candidate.pageWidth);
    const scaleY = rendered.height / Math.max(1, candidate.pageHeight);
    const padding = Math.max(4, Math.round(Math.min(rendered.width, rendered.height) * 0.006));
    const left = Math.max(0, Math.floor(candidate.bbox.x0 * scaleX) - padding);
    const top = Math.max(0, Math.floor(candidate.bbox.y0 * scaleY) - padding);
    const right = Math.min(rendered.width, Math.ceil(candidate.bbox.x1 * scaleX) + padding);
    const bottom = Math.min(rendered.height, Math.ceil(candidate.bbox.y1 * scaleY) + padding);
    const width = right - left;
    const height = bottom - top;
    if (width < 24 || height < 24) return null;
    const fullPage = left === 0 && top === 0 && right === rendered.width && bottom === rendered.height;
    const extension = fullPage ? "png" : "jpg";
    const outputName = `asset-p${candidate.pageNumber}-${left}-${top}-${width}-${height}.${extension}`;
    const outputPath = path.join(tempDir, outputName);
    const extracted = sharp(rendered.path).extract({ left, top, width, height });
    if (fullPage) await extracted.png({ compressionLevel: 9 }).toFile(outputPath);
    else await extracted.jpeg({ quality: 90, mozjpeg: true }).toFile(outputPath);
    return {
      href: `images/${candidate.id || path.parse(outputName).name}.${extension}`,
      mediaType: fullPage ? "image/png" : "image/jpeg",
      data: Uint8Array.from(await fs.promises.readFile(outputPath)),
      width,
      height,
    };
  };
}

type ConversionProgress = (progress: number, message: string) => void;

async function convertViaLyceum(payload: WorkerTaskPayloads["convert-via-lyceum"], onProgress?: ConversionProgress): Promise<FileConversionWorkerResult> {
  const { convertViaLyceum: convert, flattenConversionStats } = await import("../../src/lib/lyceum");
  const stagedPdfPath = payload.sourceFormat === "pdf" && payload.pdfImageTempDir
    ? path.join(payload.pdfImageTempDir, "source.pdf")
    : null;
  try {
    if (stagedPdfPath && payload.pdfImageTempDir) {
      await fs.promises.rm(payload.pdfImageTempDir, { recursive: true, force: true });
      await fs.promises.mkdir(payload.pdfImageTempDir, { recursive: true });
      await fs.promises.copyFile(payload.sourcePath, stagedPdfPath);
    }
    const converted = await convert({
      sourcePath: payload.sourcePath,
      sourceFormat: payload.sourceFormat,
      targetFormat: payload.targetFormat,
      packageRoot: payload.packageRoot,
      outputPath: payload.outputPath,
      metadata: payload.metadata,
      renderImageAsset: stagedPdfPath && payload.pdfImageTempDir
        ? createPdfImageAssetRenderer(stagedPdfPath, payload.pdfImageTempDir)
        : undefined,
      conversionOptions: payload.conversionOptions,
      onProgress,
    });
    const hashed = await hashPath(payload.outputPath);
    const thumbnailType = ["pdf", "epub", "azw3", "kfx"].includes(payload.targetFormat)
      ? payload.targetFormat as "pdf" | "epub" | "azw3" | "kfx"
      : undefined;
    const [thumbnailPath, numPages] = await Promise.all([
      thumbnailType && payload.thumbnailsDir
        ? generateThumbnail(payload.outputPath, hashed.fileHash, {
            thumbnailsDir: payload.thumbnailsDir,
            fileType: thumbnailType,
            logPrefix: "[Worker]",
          })
        : Promise.resolve(null),
      payload.targetFormat === "pdf"
        ? getPdfPageCount(payload.outputPath, "[Worker]")
        : payload.targetFormat === "epub"
          ? getEpubChapterCount(payload.outputPath, "[Worker]")
          : Promise.resolve(Number(converted.exportReport.stats.pageCount || converted.exportReport.stats.chapterCount || 1)),
    ]);
    return {
      outputPath: payload.outputPath,
      ...hashed,
      packageRoot: converted.packageRoot,
      importReport: converted.importReport,
      exportReport: converted.exportReport,
      thumbnailPath: thumbnailPath || undefined,
      numPages,
      report: flattenConversionStats(converted),
    };
  } finally {
    if (payload.pdfImageTempDir) {
      await fs.promises.rm(payload.pdfImageTempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

async function convertPdfToEpub(payload: WorkerTaskPayloads["convert-pdf-to-epub"], onProgress?: ConversionProgress): Promise<FileConversionWorkerResult> {
  const { convertPdfToEpub: convert } = await import("../../src/lib/pdf-to-epub");
  const stagedPdfPath = path.join(payload.pdfImageTempDir, "source.pdf");
  try {
    await fs.promises.rm(payload.pdfImageTempDir, { recursive: true, force: true });
    await fs.promises.mkdir(payload.pdfImageTempDir, { recursive: true });
    await fs.promises.copyFile(payload.sourcePath, stagedPdfPath);
    const bytes = Uint8Array.from(await fs.promises.readFile(payload.sourcePath));
    const converted = await convert(bytes.buffer, {
      ...payload.metadata,
      renderImageAsset: createPdfImageAssetRenderer(stagedPdfPath, payload.pdfImageTempDir),
      onProgress,
    });
    await fs.promises.writeFile(payload.outputPath, Buffer.from(converted.epub));
    const hashed = await hashPath(payload.outputPath);
    const [thumbnailPath, numPages] = await Promise.all([
      generateThumbnail(payload.outputPath, hashed.fileHash, { thumbnailsDir: payload.thumbnailsDir, fileType: "epub", logPrefix: "[Worker]" }),
      getEpubChapterCount(payload.outputPath, "[Worker]"),
    ]);
    return { outputPath: payload.outputPath, ...hashed, thumbnailPath: thumbnailPath || undefined, numPages, report: converted.report };
  } finally {
    await fs.promises.rm(payload.pdfImageTempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function convertEpubToPdf(payload: WorkerTaskPayloads["convert-epub-to-pdf"]): Promise<FileConversionWorkerResult> {
  const { convertEpubToPdf: convert } = await import("../../src/lib/epub-to-pdf");
  const bytes = Uint8Array.from(await fs.promises.readFile(payload.sourcePath));
  const converted = await convert(bytes.buffer, payload.metadata);
  await fs.promises.writeFile(payload.outputPath, Buffer.from(converted.pdf));
  const hashed = await hashPath(payload.outputPath);
  const thumbnailPath = await generateThumbnail(payload.outputPath, hashed.fileHash, {
    thumbnailsDir: payload.thumbnailsDir,
    fileType: "pdf",
    logPrefix: "[Worker]",
  });
  return { outputPath: payload.outputPath, ...hashed, thumbnailPath: thumbnailPath || undefined, numPages: converted.report.pageCount, report: converted.report };
}

async function applyPdfCover(payload: WorkerTaskPayloads["apply-book-cover"]): Promise<MetadataMutationWorkerResult> {
  const pdfDoc = await PDFDocument.load(await fs.promises.readFile(payload.filePath));
  const imageBytes = await fs.promises.readFile(payload.imagePath);
  const extension = path.extname(payload.imagePath).toLowerCase();
  const image = extension === ".png" ? await pdfDoc.embedPng(imageBytes)
    : extension === ".jpg" || extension === ".jpeg" ? await pdfDoc.embedJpg(imageBytes) : null;
  if (!image) return { fileResult: { success: false, warnings: [], error: "Formato de imagem nao suportado. Use PNG ou JPG." } };
  const firstPage = pdfDoc.getPage(0);
  const { width, height } = firstPage.getSize();
  const dimensions = image.scaleToFit(width, height);
  if (payload.mode === "replace") pdfDoc.removePage(0);
  const newPage = pdfDoc.insertPage(0, [width, height]);
  newPage.drawImage(image, {
    x: (width - dimensions.width) / 2,
    y: (height - dimensions.height) / 2,
    width: dimensions.width,
    height: dimensions.height,
  });
  const tempPath = `${payload.filePath}.lyceum-tmp`;
  await fs.promises.writeFile(tempPath, Buffer.from(await pdfDoc.save()));
  await fs.promises.rename(tempPath, payload.filePath);
  const hashed = await hashPath(payload.filePath);
  const thumbnailPath = await generateThumbnail(payload.filePath, hashed.fileHash, {
    thumbnailsDir: payload.thumbnailsDir,
    force: true,
    fileType: "pdf",
    logPrefix: "[Worker]",
  });
  return { fileResult: { success: true, warnings: [] }, ...hashed, thumbnailPath: thumbnailPath || undefined, numPages: pdfDoc.getPageCount() };
}

async function applyBookCover(payload: WorkerTaskPayloads["apply-book-cover"]): Promise<MetadataMutationWorkerResult> {
  const fileType = (payload.fileType || path.extname(payload.filePath).slice(1)).toLowerCase();
  if (fileType === "pdf") return applyPdfCover(payload);
  const fileResult = await setBookCoverInFile(payload.filePath, fileType, payload.imagePath, payload.metadata);
  const hashed = fileResult.success ? await hashPath(payload.filePath) : undefined;
  const thumbnailHash = hashed?.fileHash || payload.currentFileHash || crypto.createHash("sha256").update(payload.filePath).digest("hex");
  const thumbnailPath = path.join(payload.thumbnailsDir, `${thumbnailHash}-thumb.webp`);
  await writeThumbnailFile(payload.imagePath, thumbnailPath);
  return { fileResult, ...(hashed || {}), thumbnailPath };
}

async function execute<K extends WorkerTaskKind>(kind: K, payload: WorkerTaskPayloads[K], onProgress?: ConversionProgress): Promise<WorkerTaskResults[K]> {
  switch (kind) {
    case "ping": return { pong: true, pid: process.pid } as WorkerTaskResults[K];
    case "hash-file": {
      const input = payload as WorkerTaskPayloads["hash-file"];
      return await hashPath(input.filePath, input.includeBuffer) as WorkerTaskResults[K];
    }
    case "find-file-by-hash": {
      const input = payload as WorkerTaskPayloads["find-file-by-hash"];
      return { filePath: await findFileByHash(input.fileHash, input.searchPaths) } as WorkerTaskResults[K];
    }
    case "inspect-book": return await inspectBook(payload as WorkerTaskPayloads["inspect-book"]) as WorkerTaskResults[K];
    case "generate-thumbnail": {
      const input = payload as WorkerTaskPayloads["generate-thumbnail"];
      const thumbnailPath = await generateThumbnail(input.filePath, input.fileHash, {
        thumbnailsDir: input.thumbnailsDir, fileType: input.fileType, force: input.force, logPrefix: "[Worker]",
      });
      return { thumbnailPath: thumbnailPath || undefined } as WorkerTaskResults[K];
    }
    case "convert-via-lyceum": return await convertViaLyceum(payload as WorkerTaskPayloads["convert-via-lyceum"], onProgress) as WorkerTaskResults[K];
    case "convert-pdf-to-epub": return await convertPdfToEpub(payload as WorkerTaskPayloads["convert-pdf-to-epub"], onProgress) as WorkerTaskResults[K];
    case "convert-epub-to-pdf": return await convertEpubToPdf(payload as WorkerTaskPayloads["convert-epub-to-pdf"]) as WorkerTaskResults[K];
    case "extract-vocabulary": {
      const input = payload as WorkerTaskPayloads["extract-vocabulary"];
      return { words: extractVocabularyFromEpub(input.filePath) } as WorkerTaskResults[K];
    }
    case "write-book-metadata": {
      const input = payload as WorkerTaskPayloads["write-book-metadata"];
      const fileResult = await writeBookMetadataToFile(input.filePath, input.fileType, input.metadata);
      const hashed = fileResult.success ? await hashPath(input.filePath) : undefined;
      return { fileResult, ...(hashed || {}) } as WorkerTaskResults[K];
    }
    case "apply-book-cover": return await applyBookCover(payload as WorkerTaskPayloads["apply-book-cover"]) as WorkerTaskResults[K];
    case "prepare-cover-image": {
      const input = payload as WorkerTaskPayloads["prepare-cover-image"];
      await writeCoverImageFile(input.sourcePath, input.outputPath);
      return { outputPath: input.outputPath } as WorkerTaskResults[K];
    }
    case "validate-azw3": {
      const input = payload as WorkerTaskPayloads["validate-azw3"];
      const { validateAzw3File } = await import("../../src/lib/lyceum");
      return validateAzw3File(input.filePath) as unknown as WorkerTaskResults[K];
    }
    default: throw new Error(`Unknown worker task: ${String(kind)}`);
  }
}

workerPort.on("message", async (request: WorkerRequest) => {
  try {
    workerPort.postMessage({ type: "progress", requestId: request.requestId, progress: 0, message: `Starting ${request.kind}` } satisfies WorkerResponse);
    const value = await execute(request.kind, request.payload as never, (progress, message) => {
      workerPort.postMessage({ type: "progress", requestId: request.requestId, progress, message } satisfies WorkerResponse);
    });
    workerPort.postMessage({ type: "progress", requestId: request.requestId, progress: 1, message: `Finished ${request.kind}` } satisfies WorkerResponse);
    const response: WorkerResponse = { type: "result", requestId: request.requestId, success: true, value };
    const transfer = value && typeof value === "object" && "buffer" in value && value.buffer instanceof ArrayBuffer ? [value.buffer] : [];
    workerPort.postMessage(response, transfer);
  } catch (error) {
    const response: WorkerResponse = {
      type: "result",
      requestId: request.requestId,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    };
    workerPort.postMessage(response);
  }
});

workerPort.postMessage({ type: "ready", workerId: threadId } satisfies WorkerResponse);
