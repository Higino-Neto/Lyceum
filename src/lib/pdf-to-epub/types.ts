export interface BBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  width: number;
  height: number;
}

export interface Token {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontName: string;
  fontSize: number;
  pageNumber: number;
  rawTransform?: number[];
  charSpacing?: number;
  dir?: "ltr" | "rtl";
  bold?: boolean;
  italic?: boolean;
  confidence?: number;
  sourceIndex?: number;
}

export interface Line {
  tokens: Token[];
  text: string;
  bbox: BBox;
  baseline: number;
  avgFontSize: number;
  left: number;
  right: number;
  center: number;
  pageNumber: number;
  columnId?: number;
  roleHint?: "body" | "header" | "footer" | "footnote" | "caption";
}

export interface Paragraph {
  lines: Line[];
  text: string;
  bbox: BBox;
  indentation: number;
  avgLineGap: number;
  pageStart: number;
  pageEnd: number;
  style: {
    avgFontSize: number;
    dominantFontName?: string;
    boldRatio: number;
    italicRatio: number;
  };
}

export type BlockType =
  | "title"
  | "subtitle"
  | "chapter"
  | "paragraph"
  | "blockquote"
  | "list"
  | "listItem"
  | "footnote"
  | "image"
  | "caption"
  | "table"
  | "formula"
  | "tocEntry"
  | "unknown";

export interface Block {
  type: BlockType;
  children: Array<Block | Paragraph>;
  pageRange: {
    start: number;
    end: number;
  };
  text?: string;
  bbox?: BBox;
  confidence?: number;
  attrs?: Record<string, unknown>;
}

export interface Section {
  type: "section";
  title?: string;
  level: number;
  children: Block[];
  pageRange: {
    start: number;
    end: number;
  };
}

export interface PageModel {
  pageNumber: number;
  width: number;
  height: number;
  tokens: Token[];
  lines: Line[];
  orderedLines: Line[];
  layout?: PageLayout;
  requiresOcr?: boolean;
  imageCandidates?: ImageCandidate[];
}

export interface TokenStyleProfile {
  bold: boolean;
  italic: boolean;
  boldConfidence: number;
  italicConfidence: number;
}

export interface FontGroupStats {
  fontName: string;
  baseName: string;
  avgNormalizedWidth: number;
  avgSkewFactor: number;
  avgHeightRatio: number;
  tokenCount: number;
  boldCandidate: boolean;
  italicCandidate: boolean;
  widthConfidence: number;
  skewConfidence: number;
}

export interface FontProfile {
  groups: Map<string, FontGroupStats>;
  families: Map<string, FontGroupStats[]>;
}

export interface StyleClassification {
  bold: boolean;
  italic: boolean;
  boldConfidence: number;
  italicConfidence: number;
}

export interface ColumnRegion {
  id: number;
  x0: number;
  x1: number;
  lines: Line[];
}

export interface PageLayout {
  columnCount: number;
  columns: ColumnRegion[];
  confidence: number;
  mode: "single" | "multi" | "mixed";
}

export interface FontSizeCluster {
  label: "tiny" | "body" | "heading1" | "heading2" | "heading3";
  minSize: number;
  maxSize: number;
  representativeSize: number;
  tokenCount: number;
}

export interface FontSizeAnalysis {
  bodyFontSize: number;
  clusters: FontSizeCluster[];
  headingThresholds: {
    h1Min: number;
    h2Min: number;
    h3Min: number;
  };
}

export interface DocumentStats {
  bodyFontSize: number;
  medianLineGap: number;
  bodyLeft: number;
  bodyRight: number;
  pageWidth: number;
  pageHeight: number;
  fontSizeAnalysis?: FontSizeAnalysis;
}

export interface EpubMetadata {
  title: string;
  language: string;
  identifier: string;
  author?: string;
  publisher?: string;
  description?: string;
  modified?: string;
}

export interface ImageCandidate {
  id: string;
  pageNumber: number;
  bbox: BBox;
  pageWidth: number;
  pageHeight: number;
  confidence: number;
}

export interface EpubAsset {
  href: string;
  mediaType: string;
  data: ArrayBuffer | Uint8Array;
}

export interface ConversionReport {
  checklist: ChecklistItem[];
  pageCount: number;
  sectionCount: number;
  blockCount: number;
  confidence: {
    average: number;
    lowConfidenceBlocks: number;
  };
  warnings: string[];
}

export interface ChecklistItem {
  id: string;
  label: string;
  status: "done" | "partial" | "pending" | "skipped";
  detail?: string;
}

export interface ConvertPdfToEpubOptions {
  title?: string;
  author?: string;
  language?: string;
  identifier?: string;
  publisher?: string;
  description?: string;
  minTextTokensPerPage?: number;
  renderImageAsset?: (candidate: ImageCandidate) => Promise<EpubAsset | null>;
}
