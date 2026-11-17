// Dependency-free so the preload (and the strict typecheck scope) can import it cheaply.
import type { LyceumConversionOptions } from "../../src/lib/lyceum/schema/types";

export type OutputPreviewSegmentKind = "chapter" | "page";

export interface OutputPreviewRequest {
  targetFormat: "epub" | "pdf" | "azw3" | "kfx" | "txt" | "html" | "lyceum";
  conversionOptions?: LyceumConversionOptions;
  /** Zero-based chapter (or comic page) to preview. */
  segmentIndex: number;
  /** One-based page inside the rendered segment. */
  page: number;
  /**
   * Only measure the segment (page count and exported size) without capturing
   * an image. Used to learn the final page total and estimate the output size;
   * measured slices are not kept in the preview cache.
   */
  measureOnly?: boolean;
}

export interface OutputPreviewResult {
  dataUrl: string;
  width: number;
  height: number;
  /** One-based page shown, after clamping. */
  page: number;
  pageCount: number;
  segmentKind: OutputPreviewSegmentKind;
  segmentIndex: number;
  segmentCount: number;
  segmentTitle: string;
  /** Kindle formats are previewed through their EPUB equivalent on a Kindle-sized screen. */
  approximate: boolean;
  /** Size in bytes of this segment exported on its own (includes per-file overhead). */
  outputBytes: number;
  /** Screen the page was laid out on, in CSS pixels (e-reader formats) or PDF points. */
  viewport: { width: number; height: number; label: string };
}
