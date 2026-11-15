import type { TranslationKey } from "../../../i18n";

/**
 * Mirror of the main process reader strategy (electron/services/reader-format-service.ts):
 * PDF and EPUB open directly; the formats below are converted to a cached
 * EPUB (AZW4 to its embedded PDF) the first time they are opened.
 */
const CONVERTED_EXTENSIONS = new Set([
  "mobi", "azw", "azw3", "azw4", "prc", "txt", "html", "htm", "docx", "fb2", "cbz", "cbr",
]);

export type ReaderErrorCode =
  | "drm"
  | "kfx"
  | "unsupported"
  | "rar-extractor-missing"
  | "corrupt"
  | "conversion-failed";

const READER_ERROR_KEYS: Record<ReaderErrorCode, TranslationKey> = {
  drm: "library:reader.errors.drm",
  kfx: "library:reader.errors.kfx",
  unsupported: "library:reader.errors.unsupported",
  "rar-extractor-missing": "library:reader.errors.rarExtractorMissing",
  corrupt: "library:reader.errors.corrupt",
  "conversion-failed": "library:reader.errors.conversionFailed",
};

function extensionOf(filePath: string) {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".fb2.zip")) return "fb2";
  const match = /\.([a-z0-9]+)$/.exec(lower);
  return match ? match[1] : "";
}

/** True for files the reader can show, directly or after conversion. */
export function isReaderSupported(filePath: string | null | undefined, fileType?: string | null): boolean {
  const extension = filePath ? extensionOf(filePath) : "";
  const type = extension || String(fileType || "").toLowerCase();
  return type === "pdf" || type === "epub" || CONVERTED_EXTENSIONS.has(type);
}

/** True when opening the file needs the one-time conversion step. */
export function needsReaderConversion(filePath: string): boolean {
  return CONVERTED_EXTENSIONS.has(extensionOf(filePath));
}

export function readerFormatLabel(filePath: string): string {
  return extensionOf(filePath).toUpperCase();
}

export function readerErrorKey(code: string | null | undefined): TranslationKey | null {
  return code && code in READER_ERROR_KEYS ? READER_ERROR_KEYS[code as ReaderErrorCode] : null;
}
