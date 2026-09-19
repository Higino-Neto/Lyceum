import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CURRENT_SQLITE_SCHEMA_VERSION, runDatabaseMigrations } from "../database-migrations";
import { ensureApplicationSchema, ensureBootstrapSchema } from "./sqlite-schema";
import { createSqliteCategoryRepository } from "./sqlite-category-repository";

let db: Database.Database;
const libraryPath = "/data/library";

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  ensureBootstrapSchema(db);
  runDatabaseMigrations(db, 1);
  ensureApplicationSchema(db);
  runDatabaseMigrations(db, CURRENT_SQLITE_SCHEMA_VERSION);
});

afterEach(() => {
  db.close();
});

function addDocument(fileHash: string, filePath: string): number {
  const result = db.prepare(
    "INSERT INTO documents (title, fileHash, filePath) VALUES (?, ?, ?)",
  ).run(fileHash, fileHash, filePath);
  return Number(result.lastInsertRowid);
}

describe("SQLite category repository", () => {
  it("manages categories and document assignments without losing counts", () => {
    const repository = createSqliteCategoryRepository(db, libraryPath);
    const documentId = addDocument("book", `${libraryPath}/book.pdf`);
    const first = repository.create(" História ", "#112233");
    const second = repository.create("Ciência", "#445566");
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(repository.setForDocument(documentId, [first!.id, second!.id])).toBe(true);
    expect(repository.listForDocumentHash("book").map(({ name }) => name))
      .toEqual(["Ciência", "História"]);
    expect(repository.find(first!.id)?.bookCount).toBe(1);

    expect(repository.update(first!.id, "História geral", "#123456")).toBe(true);
    expect(repository.removeFromDocument(documentId, second!.id)).toBe(true);
    expect(repository.listForDocument(documentId).map(({ name }) => name)).toEqual(["História geral"]);
    expect(repository.remove(first!.id)).toBe(true);
    expect(repository.find(first!.id)).toBeNull();
    expect(repository.listColors().length).toBeGreaterThan(0);
  });

  it("imports categories from folders only once", () => {
    addDocument("nested", `${libraryPath}/Ensaios/book.epub`);
    const repository = createSqliteCategoryRepository(db, libraryPath);
    expect(repository.importFromFolders()).toBe(1);
    expect(repository.importFromFolders()).toBe(0);
    expect(repository.listForDocumentHash("nested").map(({ name }) => name)).toEqual(["Ensaios"]);
  });
});
