import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ReadingStatus } from "../../src/types/LibraryTypes";
import { CURRENT_SQLITE_SCHEMA_VERSION, runDatabaseMigrations } from "../database-migrations";
import { ensureApplicationSchema, ensureBootstrapSchema } from "./sqlite-schema";
import { createSqliteReaderProgressRepository } from "./sqlite-reader-progress-repository";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  ensureBootstrapSchema(db);
  runDatabaseMigrations(db, 1);
  ensureApplicationSchema(db);
  runDatabaseMigrations(db, CURRENT_SQLITE_SCHEMA_VERSION);
  db.prepare("INSERT INTO documents (title, fileHash, numPages) VALUES (?, ?, ?)")
    .run("Book", "book", 10);
});

afterEach(() => {
  db.close();
});

function current() {
  return db.prepare<[], {
    currentPage: number;
    currentZoom: number;
    currentScroll: number;
    annotations: string;
    readingStatus: ReadingStatus | null;
    completedAt: string | null;
  }>("SELECT currentPage, currentZoom, currentScroll, annotations, readingStatus, completedAt FROM documents")
    .get()!;
}

describe("SQLite reader progress repository", () => {
  it("infers reading and completion only when no explicit status exists", () => {
    const repository = createSqliteReaderProgressRepository(db);
    repository.savePosition("book", { currentPage: 2, currentZoom: 1.5, currentScroll: 25, annotations: "[]" });
    expect(current()).toMatchObject({
      currentPage: 2,
      currentZoom: 1.5,
      currentScroll: 25,
      annotations: "[]",
      readingStatus: "reading",
      completedAt: null,
    });
    repository.updateStatus("book", "paused");
    repository.savePosition("book", { currentPage: 10, currentZoom: 2, currentScroll: 100, annotations: "[1]" });
    expect(current()).toMatchObject({ readingStatus: "paused", completedAt: null });
    repository.updateStatus("book", "read");
    expect(current().completedAt).not.toBeNull();
    repository.updateStatus("book", "reading");
    expect(current().completedAt).toBeNull();

    db.prepare("INSERT INTO documents (title, fileHash, numPages) VALUES (?, ?, ?)")
      .run("Second", "second", 5);
    repository.savePosition("second", {
      currentPage: 5,
      currentZoom: 1,
      currentScroll: 0,
      annotations: "[]",
    });
    expect(db.prepare<[], { readingStatus: string; completedAt: string | null }>(
      "SELECT readingStatus, completedAt FROM documents WHERE fileHash = 'second'",
    ).get()).toMatchObject({ readingStatus: "read", completedAt: expect.any(String) });
  });

  it("marks last opening and rejects invalid explicit statuses", () => {
    const repository = createSqliteReaderProgressRepository(db);
    db.prepare("UPDATE documents SET lastOpenedAt = '2000-01-01'").run();
    repository.markOpened("book");
    expect(db.prepare<[], { lastOpenedAt: string }>("SELECT lastOpenedAt FROM documents").get()?.lastOpenedAt)
      .not.toBe("2000-01-01");
    expect(repository.updateStatus("missing", "read")).toBe(false);
    expect(() => repository.updateStatus("book", "invalid" as ReadingStatus)).toThrow("Invalid reading status");
  });
});
