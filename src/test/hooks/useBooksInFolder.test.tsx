import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getFolderBookInfo, useBooksInFolder } from "../../hooks/useBooksInFolder";
import type { BookWithThumbnail, FolderInfo } from "../../types/LibraryTypes";

function folder(overrides: Partial<FolderInfo>): FolderInfo {
  return {
    name: "Folder",
    path: "Folder",
    fullPath: "C:/library/Folder",
    bookCount: 0,
    subfolders: [],
    ...overrides,
  };
}

function book(overrides: Partial<BookWithThumbnail>): BookWithThumbnail {
  return {
    id: 1,
    title: "Book",
    filePath: "C:/library/Folder/Book.epub",
    fileHash: "hash",
    currentPage: 1,
    currentZoom: null,
    currentScroll: null,
    annotations: null,
    thumbnailPath: null,
    numPages: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    lastOpenedAt: "2026-01-01T00:00:00.000Z",
    isSynced: 1,
    category: null,
    isFavorite: 0,
    rating: 0,
    notes: null,
    author: null,
    description: null,
    isbn: null,
    publisher: null,
    publishDate: null,
    fileSize: 1,
    processingStatus: "completed",
    ...overrides,
  };
}

interface PathStyle {
  label: string;
  parent: string;
  child: string;
  other: string;
}

/**
 * Covers every path shape the app can hand us. POSIX absolute and UNC paths
 * start with a separator and used to lose it when ancestors were rebuilt.
 */
const pathStyles: PathStyle[] = [
  {
    label: "windows drive paths with backslashes",
    parent: "C:\\library\\Parent",
    child: "C:\\library\\Parent\\Child",
    other: "C:\\library\\Other",
  },
  {
    label: "windows drive paths with forward slashes",
    parent: "C:/library/Parent",
    child: "C:/library/Parent/Child",
    other: "C:/library/Other",
  },
  {
    label: "posix absolute paths",
    parent: "/home/user/library/Parent",
    child: "/home/user/library/Parent/Child",
    other: "/home/user/library/Other",
  },
  {
    label: "unc paths",
    parent: "\\\\server\\share\\Parent",
    child: "\\\\server\\share\\Parent\\Child",
    other: "\\\\server\\share\\Other",
  },
];

describe("useBooksInFolder", () => {
  for (const { label, parent: parentPath, child: childPath, other: otherPath } of pathStyles) {
    it(`indexes books by visible ancestor folders for ${label}`, () => {
      const parent = folder({ name: "Parent", fullPath: parentPath });
      const child = folder({ name: "Child", fullPath: childPath });
      const books = [
        book({
          fileHash: "a",
          folderPath: childPath,
          thumbnail: "data:image/png;base64,a",
          thumbnailPath: "thumb-a.webp",
        }),
        book({
          fileHash: "b",
          folderPath: otherPath,
        }),
      ];

      const { result } = renderHook(() => useBooksInFolder(books, [parent, child]));

      const parentInfo = getFolderBookInfo(result.current, parent);
      const childInfo = getFolderBookInfo(result.current, child);

      expect(parentInfo.bookCount).toBe(1);
      expect(childInfo.bookCount).toBe(1);
      expect(parentInfo.coverPreviews).toEqual(["data:image/png;base64,a"]);
      expect(childInfo.coverPreviews).toEqual(["data:image/png;base64,a"]);
      expect(childInfo.coverPreviewPaths).toEqual(["thumb-a.webp"]);
    });
  }

  it("collects previews for a book sitting directly in a posix folder", () => {
    // Regression: ancestors of "/home/user/library/Parent" lost the leading
    // slash, so this folder never matched and its cover previews stayed empty.
    const containing = folder({ name: "Parent", fullPath: "/home/user/library/Parent" });
    const books = [
      book({
        fileHash: "a",
        folderPath: "/home/user/library/Parent",
        thumbnailPath: "/thumbs/a.webp",
      }),
    ];

    const { result } = renderHook(() => useBooksInFolder(books, [containing]));

    const info = getFolderBookInfo(result.current, containing);

    expect(info.bookCount).toBe(1);
    expect(info.coverPreviewPaths).toEqual(["/thumbs/a.webp"]);
  });

  it("does not match folders that are not ancestors of the book", () => {
    const unrelated = folder({ name: "Unrelated", fullPath: "/home/user/library/Unrelated" });
    const books = [
      book({ fileHash: "a", folderPath: "/home/user/library/Parent/Child", thumbnailPath: "thumb-a.webp" }),
    ];

    const { result } = renderHook(() => useBooksInFolder(books, [unrelated]));

    const info = getFolderBookInfo(result.current, unrelated);

    expect(info.bookCount).toBe(0);
    expect(info.coverPreviewPaths).toEqual([]);
  });
});
