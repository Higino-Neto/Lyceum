import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CURRENT_SQLITE_SCHEMA_VERSION, runDatabaseMigrations } from "../database-migrations";
import { ensureApplicationSchema, ensureBootstrapSchema } from "./sqlite-schema";
import { createSqliteWatchFolderRepository } from "./sqlite-watch-folder-repository";

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

describe("SQLite watch folder repository", () => {
  it("keeps watch and source folders separate and updates a folder in place", () => {
    const repository = createSqliteWatchFolderRepository(db);
    const watch = repository.add("/books/fiction", undefined, "watch");
    expect(watch.label).toBe("fiction");
    const source = repository.add("/imports", "To import", "source");
    expect(repository.list().map(({ path }) => path)).toEqual(["/books/fiction"]);
    expect(repository.list("source").map(({ path }) => path)).toEqual(["/imports"]);
    expect(repository.removeSource(watch.id)).toBeUndefined();

    const updated = repository.add("/books/fiction", "Novels", "source");
    expect(updated.id).toBe(watch.id);
    expect(repository.list()).toEqual([]);
    expect(repository.list("source").map(({ label }) => label)).toEqual(["Novels", "To import"]);
    expect(repository.removeSource(source.id)?.path).toBe("/imports");
    repository.remove(updated.id);
    expect(repository.list("source")).toEqual([]);
  });

  it("finds unsynced books by normalized folder path", () => {
    const repository = createSqliteWatchFolderRepository(db);
    db.prepare(
      "INSERT INTO documents (title, fileHash, folderPath, isSynced) VALUES (?, ?, ?, ?)",
    ).run("Outside", "outside", "/outside/books", 0);
    db.prepare(
      "INSERT INTO documents (title, fileHash, folderPath, isSynced) VALUES (?, ?, ?, ?)",
    ).run("Inside", "inside", "/inside", 1);
    expect(repository.books("/outside/books").map(({ fileHash }) => fileHash)).toEqual(["outside"]);
    expect(repository.unsyncedPaths()).toEqual(["/outside/books"]);
    expect(repository.unsyncedBookCount("/outside/books")).toBe(1);
    expect(repository.unsyncedBookCount("/inside")).toBe(0);
  });
});
