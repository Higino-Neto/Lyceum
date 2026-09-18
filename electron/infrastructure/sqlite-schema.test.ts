import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CURRENT_SQLITE_SCHEMA_VERSION,
  runDatabaseMigrations,
} from "../database-migrations";
import {
  ensureApplicationSchema,
  ensureBootstrapSchema,
  ensurePostMigrationSchema,
} from "./sqlite-schema";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
});

afterEach(() => {
  db.close();
});

function ensureProductionSchema(): void {
  ensureBootstrapSchema(db);
  runDatabaseMigrations(db, 1);
  ensureApplicationSchema(db);
  runDatabaseMigrations(db, CURRENT_SQLITE_SCHEMA_VERSION);
  ensurePostMigrationSchema(db);
}

function tableNames(): string[] {
  return db.prepare<[], { name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
  ).all().map(({ name }) => name);
}

describe("SQLite schema", () => {
  it("creates the bootstrap, application and post-migration tables idempotently", () => {
    for (let run = 0; run < 2; run++) {
      ensureProductionSchema();
    }

    expect(tableNames()).toEqual(expect.arrayContaining([
      "categories",
      "documents",
      "document_categories",
      "reading_maps",
      "reading_map_sections",
      "reading_map_items",
      "reading_status_items",
      "reading_status_progress_events",
      "atlas_settings",
      "local_books",
      "authors",
      "document_authors",
      "tags",
      "document_tags",
      "processing_jobs",
      "documents_fts",
      "book_word_index",
      "watch_folders",
      "habits",
      "habit_completions",
    ]));
  });

  it("retains defaults and cascading relations", () => {
    ensureProductionSchema();

    db.prepare("INSERT INTO documents (title, fileHash) VALUES (?, ?)").run("Livro", "hash");
    const document = db.prepare<[string], { currentPage: number; processingStatus: string }>(
      "SELECT currentPage, processingStatus FROM documents WHERE fileHash = ?",
    ).get("hash");
    expect(document).toEqual({ currentPage: 1, processingStatus: "pending" });

    db.prepare("INSERT INTO habits (id, name) VALUES (?, ?)").run("daily", "Ler");
    db.prepare("INSERT INTO habit_completions (habitId, dateKey, value) VALUES (?, ?, ?)")
      .run("daily", "2026-09-18", "1");
    db.prepare("DELETE FROM habits WHERE id = ?").run("daily");
    expect(db.prepare("SELECT COUNT(*) AS count FROM habit_completions").get())
      .toEqual({ count: 0 });
  });
});
