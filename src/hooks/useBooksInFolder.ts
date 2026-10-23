import { useMemo } from "react";
import type { BookWithThumbnail, FolderInfo } from "../types/LibraryTypes";

export interface BooksInFolderInfo {
  books: BookWithThumbnail[];
  bookCount: number;
  coverPreviews: string[];
  coverPreviewPaths: string[];
}

function normalizeFolderKey(folderPath?: string | null): string {
  return (folderPath || "")
    .replace(/\\/g, "/")
    .replace(/\/+$/g, "")
    .toLowerCase();
}

function folderAncestors(folderPath: string): string[] {
  const normalized = normalizeFolderKey(folderPath);
  if (!normalized) return [];

  // Slice the normalized path at each separator instead of splitting and
  // re-joining segments: rebuilding drops the leading "/" of POSIX absolute
  // paths (and the "//" of UNC paths), so the ancestors would never match the
  // keys built from `folder.fullPath`.
  const ancestors: string[] = [];
  let end = normalized.length;
  while (end > 0) {
    ancestors.push(normalized.slice(0, end));
    const separator = normalized.lastIndexOf("/", end - 1);
    if (separator <= 0) break;
    end = separator;
  }
  return ancestors;
}

function emptyInfo(): BooksInFolderInfo {
  return {
    books: [],
    bookCount: 0,
    coverPreviews: [],
    coverPreviewPaths: [],
  };
}

function ensureInfo(map: Map<string, BooksInFolderInfo>, key: string) {
  const existing = map.get(key);
  if (existing) return existing;

  const created = emptyInfo();
  map.set(key, created);
  return created;
}

export function getFolderBookInfo(
  index: Map<string, BooksInFolderInfo>,
  folder: FolderInfo,
): BooksInFolderInfo {
  return index.get(normalizeFolderKey(folder.fullPath)) ?? emptyInfo();
}

export function useBooksInFolder(
  books: BookWithThumbnail[],
  folders: FolderInfo[],
): Map<string, BooksInFolderInfo> {
  return useMemo(() => {
    const visibleFolderKeys = new Set(
      folders.map((folder) => normalizeFolderKey(folder.fullPath)),
    );
    const index = new Map<string, BooksInFolderInfo>();

    for (const folderKey of visibleFolderKeys) {
      ensureInfo(index, folderKey);
    }

    for (const book of books) {
      const folderPath = normalizeFolderKey(book.folderPath);
      if (!folderPath) continue;

      for (const ancestor of folderAncestors(folderPath)) {
        if (!visibleFolderKeys.has(ancestor)) continue;

        const info = ensureInfo(index, ancestor);
        info.books.push(book);
        info.bookCount += 1;

        if (info.coverPreviews.length >= 3) continue;
        if (book.thumbnail) {
          info.coverPreviews.push(book.thumbnail);
        }
        if (book.thumbnailPath) {
          info.coverPreviewPaths.push(book.thumbnailPath);
        }
      }
    }

    return index;
  }, [books, folders]);
}
