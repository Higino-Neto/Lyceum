import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BookDetailPanel from "../../pages/Library/components/BookDetailPanel";
import type { BookWithThumbnail } from "../../types/LibraryTypes";

function createBook(overrides: Partial<BookWithThumbnail> = {}): BookWithThumbnail {
  return {
    id: 1,
    title: "Preview Book.epub",
    filePath: "C:\\library\\Preview Book.epub",
    fileHash: "hash-epub",
    currentPage: 1,
    currentZoom: null,
    currentScroll: null,
    annotations: null,
    thumbnailPath: null,
    numPages: 120,
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

describe("BookDetailPanel", () => {
  beforeEach(() => {
    Object.defineProperty(window, "api", {
      value: {
        getVocabularyStats: vi.fn().mockResolvedValue(null),
        getThumbnail: vi.fn().mockResolvedValue(null),
      },
      writable: true,
      configurable: true,
    });
  });

  it("opens the reading preview with the selected format variant", () => {
    const epubVariant = createBook();
    const pdfVariant = createBook({
      id: 2,
      title: "Preview Book.pdf",
      fileName: "Preview Book.pdf",
      filePath: "C:\\library\\Preview Book.pdf",
      fileHash: "hash-pdf",
      fileType: "pdf",
    });
    const onOpenPreview = vi.fn();

    render(
      <BookDetailPanel
        book={{ ...epubVariant, mergedBooks: [epubVariant, pdfVariant] }}
        onClose={vi.fn()}
        onOpenEmbed={vi.fn()}
        onOpenPreview={onOpenPreview}
        onRefresh={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Preview Book\.pdf/i }));
    fireEvent.click(screen.getByRole("button", { name: "Abrir previa lateral" }));

    expect(onOpenPreview).toHaveBeenCalledWith(pdfVariant);
  });
});
