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
  not_a_book: "reading:status.notABook",
  unknown: "reading:status.unknown",
};

/** Statuses the user can pick for a book (excludes the implicit "unknown"). */
export const BOOK_READING_STATUS_VALUES: ReadingStatus[] = [
  "want_to_read",
  "reading",
  "paused",
  "read",
  "not_a_book",
];

/** Classic statuses used by the Atlas reading map (unchanged). */
export const READING_STATUS_OPTIONS: Array<{
  value: ReadingStatus;
  labelKey: TranslationKey;
}> = (["want_to_read", "reading", "paused", "read"] as ReadingStatus[]).map((value) => ({
  value,
  labelKey: READING_STATUS_LABEL_KEYS[value],
}));

/** Statuses the user can pick in the library detail panel (includes
 * "unknown" so a book can be reset to the default). */
export const LIBRARY_STATUS_SELECT_OPTIONS: Array<{
  value: ReadingStatus;
  labelKey: TranslationKey;
}> = ([...BOOK_READING_STATUS_VALUES, "unknown"] as ReadingStatus[]).map((value) => ({
  value,
  labelKey: READING_STATUS_LABEL_KEYS[value],
}));

/** Every status the library sidebar can filter by, including "unknown". */
export const LIBRARY_STATUS_FILTER_VALUES: ReadingStatus[] = [
  "reading",
  "want_to_read",
  "read",
  "paused",
  "not_a_book",
  "unknown",
];

/** Translated label for a reading status. Safe to call outside React. */
export function getReadingStatusLabel(status: ReadingStatus): string {
  return translate(READING_STATUS_LABEL_KEYS[status]);
}

export function isReadingStatus(value: unknown): value is ReadingStatus {
  return (
    value === "want_to_read" ||
    value === "reading" ||
    value === "paused" ||
    value === "read" ||
    value === "not_a_book" ||
    value === "unknown"
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

  return "unknown";
}

interface GroupReadingStatusSource extends ReadingStatusSource {
  mergedBooks?: GroupReadingStatusSource[] | null;
  rating?: number | null;
}

/** When explicit statuses disagree across merged variants, the most
 * "advanced" one wins so the group always reads as a single book. */
const GROUP_STATUS_PRECEDENCE: ReadingStatus[] = [
  "read",
  "reading",
  "paused",
  "want_to_read",
  "not_a_book",
  "unknown",
];

function groupVariants(book: GroupReadingStatusSource): GroupReadingStatusSource[] {
  return book.mergedBooks?.length ? book.mergedBooks : [book];
}

/**
 * Single status for a (possibly merged) book. Merged variants are treated as
 * one book: an explicit status on any variant is used (most decisive first),
 * otherwise the status is inferred from the most advanced variant's progress.
 */
export function getGroupReadingStatus(book: GroupReadingStatusSource): ReadingStatus {
  const variants = groupVariants(book);
  const explicit = new Set(
    variants
      .map((variant) => variant.readingStatus)
      .filter((status): status is ReadingStatus => isReadingStatus(status)),
  );
  const decisive = GROUP_STATUS_PRECEDENCE.find((status) => explicit.has(status));
  if (decisive) return decisive;

  const mostAdvanced = variants.reduce(
    (best, variant) =>
      (Number(variant.currentPage) || 0) > (Number(best.currentPage) || 0)
        ? variant
        : best,
    variants[0],
  );
  return getEffectiveReadingStatus(mostAdvanced);
}

/** Highest score among the variants of a (possibly merged) book. */
export function getGroupRating(book: GroupReadingStatusSource): number {
  return groupVariants(book).reduce(
    (max, variant) => Math.max(max, Math.max(0, Math.min(10, Number(variant.rating) || 0))),
    0,
  );
}

/** True when the book is a merged group whose variants share one status and
 * score. Collections are excluded: they group independent books. */
export function isMergedGroup(book: {
  bookId?: string | null;
  syntheticFolderType?: string | null;
}): boolean {
  if (book.syntheticFolderType === "collection") return false;
  return Boolean(book.bookId) || book.syntheticFolderType === "merged";
}
