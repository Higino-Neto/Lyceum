import fs from "node:fs";
import {
  generateThumbnail,
  getPdfPageCount,
  getEpubChapterCount,
  type BookFileType,
  type PdfMetadata,
} from "../services/document-processing";
import { generateFileHashFromBuffer } from "../services/file-service";

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

export async function readAndHash(filePath: string): Promise<ReadFileResult> {
  return readAndHashMainThread(filePath);
}

export async function openAndProcess(input: OpenFileInput): Promise<OpenFileResult> {
  return openAndProcessMainThread(input);
}
