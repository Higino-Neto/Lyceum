import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BookCard from "../../pages/Library/components/BookGrid/BookCard";
import {
  resetThumbnailCacheForTests,
} from "../../pages/Library/components/BookGrid/thumbnailCache";
import type { BookWithThumbnail } from "../../types/LibraryTypes";

function createBook(overrides: Partial<BookWithThumbnail> = {}): BookWithThumbnail {
  return {
    id: 1,
    title: "Cached Book.epub",
    filePath: "C:\\library\\Cached Book.epub",
    fileHash: "hash-1",
    currentPage: 1,
    currentZoom: null,
    currentScroll: null,
    annotations: null,
    thumbnailPath: "thumb.webp",
    numPages: 12,
    createdAt: "2026-01-01T00:00:00.000Z",
    lastOpenedAt: "2026-01-02T00:00:00.000Z",
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
    fileSize: 1024,
    processingStatus: "completed",
    fileType: "epub",
    ...overrides,
  };
}

describe("BookCard", () => {
  beforeEach(() => {
    resetThumbnailCacheForTests();
    vi.restoreAllMocks();
  });

  it("loads thumbnails through the renderer cache batch API", async () => {
    const getThumbnail = vi.fn().mockResolvedValue("data:image/webp;base64,slow");
    const getThumbnails = vi.fn().mockResolvedValue({
      "thumb.webp": "data:image/webp;base64,cached",
    });

    Object.defineProperty(window, "api", {
      value: { getThumbnail, getThumbnails },
      writable: true,
      configurable: true,
    });

    render(
      <BookCard
        book={createBook()}
        onOpen={vi.fn()}
        showSyncActions={false}
      />,
    );

    await waitFor(() => {
      expect(getThumbnails).toHaveBeenCalledWith(["thumb.webp"]);
      expect(getThumbnail).not.toHaveBeenCalled();
      expect(screen.getByAltText("Cached Book.epub")).toHaveAttribute(
        "src",
        "data:image/webp;base64,cached",
      );
    });
  });
});
