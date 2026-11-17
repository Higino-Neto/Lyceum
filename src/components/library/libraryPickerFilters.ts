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
import { sortBooksForLibraryView } from "../../features/library/model/libraryView";

const PICKER_SORTS = new Set<SortOption>([
  "title_asc", "title_desc", "recent_desc", "recent_asc", "pages_desc", "pages_asc", "size_desc", "size_asc",
]);

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
  if (!PICKER_SORTS.has(sort)) return sortBooksForLibraryView(books, sort);
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

function bookDirectory(book: BookWithThumbnail): string | null {
  if (!book.filePath) return null;
  const normalized = book.filePath.replace(/\\/g, "/");
  const slash = normalized.lastIndexOf("/");
  return slash > 0 ? normalized.slice(0, slash) : null;
}

export interface PickerFolder {
  /** Absolute directory (forward slashes); also the filter key. */
  key: string;
  label: string;
  depth: number;
  /** Books in this folder and its subfolders. */
  count: number;
}

/**
 * Folders that contain books, with ancestor folders filled in so the list
 * reads like a tree. Labels are relative to the library when possible.
 */
export function buildPickerFolders(books: BookWithThumbnail[]): PickerFolder[] {
  const direct = new Map<string, number>();
  for (const book of books) {
    const directory = bookDirectory(book);
    if (directory) direct.set(directory, (direct.get(directory) ?? 0) + 1);
  }
  if (direct.size === 0) return [];

  // Root = deepest directory shared by every book (usually the library folder).
  const split = [...direct.keys()].map((directory) => directory.split("/"));
  let rootLength = split[0].length;
  for (const parts of split) {
    let index = 0;
    while (index < rootLength && index < parts.length && parts[index] === split[0][index]) index += 1;
    rootLength = index;
  }

  const counts = new Map<string, number>();
  for (const [directory, count] of direct) {
    const parts = directory.split("/");
    for (let length = rootLength + 1; length <= parts.length; length += 1) {
      const key = parts.slice(0, length).join("/");
      counts.set(key, (counts.get(key) ?? 0) + count);
    }
  }

  return [...counts.entries()]
    .map(([key, count]) => {
      const relative = key.split("/").slice(rootLength);
      return { key, label: relative.at(-1) ?? key, depth: relative.length - 1, count, sortKey: relative.join("/") };
    })
    .sort((left, right) => compareText(left.sortKey, right.sortKey))
    .map(({ sortKey: _sortKey, ...folder }) => folder);
}

export function matchesPickerFolder(book: BookWithThumbnail, folderKey: string | null): boolean {
  if (!folderKey) return true;
  const directory = bookDirectory(book);
  return Boolean(directory && (directory === folderKey || directory.startsWith(`${folderKey}/`)));
}
