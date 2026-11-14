/** Renderer-facing contract of the PDF tools (types only, safe to import from the preload). */

export type ImagePageSize = "image" | "A4" | "Letter";

export interface ImagesToPdfInput {
  imagePaths: string[];
  outputPath: string;
  pageSize: ImagePageSize;
  /** Margin in millimetres, used by the fixed page sizes. */
  marginMm?: number;
  title?: string;
  author?: string;
}

export interface ImagesToCbzInput {
  imagePaths: string[];
  outputPath: string;
  title?: string;
  author?: string;
}

export interface MergePdfsInput {
  inputPaths: string[];
  outputPath: string;
  title?: string;
}

export interface OrganizedPage {
  /** Zero-based page index in the source PDF. */
  index: number;
  /** Extra clockwise rotation applied on top of the page's own rotation. */
  rotation: 0 | 90 | 180 | 270;
}

export interface OrganizePdfInput {
  inputPath: string;
  outputPath: string;
  pages: OrganizedPage[];
}

export interface PdfToolResult {
  outputPath: string;
  fileSize: number;
  pageCount: number;
}

export interface PdfToolInfo {
  pageCount: number;
  title?: string;
  fileSize: number;
}

export type PdfToolRequest =
  | { operation: "images-to-pdf"; input: ImagesToPdfInput }
  | { operation: "images-to-cbz"; input: ImagesToCbzInput }
  | { operation: "merge-pdfs"; input: MergePdfsInput }
  | { operation: "organize-pdf"; input: OrganizePdfInput }
  | { operation: "info"; input: { filePath: string } }
  | { operation: "thumbnails"; input: { filePath: string; pages: number[]; maxDimension?: number } };

export type PdfToolThumbnail = { page: number; dataUrl: string; width: number; height: number };

export type PdfToolResponse =
  | { operation: "result"; result: PdfToolResult }
  | { operation: "info"; info: PdfToolInfo }
  | { operation: "thumbnails"; thumbnails: PdfToolThumbnail[] };

/** Requests the renderer may run (the read-only operations have their own channels). */
export type ToolRunRequest = Exclude<PdfToolRequest, { operation: "info" } | { operation: "thumbnails" }>;

export type ToolFileKind = "images" | "pdf" | "books";

export interface ToolPickedFile {
  path: string;
  name: string;
  extension: string;
  size: number;
}
