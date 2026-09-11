import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import {
  CURRENT_SQLITE_SCHEMA_VERSION,
  getSqliteSchemaVersion,
  getTableColumns,
  runDatabaseMigrations,
} from "./database-migrations";

const databases: Database.Database[] = [];

function createDatabase() {
  const database = new Database(":memory:");
  databases.push(database);
  return database;
}

function createLegacyCore(database: Database.Database) {
  database.exec(`
    CREATE TABLE documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      filePath TEXT,
      fileHash TEXT UNIQUE,
      currentPage INTEGER DEFAULT 1,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );
  `);
}

function createAncillaryTables(database: Database.Database, current: boolean) {
  database.exec(`
    CREATE TABLE reading_status_items (
      id TEXT PRIMARY KEY,
      bookId TEXT,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'want_to_read',
      orderIndex INTEGER NOT NULL DEFAULT 0
      ${current ? ", description TEXT, isbn TEXT, publisher TEXT, publishDate TEXT, subject TEXT, isPrimary INTEGER NOT NULL DEFAULT 0, manualBasePage INTEGER NOT NULL DEFAULT 0, notePath TEXT, notesMarkdown TEXT, rating INTEGER NOT NULL DEFAULT 0" : ""}
    );
    CREATE TABLE watch_folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL UNIQUE
      ${current ? ", type TEXT NOT NULL DEFAULT 'watch'" : ""}
    );
  `);
}

function migrateLikeApplication(database: Database.Database, currentAncillary = false) {
  runDatabaseMigrations(database, 1);
  createAncillaryTables(database, currentAncillary);
  return runDatabaseMigrations(database);
}

afterEach(() => {
  while (databases.length) databases.pop()?.close();
});

describe("SQLite migrations", () => {
  it("brings a new database to the current schema", () => {
    const database = createDatabase();
    createLegacyCore(database);

    expect(migrateLikeApplication(database, true)).toBe(CURRENT_SQLITE_SCHEMA_VERSION);
    expect(getTableColumns(database, "documents")).toContain("category");
    expect(getTableColumns(database, "documents")).toContain("fileType");
    expect(getTableColumns(database, "reading_status_items")).toContain("rating");
    expect(getTableColumns(database, "watch_folders")).toContain("type");
    expect(getTableColumns(database, "key_concepts")).toContain("bookId");
    expect(getTableColumns(database, "key_concepts")).toContain("highlightJson");
    expect(getTableColumns(database, "concept_relations")).toContain("conceptBId");
  });

  it("upgrades a legacy database to exactly the same columns as a new database", () => {
    const fresh = createDatabase();
    createLegacyCore(fresh);
    migrateLikeApplication(fresh, true);

    const legacy = createDatabase();
    createLegacyCore(legacy);
    migrateLikeApplication(legacy, false);

    for (const table of ["documents", "categories", "reading_status_items", "watch_folders", "key_concepts", "concept_relations"]) {
      expect(getTableColumns(legacy, table)).toEqual(getTableColumns(fresh, table));
    }
  });

  it("is idempotent when migrations run twice", () => {
    const database = createDatabase();
    createLegacyCore(database);
    migrateLikeApplication(database);

    expect(() => runDatabaseMigrations(database)).not.toThrow();
    expect(() => runDatabaseMigrations(database, 1)).not.toThrow();
    expect(getSqliteSchemaVersion(database)).toBe(CURRENT_SQLITE_SCHEMA_VERSION);
  });

  it("preserves existing rows while adding category", () => {
    const database = createDatabase();
    createLegacyCore(database);
    database.prepare("INSERT INTO documents (title, filePath, fileHash) VALUES (?, ?, ?)")
      .run("Livro legado", "/books/legacy.epub", "legacy-hash");

    migrateLikeApplication(database);

    expect(database.prepare("SELECT title, filePath, fileHash, category FROM documents").get()).toEqual({
      title: "Livro legado",
      filePath: "/books/legacy.epub",
      fileHash: "legacy-hash",
      category: null,
    });
  });
});
