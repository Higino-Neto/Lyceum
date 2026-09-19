import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CURRENT_SQLITE_SCHEMA_VERSION, runDatabaseMigrations } from "../database-migrations";
import { ensureApplicationSchema, ensureBootstrapSchema, ensurePostMigrationSchema } from "./sqlite-schema";
import { createSqliteDocumentMetadataRepository } from "./sqlite-document-metadata-repository";
import { createSqliteDocumentSearchIndex } from "./sqlite-document-search-index";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  ensureBootstrapSchema(db);
  runDatabaseMigrations(db, 1);
  ensureApplicationSchema(db);
  runDatabaseMigrations(db, CURRENT_SQLITE_SCHEMA_VERSION);
  ensurePostMigrationSchema(db);
  db.prepare("INSERT INTO documents (title, fileHash, filePath) VALUES (?, ?, ?)")
    .run("Original", "book", "/library/book.pdf");
});

afterEach(() => {
  db.close();
});

describe("SQLite document metadata repository", () => {
  it("updates only provided fields and refreshes the full-text index", () => {
    const index = createSqliteDocumentSearchIndex(db);
    index.rebuild();
    const repository = createSqliteDocumentMetadataRepository(db, index);

    const patch = { title: "Novo título", author: "Autor", notes: "ignored" };
    repository.updateMetadata("book", patch);
    const document = db.prepare<[string], { title: string; author: string; notes: string | null }>(
      "SELECT title, author, notes FROM documents WHERE fileHash = ?",
    ).get("book");
    expect(document).toEqual({ title: "Novo título", author: "Autor", notes: null });
    expect(db.prepare<[], { title: string }>("SELECT title FROM documents_fts").all())
      .toEqual([{ title: "Novo título" }]);

    repository.updateTitle("book", "Título final");
    repository.updateAuthor("book", null);
    expect(db.prepare<[], { title: string; author: string | null }>(
      "SELECT title, author FROM documents_fts",
    ).get()).toEqual({ title: "Título final", author: "" });
  });

  it("keeps empty patches inert and handles favorite, rating and notes", () => {
    const refreshByHash = vi.fn();
    const repository = createSqliteDocumentMetadataRepository(db, { refreshByHash });
    repository.updateMetadata("book", {});
    expect(refreshByHash).not.toHaveBeenCalled();
    expect(repository.toggleFavorite("missing")).toBe(false);
    expect(repository.toggleFavorite("book")).toBe(true);
    expect(repository.getFavorites().map(({ fileHash }) => fileHash)).toEqual(["book"]);
    repository.updateRating("book", 4);
    repository.updateNotes("book", "Anotações");
    expect(db.prepare<[], { rating: number; notes: string }>(
      "SELECT rating, notes FROM documents WHERE fileHash = 'book'",
    ).get()).toEqual({ rating: 4, notes: "Anotações" });
    expect(repository.toggleFavorite("book")).toBe(false);
    expect(repository.getFavorites()).toEqual([]);
  });
});
