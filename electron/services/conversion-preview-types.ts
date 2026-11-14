// Dependency-free so the preload (and the strict typecheck scope) can import it cheaply.
export interface ConversionPreviewResult {
  dataUrl: string;
  mediaType: string;
  width: number;
  height: number;
  bytes: number;
  originalBytes: number;
  originalWidth: number;
  originalHeight: number;
  pageIndex: number;
  pageCount: number;
  sourceBytes: number;
  estimatedTotalBytes: number;
  optimized: boolean;
}
