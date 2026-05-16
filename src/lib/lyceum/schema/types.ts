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
  | "lyceum";

export type LyceumContentKind = "textual" | "pdf" | "comic" | "audio";

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

export interface LyceumBookMetadata {
  title: string;
  author?: string;
  language?: string;
  identifier?: string;
  publisher?: string;
  description?: string;
  publishDate?: string;
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
  data?: Uint8Array | ArrayBuffer;
}

export interface LyceumTextualContent {
  chapters: LyceumTextualChapter[];
  spine: LyceumSpineItem[];
  toc: LyceumTocItem[];
  fulltext: string;
  resources?: LyceumTextualResource[];
}

export interface LyceumPackage {
  rootPath: string;
  manifest: LyceumManifest;
  metadata: LyceumBookMetadata;
  textual?: LyceumTextualContent;
}

export interface ImportInput {
  sourcePath: string;
  sourceFormat: BookFormat;
  packageRoot: string;
  metadata?: Partial<LyceumBookMetadata>;
  renderImageAsset?: unknown;
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
