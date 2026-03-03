import { BookWithThumbnail } from "../../../../types/LibraryTypes";

export function calculateProgress(book: BookWithThumbnail): number {
  if (book.numPages <= 0) return 0;
  return Math.min((book.currentPage / book.numPages) * 100, 100);
}
