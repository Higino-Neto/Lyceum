import { describe, expect, it } from "vitest";
import type { BookWithThumbnail, FolderInfo } from "../../../types/LibraryTypes";
import {
  buildSpecialFolderBook,
  collectSpecialFoldersForDisplay,
  getPathLeaf,
  isAbsoluteFolderPath,
  matchesLibraryFileTypes,
  matchesLibrarySearch,
  normalizeAbsoluteFolderPath,
  pickRepresentativeBook,
  sortBooksForLibraryView,
} from "./libraryView";

function book(overrides: Partial<BookWithThumbnail> = {}): BookWithThumbnail {
  return {
    id: 1,
    title: "Livro",
    filePath: "/library/livro.pdf",
    fileHash: "hash-1",
    currentPage: 0,
    currentZoom: null,
    currentScroll: null,
    annotations: null,
    thumbnailPath: null,
    numPages: 100,
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
    fileSize: 1024,
    processingStatus: "completed",
    fileType: "pdf",
    ...overrides,
  };
}

function folder(name: string, path: string, subfolders: FolderInfo[] = []): FolderInfo {
  return { name, path, fullPath: `/library/${path}`, bookCount: 0, subfolders };
}

describe("library view model", () => {
  it("normalizes paths without depending on the host operating system", () => {
    expect(isAbsoluteFolderPath("C:\\Books\\Fiction")).toBe(true);
    expect(isAbsoluteFolderPath("/books/fiction")).toBe(true);
    expect(isAbsoluteFolderPath("fiction")).toBe(false);
    expect(getPathLeaf("C:\\Books\\Fiction")).toBe("Fiction");
    expect(normalizeAbsoluteFolderPath("C:\\Books\\Fiction\\")).toBe("c:/books/fiction");
  });

  it("sorts a copied collection and preserves the input order", () => {
    const books = [
      book({ id: 2, fileHash: "b", title: "Zeta.pdf", numPages: 20 }),
      book({ id: 1, fileHash: "a", title: "Álgebra.pdf", numPages: 200 }),
    ];

    expect(sortBooksForLibraryView(books, "title_asc").map(({ id }) => id)).toEqual([1, 2]);
    expect(sortBooksForLibraryView(books, "pages_desc").map(({ id }) => id)).toEqual([1, 2]);
    expect(books.map(({ id }) => id)).toEqual([2, 1]);
  });

  it("searches and filters across every variant of a merged book", () => {
    const merged = book({
      title: "Edição principal",
      fileType: "pdf",
      mergedBooks: [book({ fileHash: "epub", title: "Dom Casmurro", author: "Machado", fileType: "epub" })],
    });

    expect(matchesLibrarySearch(merged, "Machado")).toBe(true);
    expect(matchesLibraryFileTypes(merged, ["epub"])).toBe(true);
    expect(matchesLibraryFileTypes(merged, ["cbz"])).toBe(false);
  });

  it("discovers nested special folders only when requested", () => {
    const nested = folder("_Unidas", "normal/_Unidas");
    const roots = [folder("normal", "normal", [nested]), folder("__Coleção", "__Coleção")];

    expect(collectSpecialFoldersForDisplay(roots, false).map(({ folder: item }) => item.name))
      .toEqual(["__Coleção"]);
    expect(collectSpecialFoldersForDisplay(roots, true).map(({ folder: item }) => item.name))
      .toEqual(["_Unidas", "__Coleção"]);
  });

  it("builds a stable synthetic book, deduplicating variants and preferring a covered PDF", () => {
    const epub = book({ id: 1, fileHash: "same", fileType: "epub", thumbnailPath: null });
    const pdf = book({ id: 2, fileHash: "pdf", fileType: "pdf", thumbnailPath: "/cover.jpg" });
    const synthetic = buildSpecialFolderBook(folder("_Clássicos", "_Clássicos"), [epub, epub, pdf], "merged");

    expect(pickRepresentativeBook([epub, pdf])).toBe(pdf);
    expect(synthetic.title).toBe("Clássicos");
    expect(synthetic.fileHash).toBe("merged-folder:/library/_clássicos");
    expect(synthetic.mergedBooks).toEqual([epub, pdf]);
    expect(synthetic.id).toBeLessThan(0);
  });
});
