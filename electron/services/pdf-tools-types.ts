/** Renderer-facing contract of the PDF tools (types only, safe to import from the preload). */

export type ImagePageSize = "image" | "A4" | "Letter";

export interface BuildPdfPage {
  /** Absolute path of the PDF or image the page comes from. */
  source: string;
  kind: "pdf" | "image";
  /** Zero-based page index inside a PDF source. */
  pageIndex?: number;
  /** Extra clockwise rotation applied on top of the page's own rotation. */
  rotation: 0 | 90 | 180 | 270;
}

export interface BuildPdfInput {
  pages: BuildPdfPage[];
  outputPath: string;
  /** Page size used for image pages ("image" keeps the picture's own size). */
  imagePageSize?: ImagePageSize;
  /** Margin in millimetres around images on fixed page sizes. */
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
  | { operation: "build-pdf"; input: BuildPdfInput }
  | { operation: "images-to-cbz"; input: ImagesToCbzInput }
  | { operation: "info"; input: { filePath: string } }
  | { operation: "thumbnails"; input: { filePath: string; pages: number[]; maxDimension?: number } };

export type PdfToolThumbnail = { page: number; dataUrl: string; width: number; height: number };

export type PdfToolResponse =
  | { operation: "result"; result: PdfToolResult }
  | { operation: "info"; info: PdfToolInfo }
  | { operation: "thumbnails"; thumbnails: PdfToolThumbnail[] };

/** Requests the renderer may run (the read-only operations have their own channels). */
export type ToolRunRequest = Exclude<PdfToolRequest, { operation: "info" } | { operation: "thumbnails" }>;

export type ToolFileKind = "images" | "pdf" | "books" | "builder";

export interface ToolPickedFile {
  path: string;
  name: string;
  extension: string;
  size: number;
}
