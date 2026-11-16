import { describe, expect, it } from "vitest";
import type { BookWithThumbnail } from "../../../types/LibraryTypes";
import {
  buildDisplayBooks,
  getPathLeaf,
  isAbsoluteFolderPath,
  matchesLibraryFileTypes,
  matchesLibraryReadingStatus,
  matchesLibrarySearch,
  normalizeAbsoluteFolderPath,
  pickRepresentativeBook,
  sortBooksForLibraryView,
} from "./libraryView";
import { getGroupRating, getGroupReadingStatus } from "../../../lib/readingStatus";

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

  it("matches a reading status set against the merged book's group status", () => {
    const merged = book({
      bookId: "merged-book",
      mergedBooks: [book({ fileHash: "epub", readingStatus: "read" })],
    });
    const inProgress = book({ fileHash: "progress", readingStatus: null, currentPage: 50, numPages: 100 });
    const untouched = book({ fileHash: "new", readingStatus: null, currentPage: 0 });

    expect(matchesLibraryReadingStatus(merged, ["read"])).toBe(true);
    expect(matchesLibraryReadingStatus(merged, ["reading"])).toBe(false);
    expect(matchesLibraryReadingStatus(merged, ["reading", "read"])).toBe(true);
    expect(matchesLibraryReadingStatus(inProgress, ["reading"])).toBe(true);
    expect(matchesLibraryReadingStatus(untouched, ["want_to_read"])).toBe(false);
    expect(matchesLibraryReadingStatus(untouched, ["unknown"])).toBe(true);
    expect(matchesLibraryReadingStatus(untouched, null)).toBe(true);
    expect(matchesLibraryReadingStatus(untouched, [])).toBe(false);
  });

  it("resolves one status and score for a merged book with divergent variants", () => {
    const merged = book({
      bookId: "merged-book",
      mergedBooks: [
        book({ fileHash: "epub", readingStatus: "reading", rating: 6 }),
        book({ fileHash: "pdf", readingStatus: "read", rating: 9 }),
      ],
    });

    expect(getGroupReadingStatus(merged)).toBe("read");
    expect(getGroupRating(merged)).toBe(9);
    // The status filter follows the same single status the grid shows.
    expect(matchesLibraryReadingStatus(merged, ["read"])).toBe(true);
    expect(matchesLibraryReadingStatus(merged, ["reading"])).toBe(false);
  });

  it("infers a merged book status from its most advanced variant", () => {
    const merged = book({
      bookId: "merged-book",
      mergedBooks: [
        book({ fileHash: "epub", readingStatus: null, currentPage: 0 }),
        book({ fileHash: "pdf", readingStatus: null, currentPage: 40, numPages: 100 }),
      ],
    });

    expect(getGroupReadingStatus(merged)).toBe("reading");
  });

  it("prefers a covered EPUB or PDF as the representative format", () => {
    const epub = book({ id: 1, fileHash: "epub", fileType: "epub", thumbnailPath: null });
    const pdf = book({ id: 2, fileHash: "pdf", fileType: "pdf", thumbnailPath: "/cover.jpg" });

    expect(pickRepresentativeBook([epub, pdf])).toBe(pdf);
  });

  it("groups formats by bookId, keeps folders named with _ as ordinary books, and reuses unchanged projections", () => {
    const pdf = book({ id: 1, fileHash: "pdf", bookId: "merged", title: "A", folderPath: "/library" });
    const epub = book({ id: 2, fileHash: "epub", bookId: "merged", title: "A", fileType: "epub", folderPath: "/library" });
    const legacy = book({ id: 3, title: "B", fileHash: "legacy", folderPath: "/library/_Old merge" });
    const input = {
      section: "synced" as const,
      books: [pdf, epub, legacy],
      search: "",
      fileTypes: ["all" as const],
      sort: "title_asc" as const,
      previousCache: new Map(),
    };
    const first = buildDisplayBooks(input);
    expect(first.books.map(({ fileHash }) => fileHash)).toEqual(["pdf", "legacy"]);
    expect(first.books[0].mergedBooks).toEqual([pdf, epub]);
    expect(first.books[1].mergedBooks).toBeUndefined();
    const second = buildDisplayBooks({ ...input, previousCache: first.cache });
    expect(second.books[0]).toBe(first.books[0]);
  });

  it("leaves USB books untouched", () => {
    const original = [book()];
    const input = {
      section: "usb" as const,
      books: original,
      search: "",
      fileTypes: ["all" as const],
      sort: "title_asc" as const,
      previousCache: new Map(),
    };
    expect(buildDisplayBooks(input).books).toBe(original);
    expect(buildDisplayBooks({ ...input, section: "unsynced" }).books).toEqual(original);
  });

  it("matches merged books against the status filter by their shared group status", () => {
    const merged = book({
      bookId: "g",
      mergedBooks: [
        book({ fileHash: "epub", fileType: "epub", readingStatus: "reading" }),
        book({ fileHash: "pdf", readingStatus: "reading" }),
      ],
    });

    expect(matchesLibraryReadingStatus(merged, ["reading"])).toBe(true);
    expect(matchesLibraryReadingStatus(merged, ["read"])).toBe(false);
    expect(matchesLibraryReadingStatus(merged, null)).toBe(true);
  });
});
