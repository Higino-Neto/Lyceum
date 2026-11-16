import type {
  BookWithThumbnail,
  LibraryFileTypeFilter,
  LibrarySection,
  LibrarySortOption,
} from "../../../types/LibraryTypes";
import { getTitleWithoutExtension } from "./folders";
import { calculateSimilarity } from "./search";
import { getActiveLocale, normalizeCase } from "../../../i18n";
import { getGroupReadingStatus } from "../../../lib/readingStatus";

export function isAbsoluteFolderPath(folderPath: string | null): boolean {
  return Boolean(
    folderPath
    && (/^[a-zA-Z]:[\\/]/.test(folderPath) || folderPath.startsWith("/") || folderPath.startsWith("\\\\")),
  );
}

export function getPathLeaf(folderPath?: string | null): string {
  return (folderPath || "").split(/[\\/]+/).filter(Boolean).at(-1) || "";
}

export function normalizeAbsoluteFolderPath(folderPath?: string | null): string {
  return (folderPath || "").replace(/\\/g, "/").replace(/\/+$/g, "").toLowerCase();
}

export function pickRepresentativeBook(books: BookWithThumbnail[]): BookWithThumbnail | undefined {
  return (
    books.find((book) => book.thumbnailPath && (book.fileType === "epub" || book.fileType === "pdf"))
    || books.find((book) => book.fileType === "epub" || book.fileType === "pdf")
    || books.find((book) => book.thumbnailPath || book.thumbnail)
    || books.find((book) => book.fileType === "epub")
    || books[0]
  );
}

function getBookSortTitle(book: BookWithThumbnail): string {
  return getTitleWithoutExtension(
    book.title || book.fileName || book.filePath || "",
    book.fileType,
  ).toLocaleLowerCase(getActiveLocale());
}

function getBookAddedDate(book: BookWithThumbnail): number {
  const value = book.importedAt || book.createdAt;
  const time = value ? new Date(value).getTime() : 0;
  return Number.isNaN(time) ? 0 : time;
}

function compareOptionalText(left: string | null | undefined, right: string | null | undefined, direction: 1 | -1): number {
  const leftValue = left?.trim() || "";
  const rightValue = right?.trim() || "";
  // Missing values sort last in both directions, like the SQL ordering.
  if (!leftValue || !rightValue) return leftValue ? -1 : rightValue ? 1 : 0;
  return direction * leftValue.localeCompare(rightValue, getActiveLocale(), { sensitivity: "base", numeric: true });
}

function compareSeries(left: BookWithThumbnail, right: BookWithThumbnail, direction: 1 | -1): number {
  const bySeries = compareOptionalText(left.series, right.series, direction);
  if (bySeries || !left.series?.trim()) return bySeries;
  return direction * ((Number.parseFloat(left.seriesIndex || "") || 0) - (Number.parseFloat(right.seriesIndex || "") || 0));
}

function getBookSortDate(book: BookWithThumbnail): number {
  const value = book.lastOpenedAt || book.updatedAt || book.importedAt || book.createdAt;
  const time = value ? new Date(value).getTime() : 0;
  return Number.isNaN(time) ? 0 : time;
}

export function sortBooksForLibraryView(
  books: BookWithThumbnail[],
  sortOption: LibrarySortOption,
): BookWithThumbnail[] {
  const indexed = books.map((book, index) => ({ book, index }));
  indexed.sort((left, right) => {
    const titleCompare = getBookSortTitle(left.book).localeCompare(
      getBookSortTitle(right.book),
      getActiveLocale(),
      { sensitivity: "base", numeric: true },
    );

    let result = 0;
    switch (sortOption) {
      case "title_desc": result = -titleCompare || right.book.id - left.book.id; break;
      case "recent":
      case "recent_desc": result = getBookSortDate(right.book) - getBookSortDate(left.book) || right.book.id - left.book.id; break;
      case "recent_asc": result = getBookSortDate(left.book) - getBookSortDate(right.book) || left.book.id - right.book.id; break;
      case "pages":
      case "pages_desc": result = (right.book.numPages || 0) - (left.book.numPages || 0) || titleCompare; break;
      case "pages_asc": result = (left.book.numPages || 0) - (right.book.numPages || 0) || titleCompare; break;
      case "size":
      case "size_desc": result = (right.book.fileSize || 0) - (left.book.fileSize || 0) || titleCompare; break;
      case "size_asc": result = (left.book.fileSize || 0) - (right.book.fileSize || 0) || titleCompare; break;
      case "author_asc": result = compareOptionalText(left.book.authorSort || left.book.author, right.book.authorSort || right.book.author, 1) || titleCompare; break;
      case "author_desc": result = compareOptionalText(left.book.authorSort || left.book.author, right.book.authorSort || right.book.author, -1) || titleCompare; break;
      case "series_asc": result = compareSeries(left.book, right.book, 1) || titleCompare; break;
      case "series_desc": result = compareSeries(left.book, right.book, -1) || titleCompare; break;
      case "rating_desc": result = (right.book.rating || 0) - (left.book.rating || 0) || titleCompare; break;
      case "rating_asc": result = (left.book.rating || 0) - (right.book.rating || 0) || titleCompare; break;
      case "type_asc": result = compareOptionalText(left.book.fileType, right.book.fileType, 1) || titleCompare; break;
      case "type_desc": result = compareOptionalText(left.book.fileType, right.book.fileType, -1) || titleCompare; break;
      case "added_desc": result = getBookAddedDate(right.book) - getBookAddedDate(left.book) || right.book.id - left.book.id; break;
      case "added_asc": result = getBookAddedDate(left.book) - getBookAddedDate(right.book) || left.book.id - right.book.id; break;
      case "title":
      case "title_asc":
      default: result = titleCompare || left.book.id - right.book.id; break;
    }

    return result || left.index - right.index;
  });
  return indexed.map(({ book }) => book);
}

export function matchesLibrarySearch(book: BookWithThumbnail, query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return true;

  return [book, ...(book.mergedBooks || [])].some((candidate) => {
    const haystack = [
      candidate.title,
      candidate.author,
      candidate.fileName,
      candidate.series,
      candidate.publisher,
    ].filter(Boolean).join(" ");
    return (
      normalizeCase(haystack).includes(normalizeCase(trimmed))
      || calculateSimilarity(candidate.title || "", candidate.author || null, trimmed).matches
    );
  });
}

export function matchesLibraryFileTypes(
  book: BookWithThumbnail,
  filters: LibraryFileTypeFilter[],
): boolean {
  const activeFilters = filters.filter(
    (filter): filter is Exclude<LibraryFileTypeFilter, "all"> => filter !== "all",
  );
  if (activeFilters.length === 0) return true;
  const candidates = book.mergedBooks?.length ? book.mergedBooks : [book];
  return candidates.some(
    (candidate) => candidate.fileType ? activeFilters.includes(candidate.fileType) : false,
  );
}

/** A book matches the reading-status filter with the same single status the
 * grid displays for it (merged formats share one group status). */
export function matchesLibraryReadingStatus(
  book: BookWithThumbnail,
  readingStatuses: string[] | null | undefined,
): boolean {
  if (!readingStatuses) return true;
  return readingStatuses.includes(getGroupReadingStatus(book));
}

export function getMergedBookSignature(group: BookWithThumbnail[]): string {
  return group.map((book) => [
    book.id,
    book.fileHash,
    book.title,
    book.filePath,
    book.thumbnail,
    book.thumbnailPath,
    book.numPages,
    book.fileType,
    book.fileSize,
    book.lastOpenedAt,
    book.createdAt,
    book.processingStatus,
    book.updatedAt,
  ].join("\u001f")).join("\u001e");
}

export interface MergedBookCacheEntry {
  representative: BookWithThumbnail;
  signature: string;
  value: BookWithThumbnail;
}

export interface DisplayBooksInput {
  section: LibrarySection;
  books: BookWithThumbnail[];
  search: string;
  fileTypes: LibraryFileTypeFilter[];
  readingStatuses?: string[] | null;
  sort: LibrarySortOption;
  previousCache: Map<string, MergedBookCacheEntry>;
}

/** Pure library projection; callers own the cache across renders. */
export function buildDisplayBooks(input: DisplayBooksInput): {
  books: BookWithThumbnail[];
  cache: Map<string, MergedBookCacheEntry>;
} {
  if (input.section === "usb") return { books: input.books, cache: input.previousCache };

  const booksForGrouping = sortBooksForLibraryView(input.books, input.sort);
  const grouped = new Map<string, BookWithThumbnail[]>();
  for (const book of booksForGrouping) {
    const groupKey = book.bookId || book.fileHash;
    const group = grouped.get(groupKey) || [];
    group.push(book);
    grouped.set(groupKey, group);
  }

  const cache = new Map<string, MergedBookCacheEntry>();
  const books = Array.from(grouped, ([groupKey, group]) => {
    const representative = pickRepresentativeBook(group)!;
    if (group.length <= 1) return representative;

    const signature = getMergedBookSignature(group);
    const cached = input.previousCache.get(groupKey);
    if (cached && cached.representative === representative && cached.signature === signature) {
      cache.set(groupKey, cached);
      return cached.value;
    }

    const value = { ...representative, mergedBooks: group };
    cache.set(groupKey, { representative, signature, value });
    return value;
  });
  return { books, cache };
}
