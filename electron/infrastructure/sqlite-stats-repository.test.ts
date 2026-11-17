import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CURRENT_SQLITE_SCHEMA_VERSION, runDatabaseMigrations } from "../database-migrations";
import { ensureApplicationSchema, ensureBootstrapSchema, ensurePostMigrationSchema } from "./sqlite-schema";
import { createSqliteStatsRepository } from "./sqlite-stats-repository";

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

function addDocument(values: Record<string, unknown>) {
  const row = { title: "Book", numPages: 100, currentPage: 1, fileHash: `h${Math.random()}`, fileType: "pdf", ...values };
  const keys = Object.keys(row);
  db.prepare(`INSERT INTO documents (${keys.join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`).run(...Object.values(row));
}

function addWord(language: string, key: string, state: string, updatedAt: string, lookupCount = 0) {
  db.prepare("INSERT INTO ll_knowledge (userId, language, key, state, label, lookupCount, updatedAt) VALUES ('u', ?, ?, ?, ?, ?, ?)")
    .run(language, key, state, key, lookupCount, updatedAt);
}

describe("SQLite stats repository", () => {
  it("summarises the library without counting files marked as not a book", () => {
    addDocument({ title: "Read", readingStatus: "read", completedAt: "2026-03-10 10:00:00", numPages: 200, author: "Ann", subject: "History; Rome, history", rating: 5 });
    addDocument({ title: "Reading", readingStatus: "reading", currentPage: 40, author: "ann", fileType: "epub", lastOpenedAt: "2026-01-01 10:00:00" });
    addDocument({ title: "Queue", readingStatus: "want_to_read" });
    addDocument({ title: "Scan", readingStatus: "not_a_book", numPages: 999 });

    const summary = createSqliteStatsRepository(db).librarySummary(new Date(2026, 10, 16));

    expect(summary.totals.books).toBe(3);
    expect(summary.totals.pages).toBe(400);
    expect(summary.totals.pagesRead).toBe(240);
    expect(summary.totals.backlogPages).toBe(60 + 99);
    expect(summary.status).toMatchObject({ read: 1, reading: 1, wantToRead: 1, started: 2 });
    expect(summary.finishedThisYear).toBe(1);
    expect(summary.authors[0]).toMatchObject({ count: 2 });
    expect(summary.subjects.find((subject) => subject.name.toLowerCase() === "history")?.count).toBe(1);
    expect(summary.formats).toEqual(expect.arrayContaining([{ format: "pdf", count: 2 }, { format: "epub", count: 1 }]));
    expect(summary.forgotten.map((book) => book.title)).toEqual(["Reading"]);
    expect(summary.continueReading.map((book) => book.title)).toEqual(["Reading"]);
  });

  it("snapshots vocabulary totals without changing the vocabulary itself", () => {
    addWord("fr", "chat", "known", "2026-11-10T10:00:00.000Z");
    addWord("fr", "chien", "learning", "2026-11-12T10:00:00.000Z");
    const before = db.prepare("SELECT * FROM ll_knowledge ORDER BY key").all();
    const repository = createSqliteStatsRepository(db);

    repository.snapshotKnowledge("u", new Date(2026, 10, 16, 12));
    repository.snapshotKnowledge("u", new Date(2026, 10, 16, 18));

    expect(db.prepare("SELECT * FROM ll_knowledge ORDER BY key").all()).toEqual(before);
    expect(db.prepare("SELECT date, known, learning FROM ll_knowledge_daily").all()).toEqual([{ date: "2026-11-16", known: 1, learning: 1 }]);
  });

  it("builds a back-filled vocabulary history, coverage and stubborn words", () => {
    addWord("fr", "chat", "known", "2026-11-10T10:00:00.000Z");
    addWord("fr", "chien", "learning", "2026-11-12T10:00:00.000Z", 5);
    addWord("fr", "le", "ignored", "2026-11-12T10:00:00.000Z");

    const summary = createSqliteStatsRepository(db).languageSummary("u", [{
      documentId: "doc",
      fileHash: null,
      title: "Livre",
      language: "fr",
      tokens: 10,
      lexicon: [{ key: "chat", count: 3 }, { key: "chien", count: 1 }, { key: "le", count: 4 }, { key: "maison", count: 4 }],
    }], new Date(2026, 10, 13, 12));

    expect(summary.languages[0]).toMatchObject({ language: "fr", known: 1, learning: 1, ignored: 1 });
    expect(summary.history.map((point) => [point.date, point.known, point.learning])).toEqual([
      ["2026-11-10", 1, 0],
      ["2026-11-11", 1, 0],
      ["2026-11-12", 1, 1],
      ["2026-11-13", 1, 1],
    ]);
    expect(summary.coverage[0]?.known).toBeCloseTo(3 / 8);
    expect(summary.stubborn.map((word) => word.key)).toEqual(["chien"]);
  });
});
