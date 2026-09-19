import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CURRENT_SQLITE_SCHEMA_VERSION, runDatabaseMigrations } from "../database-migrations";
import { ensureApplicationSchema, ensureBootstrapSchema, ensurePostMigrationSchema } from "./sqlite-schema";
import { createSqliteWordIndexRepository } from "./sqlite-word-index-repository";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  ensureBootstrapSchema(db);
  runDatabaseMigrations(db, 1);
  ensureApplicationSchema(db);
  runDatabaseMigrations(db, CURRENT_SQLITE_SCHEMA_VERSION);
  ensurePostMigrationSchema(db);
});

afterEach(() => {
  db.close();
});

describe("SQLite word index repository", () => {
  it("replaces a book index and calculates word counts and totals", () => {
    const repository = createSqliteWordIndexRepository(db);
    repository.save("book", [{ word: "livro", count: 3 }, { word: "leitura", count: 2 }]);
    expect(repository.has("book")).toBe(true);
    expect(repository.list("book")).toEqual([
      { word: "livro", count: 3 },
      { word: "leitura", count: 2 },
    ]);
    expect(repository.count("book", "LIVRO")).toBe(3);
    expect(repository.stats("book")).toEqual({ totalWords: 5, uniqueWords: 2 });

    repository.save("book", [{ word: "novo", count: 1 }]);
    expect(repository.count("book", "livro")).toBe(0);
    expect(repository.stats("book")).toEqual({ totalWords: 1, uniqueWords: 1 });
    repository.remove("book");
    expect(repository.has("book")).toBe(false);
  });

  it("keeps the previous index if replacement fails", () => {
    const repository = createSqliteWordIndexRepository(db);
    repository.save("book", [{ word: "livro", count: 3 }]);
    expect(() => repository.save("book", [
      { word: "novo", count: 1 },
      { word: "novo", count: 2 },
    ])).toThrow();
    expect(repository.list("book")).toEqual([{ word: "livro", count: 3 }]);
  });
});
