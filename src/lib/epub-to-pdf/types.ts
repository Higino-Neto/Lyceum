export interface EpubToPdfMetadata {
  title?: string;
  author?: string;
  language?: string;
}

export interface ConvertEpubToPdfOptions {
  title?: string;
  author?: string;
}

export interface EpubToPdfReport {
  chapterCount: number;
  pageCount: number;
  wordCount: number;
  imageCount: number;
  skippedImageCount: number;
  unsupportedCharacterCount: number;
  warnings: string[];
}

export interface ConvertEpubToPdfResult {
  pdf: Uint8Array;
  report: EpubToPdfReport;
  metadata: EpubToPdfMetadata;
}
