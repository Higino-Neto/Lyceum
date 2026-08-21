import type { BookFormat, LyceumBookMetadata, LyceumConversionOptions } from "../../src/lib/lyceum";
import type { EditableBookMetadata, FileMetadataUpdateResult } from "../services/book-file-metadata";
import type { BookFileType, EpubMetadata, PdfMetadata } from "../services/document-processing";

export type WorkerTaskKind =
  | "ping"
  | "hash-file"
  | "find-file-by-hash"
  | "inspect-book"
  | "generate-thumbnail"
  | "convert-via-lyceum"
  | "convert-pdf-to-epub"
  | "convert-epub-to-pdf"
  | "extract-vocabulary"
  | "write-book-metadata"
  | "apply-book-cover"
  | "prepare-cover-image"
  | "validate-azw3";

export interface WorkerRequest<T = unknown> {
  requestId: string;
  kind: WorkerTaskKind;
  payload: T;
}

export interface WorkerSuccess<T = unknown> {
  type: "result";
  requestId: string;
  success: true;
  value: T;
}

export interface WorkerFailure {
  type: "result";
  requestId: string;
  success: false;
  error: string;
  stack?: string;
}

export interface WorkerReady { type: "ready"; workerId: number }
export interface WorkerProgress { type: "progress"; requestId: string; progress: number; message?: string }
export type WorkerResponse<T = unknown> = WorkerReady | WorkerProgress | WorkerSuccess<T> | WorkerFailure;

export interface HashFileResult { fileHash: string; fileSize: number; buffer?: ArrayBuffer }
export interface InspectBookResult extends HashFileResult {
  thumbnailPath?: string;
  numPages?: number;
  metadata?: PdfMetadata | EpubMetadata;
}

export interface ConvertViaLyceumWorkerInput {
  sourcePath: string;
  sourceFormat: BookFormat;
  targetFormat: BookFormat;
  packageRoot: string;
  outputPath: string;
  metadata?: Partial<LyceumBookMetadata>;
  pdfImageTempDir?: string;
  thumbnailsDir?: string;
  conversionOptions?: LyceumConversionOptions;
}

export interface ConversionRequestOptions {
  jobId?: string;
  conversionOptions?: LyceumConversionOptions;
  outputDirectory?: string;
}

export interface FileConversionWorkerResult {
  outputPath: string;
  fileHash: string;
  fileSize: number;
  thumbnailPath?: string;
  numPages?: number;
  report: any;
  packageRoot?: string;
  importReport?: any;
  exportReport?: any;
}

export interface MetadataMutationWorkerResult {
  fileResult: FileMetadataUpdateResult;
  fileHash?: string;
  fileSize?: number;
  thumbnailPath?: string;
  numPages?: number;
}

export interface WorkerTaskPayloads {
  ping: Record<string, never>;
  "hash-file": { filePath: string; includeBuffer?: boolean };
  "find-file-by-hash": { fileHash: string; searchPaths: string[] };
  "inspect-book": {
    filePath: string;
    fileType: BookFileType;
    thumbnailsDir?: string;
    includeBuffer?: boolean;
    includeMetadata?: boolean;
    includeThumbnail?: boolean;
    force?: boolean;
  };
  "generate-thumbnail": { filePath: string; fileHash: string; thumbnailsDir: string; fileType: BookFileType; force?: boolean };
  "convert-via-lyceum": ConvertViaLyceumWorkerInput;
  "convert-pdf-to-epub": {
    sourcePath: string;
    outputPath: string;
    thumbnailsDir: string;
    pdfImageTempDir: string;
    metadata?: { title?: string; author?: string; language?: string; publisher?: string; description?: string };
  };
  "convert-epub-to-pdf": {
    sourcePath: string;
    outputPath: string;
    thumbnailsDir: string;
    metadata?: { title?: string; author?: string };
  };
  "extract-vocabulary": { filePath: string };
  "write-book-metadata": { filePath: string; fileType?: string | null; metadata: EditableBookMetadata };
  "apply-book-cover": {
    filePath: string;
    fileType?: string | null;
    imagePath: string;
    mode: "replace" | "prepend";
    metadata: EditableBookMetadata;
    thumbnailsDir: string;
    currentFileHash?: string;
  };
  "prepare-cover-image": { sourcePath: string; outputPath: string };
  "validate-azw3": { filePath: string };
}

export interface WorkerTaskResults {
  ping: { pong: true; pid: number };
  "hash-file": HashFileResult;
  "find-file-by-hash": { filePath?: string };
  "inspect-book": InspectBookResult;
  "generate-thumbnail": { thumbnailPath?: string };
  "convert-via-lyceum": FileConversionWorkerResult;
  "convert-pdf-to-epub": FileConversionWorkerResult;
  "convert-epub-to-pdf": FileConversionWorkerResult;
  "extract-vocabulary": { words: Array<{ word: string; count: number }> };
  "write-book-metadata": MetadataMutationWorkerResult;
  "apply-book-cover": MetadataMutationWorkerResult;
  "prepare-cover-image": { outputPath: string };
  "validate-azw3": { valid: boolean; errors: string[]; warnings: string[] };
}
