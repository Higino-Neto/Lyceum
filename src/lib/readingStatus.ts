import type { ReadingStatus } from "../types/LibraryTypes";
import type { TranslationKey } from "../i18n/keys";
import { translate } from "../i18n";

interface ReadingStatusSource {
  readingStatus?: ReadingStatus | null;
  currentPage?: number | null;
  numPages?: number | null;
}

export const READING_STATUS_LABEL_KEYS: Record<ReadingStatus, TranslationKey> = {
  want_to_read: "reading:status.wantToRead",
  reading: "reading:status.reading",
  paused: "reading:status.paused",
  read: "reading:status.read",
};

export const READING_STATUS_OPTIONS: Array<{
  value: ReadingStatus;
  labelKey: TranslationKey;
}> = (Object.keys(READING_STATUS_LABEL_KEYS) as ReadingStatus[]).map((value) => ({
  value,
  labelKey: READING_STATUS_LABEL_KEYS[value],
}));

/** Translated label for a reading status. Safe to call outside React. */
export function getReadingStatusLabel(status: ReadingStatus): string {
  return translate(READING_STATUS_LABEL_KEYS[status]);
}

export function isReadingStatus(value: unknown): value is ReadingStatus {
  return (
    value === "want_to_read" ||
    value === "reading" ||
    value === "paused" ||
    value === "read"
  );
}

export function getEffectiveReadingStatus(
  book: ReadingStatusSource,
): ReadingStatus {
  if (isReadingStatus(book.readingStatus)) {
    return book.readingStatus;
  }

  const currentPage = Math.max(0, Number(book.currentPage) || 0);
  const totalPages = Math.max(0, Number(book.numPages) || 0);

  if (totalPages > 1 && currentPage >= totalPages) {
    return "read";
  }

  if (currentPage > 1) {
    return "reading";
  }

  return "want_to_read";
}
