import type { BookFileType, BookWithThumbnail } from "../types/LibraryTypes";

export const LOCAL_BOOK_HASH_PREFIX = "local:";

/** Conversion items that are not library documents and must be converted by path. */
export function isPathBasedBook(book: Pick<BookWithThumbnail, "fileHash">) {
  return ["usb:", "mtp:", LOCAL_BOOK_HASH_PREFIX].some((prefix) => book.fileHash.startsWith(prefix));
}

const EXTENSION_TYPES: Record<string, BookFileType> = { htm: "html" };

/** Builds a draft conversion entry for a file picked from disk (outside the library). */
export function createLocalBook(file: { path: string; name: string; extension: string; size: number }, index = 0): BookWithThumbnail {
  const now = new Date().toISOString();
  return {
    id: -100_000 - index - Math.floor(Math.random() * 1_000_000),
    title: file.name,
    filePath: file.path,
    fileHash: `${LOCAL_BOOK_HASH_PREFIX}${file.path}`,
    fileName: file.name,
    folderPath: file.path.replace(/[/\\][^/\\]*$/, ""),
    currentPage: 1,
    currentZoom: null,
    currentScroll: null,
    annotations: null,
    thumbnailPath: null,
    numPages: 0,
    createdAt: now,
    lastOpenedAt: now,
    isSynced: 0,
    category: null,
    isFavorite: 0,
    rating: 0,
    notes: null,
    author: null,
    description: null,
    isbn: null,
    publisher: null,
    publishDate: null,
    fileSize: file.size,
    processingStatus: "completed",
    fileType: (EXTENSION_TYPES[file.extension] || file.extension) as BookFileType,
  };
}
