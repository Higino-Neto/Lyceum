import type { ImagePresetId } from "../images/imagePresets";

export type BookFormat =
  | "pdf"
  | "epub"
  | "docx"
  | "html"
  | "cbz"
  | "mobi"
  | "azw"
  | "azw3"
  | "azw4"
  | "kfx"
  | "prc"
  | "txt"
  | "fb2"
  | "cbr"
  | "lyceum";

export type LyceumContentKind = "textual" | "pdf" | "comic" | "audio";

export interface LyceumConversionOptions {
  preserveCover?: boolean;
  preserveMetadata?: boolean;
  generateIndex?: boolean;
  /** "original" (default) leaves images untouched. */
  imagePreset?: ImagePresetId;
  imageMaxWidth?: number;
  imageMaxHeight?: number;
  /** 1-100: JPEG quality, or palette quantisation quality for PNG with alpha. */
  imageQuality?: number;
  imageGrayscale?: boolean;
  pdfPageSize?: "A4" | "A5" | "Letter" | "Legal";
  pdfMarginTopMm?: number;
  pdfMarginBottomMm?: number;
  pdfMarginLeftMm?: number;
  pdfMarginRightMm?: number;
  pdfLineHeight?: number;
  pdfParagraphSpacingEm?: number;
  pdfFontSizePt?: number;
  pdfChapterPageBreaks?: boolean;
  pdfIncludeToc?: boolean;
  pdfGenerateOutline?: boolean;
  epubLayout?: "auto" | "reflow" | "fixed-layout";
  epubLineHeight?: number;
  epubParagraphSpacingEm?: number;
  kindleProfile?: "legacy-paperwhite" | "kindle-compatible" | "modern-kindle" | "scribe";
  txtChapterHeadings?: boolean;
  txtLineEnding?: "lf" | "crlf";
  htmlIncludeToc?: boolean;
  /**
   * Real page numbers for Kindle (APNX sidecar) and EPUB page-list.
   * "auto" keeps publisher/PDF pages and falls back to the print page count,
   * then to an estimate. "off" disables page numbers.
   */
  pageNumbers?: "auto" | "off" | "target-count" | "estimate";
  /** Print page count used by "target-count" (and by "auto" when no real pages exist). */
  printPageCount?: number;
  /** Visible characters per page used by "estimate". */
  charsPerPage?: number;
  /**
   * Kindle font sizes: "kindle" (default) makes the book's absolute sizes
   * relative so the reader's font setting applies; "original" keeps them.
   */
  kindleFontSizes?: "kindle" | "original";
}

export interface LyceumManifest {
  schemaVersion: 1;
  packageId: string;
  title: string;
  sourceFormat: BookFormat;
  originalFileName: string;
  primaryContentKind: LyceumContentKind;
  contentKinds: LyceumContentKind[];
  createdAt: string;
  updatedAt: string;
}

export interface LyceumMetadataEntry {
  value: string;
  id?: string;
  scheme?: string;
  role?: string;
  fileAs?: string;
  language?: string;
  refinements?: Record<string, string[]>;
}

export interface LyceumBookMetadata {
  title: string;
  author?: string;
  language?: string;
  identifier?: string;
  publisher?: string;
  description?: string;
  publishDate?: string;
  subject?: string | string[];
  rights?: string;
  contributor?: string;
  authorSort?: string;
  titleSort?: string;
  series?: string;
  seriesIndex?: string;
  groupPosition?: string;
  displaySeq?: string;
  isbn?: string;
  asin?: string;
  rating?: number;
  timestamp?: string;
  coverResourceId?: string;
  coverHref?: string;
  coverPageHref?: string;
  titles?: LyceumMetadataEntry[];
  creators?: LyceumMetadataEntry[];
  contributors?: LyceumMetadataEntry[];
  identifiers?: LyceumMetadataEntry[];
  subjects?: LyceumMetadataEntry[];
  dates?: LyceumMetadataEntry[];
  customMetadata?: Record<string, string[]>;
}

export interface LyceumTextualChapter {
  id: string;
  href: string;
  title: string;
  xhtml: string;
  mediaType?: string;
  properties?: string;
}

export interface LyceumSpineItem {
  id: string;
  href: string;
  title: string;
  linear?: boolean;
  properties?: string;
  mediaType?: string;
}

export interface LyceumTocItem {
  id: string;
  href: string;
  title: string;
  level: number;
}

export interface LyceumTextualResource {
  id: string;
  href: string;
  mediaType: string;
  properties?: string;
  sourceHref?: string;
  fallback?: string;
  linear?: boolean;
  data?: Uint8Array | ArrayBuffer;
}

/**
 * Where the page boundaries of a {@link LyceumPageMap} came from, from most to
 * least faithful to a printed edition.
 * - publisher: the source EPUB shipped a page-list / NCX pageList.
 * - pdf: real page boundaries of the source PDF.
 * - target-count: a known print page count spread over the text.
 * - estimate: a fixed number of visible characters per page.
 */
export type LyceumPageMapSource = "publisher" | "pdf" | "target-count" | "estimate";

export interface LyceumPageTarget {
  /** Label shown by the reader ("1", "xii", ...). */
  label: string;
  /** Chapter href (same space as {@link LyceumTextualChapter.href}). */
  href: string;
  /** id of the element that marks the start of the page inside the chapter. */
  anchorId: string;
}

export interface LyceumPageMap {
  source: LyceumPageMapSource;
  pages: LyceumPageTarget[];
  printPageCount?: number;
}

export interface LyceumTextualContent {
  chapters: LyceumTextualChapter[];
  spine: LyceumSpineItem[];
  toc: LyceumTocItem[];
  fulltext: string;
  resources?: LyceumTextualResource[];
  pageMap?: LyceumPageMap;
}

export interface LyceumComicPage {
  id: string;
  href: string;
  title: string;
  mediaType: string;
  byteLength: number;
  width?: number;
  height?: number;
  resourceHref?: string;
  originalPath?: string;
}

export interface LyceumComicContent {
  pages: LyceumComicPage[];
  pageCount: number;
  totalBytes: number;
}

export interface LyceumPackage {
  rootPath: string;
  manifest: LyceumManifest;
  metadata: LyceumBookMetadata;
  textual?: LyceumTextualContent;
  comic?: LyceumComicContent;
}

export interface ImportInput {
  sourcePath: string;
  sourceFormat: BookFormat;
  packageRoot: string;
  metadata?: Partial<LyceumBookMetadata>;
  renderImageAsset?: unknown;
  conversionOptions?: LyceumConversionOptions;
  onProgress?: (progress: number, message: string) => void;
}

export interface ImportReport {
  sourceFormat: BookFormat;
  contentKinds: LyceumContentKind[];
  warnings: string[];
  stats: Record<string, number | string | boolean>;
}

export interface ImportResult {
  package: LyceumPackage;
  report: ImportReport;
}

export interface ExportInput {
  package: LyceumPackage;
  outputPath: string;
  metadata?: Partial<LyceumBookMetadata>;
  conversionOptions?: LyceumConversionOptions;
}

export interface ExportReport {
  outputFormat: BookFormat;
  warnings: string[];
  stats: Record<string, number | string | boolean>;
}

export interface ExportResult {
  outputPath: string;
  outputFormat: BookFormat;
  report: ExportReport;
}

export interface LyceumImporter {
  inputFormat: BookFormat;
  import(input: ImportInput): Promise<ImportResult>;
}

export interface ExportCapability {
  supported: boolean;
  reason?: string;
}

export interface LyceumExporter {
  outputFormat: BookFormat;
  canExport(pkg: LyceumPackage): ExportCapability;
  export(input: ExportInput): Promise<ExportResult>;
}
