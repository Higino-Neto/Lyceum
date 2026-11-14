import type { BookWithThumbnail } from "../../types/LibraryTypes";
import { calculateSimilarity, getBookFolderLabel } from "../../pages/Library/utils";
import type {
  FileTypeFilter,
  SortOption,
} from "../../pages/Library/components/FilterBar";
import {
  compareText,
  normalizeCase,
} from "../../i18n";

export function matchesLibraryBookSearch(book: BookWithThumbnail, query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return true;

  const haystack = [
    book.title,
    book.author,
    book.fileName,
    book.series,
    book.publisher,
    getBookFolderLabel(book.filePath),
  ]
    .filter(Boolean)
    .join(" ")
    .split(" ")
    .map(normalizeCase)
    .join(" ");
  const normalizedQuery = normalizeCase(trimmed);

  return (
    haystack.includes(normalizedQuery) ||
    calculateSimilarity(book.title || "", book.author || null, trimmed).matches
  );
}

export function matchesLibraryBookFileTypes(
  book: BookWithThumbnail,
  filters: FileTypeFilter[],
): boolean {
  const activeFilters = filters.filter((filter): filter is Exclude<FileTypeFilter, "all"> => (
    filter !== "all"
  ));
  if (activeFilters.length === 0) return true;
  return Boolean(book.fileType && activeFilters.includes(book.fileType as Exclude<FileTypeFilter, "all">));
}

export function sortLibraryBooks(
  books: BookWithThumbnail[],
  sort: SortOption,
): BookWithThumbnail[] {
  return [...books].sort((left, right) => {
    switch (sort) {
      case "title_desc":
        return compareText(right.title, left.title) || right.id - left.id;
      case "recent_desc":
        return new Date(right.lastOpenedAt || right.createdAt).getTime() -
          new Date(left.lastOpenedAt || left.createdAt).getTime();
      case "recent_asc":
        return new Date(left.lastOpenedAt || left.createdAt).getTime() -
          new Date(right.lastOpenedAt || right.createdAt).getTime();
      case "pages_desc":
        return (right.numPages || 0) - (left.numPages || 0);
      case "pages_asc":
        return (left.numPages || 0) - (right.numPages || 0);
      case "size_desc":
        return (right.fileSize || 0) - (left.fileSize || 0);
      case "size_asc":
        return (left.fileSize || 0) - (right.fileSize || 0);
      case "title_asc":
      default:
        return compareText(left.title, right.title) || left.id - right.id;
    }
  });
}
