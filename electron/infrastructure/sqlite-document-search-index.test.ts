import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CURRENT_SQLITE_SCHEMA_VERSION, runDatabaseMigrations } from "../database-migrations";
import { ensureApplicationSchema, ensureBootstrapSchema } from "./sqlite-schema";
import { createSqliteDocumentQueryRepository } from "./sqlite-document-query";
import { createSqliteDocumentSearchIndex } from "./sqlite-document-search-index";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  ensureBootstrapSchema(db);
  runDatabaseMigrations(db, 1);
  ensureApplicationSchema(db);
  runDatabaseMigrations(db, CURRENT_SQLITE_SCHEMA_VERSION);
});

afterEach(() => {
  db.close();
});

describe("SQLite document search index", () => {
  it("refreshes changed metadata and removes stale terms", () => {
    const inserted = db.prepare(
      "INSERT INTO documents (title, filePath, fileHash, fileType) VALUES (?, ?, ?, ?)",
    ).run("Álgebra", "/books/algebra.pdf", "hash", "pdf");
    const index = createSqliteDocumentSearchIndex(db);
    const queries = createSqliteDocumentQueryRepository(db, "/books");

    index.refreshById(Number(inserted.lastInsertRowid));
    expect(queries.list({ search: "algebra" }).items.map(({ fileHash }) => fileHash)).toEqual(["hash"]);

    db.prepare("UPDATE documents SET title = ? WHERE fileHash = ?").run("Geometria", "hash");
    index.refreshByHash("hash");
    expect(queries.list({ search: "algebra" }).total).toBe(0);
    expect(queries.list({ search: "geometria" }).total).toBe(1);
  });

  it("rebuilds the index for existing documents and is repeatable", () => {
    db.prepare("INSERT INTO documents (title, filePath, fileHash, fileType) VALUES (?, ?, ?, ?)")
      .run("História", "/books/historia.epub", "history", "epub");
    const index = createSqliteDocumentSearchIndex(db);
    const queries = createSqliteDocumentQueryRepository(db, "/books");

    index.rebuild();
    index.rebuild();
    expect(queries.list({ search: "historia" }).items.map(({ fileHash }) => fileHash))
      .toEqual(["history"]);
  });
});
