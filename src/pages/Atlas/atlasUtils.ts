import type {
  BookWithThumbnail,
  LibraryListResult,
  ReadingStatusItem,
  ReadingStatusPayload,
} from "../../types/LibraryTypes";
import type TableReading from "../../types/TableReading";
import {
  getTitleWithoutExtension,
} from "../Library/utils";
import {
  getActiveLocale,
  normalizeCase,
  translate,
} from "../../i18n";

export async function fetchAtlasBooks(): Promise<BookWithThumbnail[]> {
  const books: BookWithThumbnail[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const page = await window.api.listBooks({
      section: "all",
      search: "",
      sort: "title_asc",
      fileType: "all",
      folderPath: null,
      limit: 200,
      offset,
    }) as LibraryListResult;

    books.push(...page.items);
    hasMore = page.hasMore;
    offset = page.offset + page.limit;
  }

  return books;
}

export async function fetchReadingStatusItems(): Promise<ReadingStatusPayload> {
  const result = await window.api.getReadingStatusItems();
  if (!result.success || !result.payload) {
    throw new Error(result.error || translate("atlas:errors.loadStatusFailed"));
  }
  return result.payload;
}

export function getNavigationId(): string {
  return globalThis.crypto?.randomUUID?.() || String(Date.now());
}

function normalizeReadingTitle(value?: string | null): string {
  return getTitleWithoutExtension(value || "", undefined)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\.(pdf|epub|azw3|mobi|cbz|txt|docx|html)$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map(normalizeCase)
    .join(" ");
}

export function getExternalReadingPages(
  item: ReadingStatusItem,
  readings: TableReading[],
): number {
  if (readings.length === 0) return 0;
  const titles = new Set([
    normalizeReadingTitle(item.title),
    normalizeReadingTitle(item.book?.title),
    normalizeReadingTitle(item.book?.fileName),
  ].filter(Boolean));

  return readings.reduce((sum, reading) => (
    titles.has(normalizeReadingTitle(reading.source_name))
      ? sum + (Number(reading.pages) || 0)
      : sum
  ), 0);
}

export function getStatusItemTotalPages(item: ReadingStatusItem): number {
  return Math.max(0, Number(item.manualTotalPages || item.book?.numPages || 0));
}

export function getStatusItemReadPages(item: ReadingStatusItem, externalPages: number): number {
  const manualPages = Math.max(
    0,
    (Number(item.manualCurrentPage) || 0) - (Number(item.manualBasePage) || 0),
  );
  return Math.max(
    0,
    manualPages +
      (Number(item.localProgressPages) || 0) +
      externalPages,
  );
}

function getMatchingReadings(item: ReadingStatusItem, readings: TableReading[]): TableReading[] {
  if (readings.length === 0) return [];
  const titles = new Set([
    normalizeReadingTitle(item.title),
    normalizeReadingTitle(item.book?.title),
    normalizeReadingTitle(item.book?.fileName),
  ].filter(Boolean));

  return readings.filter((reading) => titles.has(normalizeReadingTitle(reading.source_name)));
}

export function formatLastReading(item: ReadingStatusItem, readings: TableReading[]): string | null {
  const matches = getMatchingReadings(item, readings);
  if (matches.length === 0) return null;

  const latest = [...matches].sort((left, right) => {
    const leftDate = `${left.reading_date || ""} ${left.created_at || ""}`;
    const rightDate = `${right.reading_date || ""} ${right.created_at || ""}`;
    return rightDate.localeCompare(leftDate);
  })[0];

  if (!latest?.reading_date) return translate("atlas:board.lastReading.recent");
  try {
    return new Intl.DateTimeFormat(getActiveLocale(), {
      day: "2-digit",
      month: "short",
    }).format(new Date(`${latest.reading_date}T00:00:00`));
  } catch {
    return latest.reading_date;
  }
}

export function getManualCoverSrc(pathValue: string | null): string | null {
  if (!pathValue) return null;
  if (/^(https?:|data:)/i.test(pathValue)) return pathValue;
  return null;
}

export function createSyntheticBook(item: ReadingStatusItem): BookWithThumbnail {
  return {
    id: -1,
    title: item.title,
    filePath: "",
    fileHash: item.bookId || item.id,
    currentPage: item.manualCurrentPage || 0,
    currentZoom: null,
    currentScroll: null,
    annotations: null,
    thumbnailPath: item.coverPath,
    numPages: item.manualTotalPages || 0,
    createdAt: item.createdAt,
    lastOpenedAt: item.updatedAt,
    isSynced: 0,
    category: null,
    isFavorite: 0,
    rating: item.rating || 0,
    notes: null,
    author: item.author,
    description: item.description,
    isbn: item.isbn,
    publisher: item.publisher,
    publishDate: item.publishDate,
    fileSize: 0,
    processingStatus: "completed",
    fileType: "epub",
    readingStatus: item.status,
    completedAt: item.status === "read" ? item.updatedAt : null,
    language: null,
    identifier: null,
    asin: null,
    subject: item.subject,
    series: null,
    seriesIndex: null,
    authorSort: null,
    titleSort: null,
    bookId: null,
    importedAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}
