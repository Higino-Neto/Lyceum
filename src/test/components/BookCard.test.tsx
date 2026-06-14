import { render, screen } from "@testing-library/react";
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

const VALID_HASH = "a".repeat(64);

describe("BookCard", () => {
  beforeEach(() => {
    resetThumbnailCacheForTests();
    vi.restoreAllMocks();
  });

  it("renders img with thumbnail prop when provided", () => {
    render(
      <BookCard
        book={createBook({ thumbnail: "data:image/webp;base64,inline" })}
        onOpen={vi.fn()}
        showSyncActions={false}
      />,
    );

    const img = screen.getByAltText("Cached Book.epub");
    expect(img).toHaveAttribute("src", "data:image/webp;base64,inline");
  });

  it("renders img with thumb:// URL when thumbnailPath has a valid hash", () => {
    const thumbnailPath = `C:\\thumbnails\\${VALID_HASH}-thumbnail.webp`;
    render(
      <BookCard
        book={createBook({ thumbnailPath })}
        onOpen={vi.fn()}
        showSyncActions={false}
      />,
    );

    const img = screen.getByAltText("Cached Book.epub");
    expect(img).toHaveAttribute("src", `thumb://${VALID_HASH}`);
  });

  it("shows fallback icon when no thumbnail is available", () => {
    render(
      <BookCard
        book={createBook({ thumbnail: undefined, thumbnailPath: "thumb.webp" })}
        onOpen={vi.fn()}
        showSyncActions={false}
      />,
    );

    expect(screen.queryByAltText("Cached Book.epub")).not.toBeInTheDocument();
    expect(document.querySelector(".lucide-file-text")).toBeTruthy();
  });
});
