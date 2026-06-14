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

describe("useBooksInFolder", () => {
  it("indexes books by visible ancestor folders and collects previews", () => {
    const parent = folder({ name: "Parent", fullPath: "C:/library/Parent" });
    const child = folder({ name: "Child", fullPath: "C:/library/Parent/Child" });
    const books = [
      book({
        fileHash: "a",
        folderPath: "C:/library/Parent/Child",
        thumbnail: "data:image/png;base64,a",
        thumbnailPath: "thumb-a.webp",
      }),
      book({
        fileHash: "b",
        folderPath: "C:/library/Other",
      }),
    ];

    const { result } = renderHook(() => useBooksInFolder(books, [parent, child]));

    const parentInfo = getFolderBookInfo(result.current, parent);
    const childInfo = getFolderBookInfo(result.current, child);

    expect(parentInfo.bookCount).toBe(1);
    expect(childInfo.bookCount).toBe(1);
    expect(childInfo.coverPreviews).toEqual(["data:image/png;base64,a"]);
    expect(childInfo.coverPreviewPaths).toEqual(["thumb-a.webp"]);
  });
});
