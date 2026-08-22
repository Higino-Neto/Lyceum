import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
        onOpenReader={vi.fn()}
        onOpenPreview={onOpenPreview}
        onRefresh={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: /Preview Book\.pdf/i }));
    fireEvent.click(screen.getByRole("button", { name: "Abrir previa lateral" }));

    expect(onOpenPreview).toHaveBeenCalledWith(pdfVariant);
  });

  it("delegates conversion to the global conversion workspace", () => {
    const book = createBook();
    const onConvert = vi.fn();
    render(
      <BookDetailPanel
        book={book}
        onClose={vi.fn()}
        onOpenReader={vi.fn()}
        onConvert={onConvert}
        onRefresh={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Converter" }));

    expect(onConvert).toHaveBeenCalledWith(book);
    expect(screen.queryByRole("dialog", { name: "Converter" })).not.toBeInTheDocument();
  });

  it("routes conversion and thumbnail regeneration to the selected merged variant", async () => {
    const epubVariant = createBook();
    const pdfVariant = createBook({
      id: 2,
      title: "Preview Book.pdf",
      fileName: "Preview Book.pdf",
      filePath: "C:\\library\\_Preview Book\\Preview Book.pdf",
      fileHash: "hash-pdf",
      fileType: "pdf",
    });
    const onConvert = vi.fn();
    const onRefresh = vi.fn();
    window.api.regenerateThumbnail = vi.fn().mockResolvedValue({ success: true });

    render(
      <BookDetailPanel
        book={{
          ...epubVariant,
          fileHash: "merged-folder:preview",
          syntheticFolderPath: "_Preview Book",
          syntheticFolderType: "merged",
          mergedBooks: [epubVariant, pdfVariant],
        }}
        onClose={vi.fn()}
        onOpenReader={vi.fn()}
        onConvert={onConvert}
        onRefresh={onRefresh}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: /PDF: Preview Book\.pdf/i }));
    fireEvent.click(screen.getByRole("button", { name: "Converter" }));
    fireEvent.click(screen.getByRole("button", { name: "Thumbnail" }));

    expect(onConvert).toHaveBeenCalledWith(pdfVariant);
    await waitFor(() => {
      expect(window.api.regenerateThumbnail).toHaveBeenCalledWith("hash-pdf");
      expect(onRefresh).toHaveBeenCalledWith("hash-pdf");
    });
  });

  it("offers a non-destructive unmerge action for a merged folder", async () => {
    const epubVariant = createBook();
    const pdfVariant = createBook({
      id: 2,
      fileHash: "hash-pdf",
      filePath: "C:\\library\\_Preview Book\\Preview Book.pdf",
      fileType: "pdf",
    });
    const mergedBook = {
      ...epubVariant,
      fileHash: "merged-folder:preview",
      syntheticFolderPath: "_Preview Book",
      syntheticFolderType: "merged" as const,
      mergedBooks: [epubVariant, pdfVariant],
    };
    const onDissolve = vi.fn();

    render(
      <BookDetailPanel
        book={mergedBook}
        onClose={vi.fn()}
        onOpenReader={vi.fn()}
        onDissolve={onDissolve}
        onRefresh={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Desmesclar e manter arquivos" }));
    expect(screen.getByText(/continuarão na biblioteca como livros independentes/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Desmesclar" }));

    await waitFor(() => expect(onDissolve).toHaveBeenCalledWith(mergedBook));
  });
});
