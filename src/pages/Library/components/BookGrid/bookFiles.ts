import type { BookWithThumbnail } from "../../../../types/LibraryTypes";

/** Files that make up one library item: every format of a merged book, or the book itself. */
export function getBookFiles(book: BookWithThumbnail): BookWithThumbnail[] {
  return book.mergedBooks?.length ? book.mergedBooks : [book];
}

/** Stable key of which of this book's files are selected; keeps memoized rows cheap. */
export function getSelectedFilesKey(book: BookWithThumbnail, selectedHashes: Set<string>): string {
  if (selectedHashes.size === 0) return "";
  return getBookFiles(book)
    .filter((file) => selectedHashes.has(file.fileHash))
    .map((file) => file.fileHash)
    .join(",");
}

export type FileSelectionState = "none" | "partial" | "all";

export function getFileSelectionState(book: BookWithThumbnail, selectedFilesKey: string): FileSelectionState {
  if (!selectedFilesKey) return "none";
  const selectedCount = selectedFilesKey.split(",").length;
  return selectedCount >= getBookFiles(book).length ? "all" : "partial";
}
