import type { BookWithThumbnail } from "../../types/LibraryTypes";
import type { ConversionOptions } from "../../contexts/ConversionQueueContext";
import { defaultConversionOptions } from "../../contexts/ConversionQueueContext";
import { getTitleWithoutExtension } from "../../pages/Library/utils";

/**
 * Favourite conversion settings for sending books to a Kindle. Shared by the
 * quick send panel and by the conversion window opened in Kindle mode.
 */
export const KINDLE_CONVERSION_DEFAULTS_KEY = "lyceum-kindle-conversion-defaults";

export type KindlePageNumbers = "auto" | "estimate" | "off";

export interface KindleDelivery {
  deviceId: string;
  deviceName: string;
}

/** Formats the Kindle reads directly (copied as-is, with page numbers). */
export const KINDLE_NATIVE_FORMATS = new Set(["azw3", "azw", "mobi", "prc", "kfx"]);
/** Formats Lyceum converts to AZW3 before sending. */
export const KINDLE_CONVERTIBLE_FORMATS = new Set(["pdf", "epub", "txt", "html", "cbz"]);

/** Evaluated lazily: this module and the conversion queue import each other. */
export function getKindleDefaultOptions(): ConversionOptions {
  return {
    ...defaultConversionOptions,
    epubLayout: "auto",
    kindleProfile: "kindle-compatible",
    pageNumbers: "auto",
    kindleFontSizes: "kindle",
    preserveCover: true,
    preserveMetadata: true,
  };
}

const STORED_KEYS: Array<keyof ConversionOptions> = [
  "epubLayout",
  "epubLineHeight",
  "epubParagraphSpacingEm",
  "kindleProfile",
  "pageNumbers",
  "kindleFontSizes",
  "charsPerPage",
  "imagePreset",
  "imageMaxWidth",
  "imageMaxHeight",
  "imageQuality",
  "imageGrayscale",
  "preserveCover",
  "preserveMetadata",
  "generateIndex",
];

export function loadKindleConversionOptions(): ConversionOptions {
  try {
    const raw = localStorage.getItem(KINDLE_CONVERSION_DEFAULTS_KEY);
    if (!raw) return getKindleDefaultOptions();
    const stored = JSON.parse(raw) as Partial<ConversionOptions>;
    const picked: Partial<ConversionOptions> = {};
    for (const key of STORED_KEYS) {
      if (stored[key] !== undefined) (picked as Record<string, unknown>)[key] = stored[key];
    }
    return { ...getKindleDefaultOptions(), ...picked };
  } catch {
    return getKindleDefaultOptions();
  }
}

export function saveKindleConversionOptions(options: ConversionOptions): boolean {
  try {
    const picked: Partial<ConversionOptions> = {};
    for (const key of STORED_KEYS) {
      if (options[key] !== undefined) (picked as Record<string, unknown>)[key] = options[key];
    }
    localStorage.setItem(KINDLE_CONVERSION_DEFAULTS_KEY, JSON.stringify(picked));
    return true;
  } catch {
    return false;
  }
}

export function getKindleBookFormat(book: BookWithThumbnail): string {
  const fromPath = book.filePath?.split(".").pop()?.toLowerCase() || "";
  return (book.fileType || fromPath || "").toLowerCase();
}

export function canSendToKindle(book: BookWithThumbnail): boolean {
  const format = getKindleBookFormat(book);
  return KINDLE_NATIVE_FORMATS.has(format) || KINDLE_CONVERTIBLE_FORMATS.has(format);
}

/** Book fields the main process uses to convert and stamp metadata. */
export function toKindleSendPayload(book: BookWithThumbnail) {
  return {
    fileHash: book.fileHash,
    filePath: book.filePath,
    title: getTitleWithoutExtension(book.title, book.fileType),
    author: book.author,
    fileType: book.fileType,
    fileName: book.fileName,
    publisher: book.publisher,
    description: book.description,
    publishDate: book.publishDate,
    language: book.language,
    identifier: book.identifier,
    asin: book.asin,
    subject: book.subject,
    series: book.series,
    seriesIndex: book.seriesIndex,
    authorSort: book.authorSort,
    titleSort: book.titleSort,
  };
}
