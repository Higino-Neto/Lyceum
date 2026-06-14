import { describe, expect, it } from "vitest";
import {
  ensureFolderPath,
  findDuplicateBook,
  folderPath,
  getBookProgress,
  queryMobileBooks,
} from "../mobile/libraryModel";
import { createBookFromFile, emptyMobileState, migrateMobileState } from "../mobile/storage";
import type { MobileBook, MobileLibraryFolder } from "../mobile/types";

function makeFile(name: string, contents = "book") {
  return new File([contents], name, { type: name.endsWith(".pdf") ? "application/pdf" : "text/plain" });
}

function makeBook(patch: Partial<MobileBook> = {}): MobileBook {
  return {
    id: patch.id || "book-1",
    title: patch.title || "Livro",
    fileName: patch.fileName || "livro.pdf",
    fileType: patch.fileType || "pdf",
    importedAt: patch.importedAt || "2026-01-01T00:00:00.000Z",
    currentPage: patch.currentPage || 1,
    totalPages: patch.totalPages || 100,
    category: patch.category || "Geral",
    isFavorite: patch.isFavorite || false,
    ...patch,
  };
}

describe("mobile library state", () => {
  it("starts empty without demo books", () => {
    expect(emptyMobileState().books).toEqual([]);
    expect(emptyMobileState().folders).toEqual([]);
  });

  it("migrates the original MVP shape into the versioned schema", () => {
    const migrated = migrateMobileState({
      books: [makeBook({ category: "Historia" })],
      sessions: [{ id: "legacy-session" }],
      habits: [{ id: "legacy-habit" }],
      selectedBookId: "book-1",
    });

    expect(migrated.schemaVersion).toBe(3);
    expect(migrated.categories).toContain("Historia");
    expect(migrated.selectedBookId).toBe("book-1");
    expect(migrated).not.toHaveProperty("sessions");
    expect(migrated).not.toHaveProperty("habits");
  });

  it("removes fileless showcase books from old MVP installs", () => {
    const migrated = migrateMobileState({ books: [makeBook({ id: "demo_old" })] });
    expect(migrated.books).toEqual([]);
  });

  it("rejects unsupported files before creating a book", () => {
    const file = new File(["<p>book</p>"], "arquivo.html", { type: "text/html" });
    expect(() => createBookFromFile(file, "data:text/html;base64,AA==")).toThrow("Formato nao suportado");
  });
});

describe("mobile managed folders", () => {
  it("creates and reuses a nested hierarchy", () => {
    const first = ensureFolderPath(["Estudos", "Filosofia"], []);
    const second = ensureFolderPath(["Estudos", "Filosofia"], first.folders);

    expect(first.folders).toHaveLength(2);
    expect(second.folders).toHaveLength(2);
    expect(folderPath(second.folderId, second.folders)).toBe("Estudos / Filosofia");
  });

  it("filters books in descendant folders", () => {
    const folders: MobileLibraryFolder[] = [
      { id: "root", name: "Estudos", createdAt: "2026-01-01" },
      { id: "child", name: "Historia", parentId: "root", createdAt: "2026-01-01" },
    ];
    const books = [makeBook({ id: "inside", folderId: "child" }), makeBook({ id: "outside", title: "Outro" })];
    const result = queryMobileBooks(books, folders, [], {
      search: "",
      scope: "all",
      fileType: "all",
      sort: "title_asc",
      folderId: "root",
    });

    expect(result.map((book) => book.id)).toEqual(["inside"]);
  });
});

describe("mobile library queries", () => {
  it("searches metadata and sorts by recent activity", () => {
    const books = [
      makeBook({ id: "old", title: "Historia Antiga", author: "Ana", lastOpenedAt: "2026-01-01" }),
      makeBook({ id: "new", title: "Historia Moderna", notes: "Roma", lastOpenedAt: "2026-05-01" }),
    ];
    const result = queryMobileBooks(books, [], [], {
      search: "historia",
      scope: "all",
      fileType: "all",
      sort: "recent_desc",
    });

    expect(result.map((book) => book.id)).toEqual(["new", "old"]);
  });

  it("uses EPUB progress instead of synthetic page counts", () => {
    expect(getBookProgress(makeBook({ fileType: "epub", progressPercent: 47 }))).toBe(47);
  });

  it("detects same-name and same-size imports", () => {
    const file = makeFile("livro.pdf", "same");
    const duplicate = makeBook({ fileName: file.name, fileSize: file.size });
    expect(findDuplicateBook([duplicate], file)?.id).toBe(duplicate.id);
  });
});
