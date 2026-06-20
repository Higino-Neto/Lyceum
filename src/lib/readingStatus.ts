import type { ReadingStatus } from "../types/LibraryTypes";

interface ReadingStatusSource {
  readingStatus?: ReadingStatus | null;
  currentPage?: number | null;
  numPages?: number | null;
}

export const READING_STATUS_OPTIONS: Array<{
  value: ReadingStatus;
  label: string;
}> = [
  { value: "want_to_read", label: "Fila" },
  { value: "reading", label: "Lendo" },
  { value: "paused", label: "Pausado" },
  { value: "read", label: "Concluido" },
];

export const READING_STATUS_LABELS: Record<ReadingStatus, string> = {
  want_to_read: "Fila",
  reading: "Lendo",
  paused: "Pausado",
  read: "Concluido",
};

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
