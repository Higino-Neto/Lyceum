import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CURRENT_SQLITE_SCHEMA_VERSION, runDatabaseMigrations } from "../database-migrations";
import { ensureApplicationSchema, ensureBootstrapSchema, ensurePostMigrationSchema } from "./sqlite-schema";
import { createSqliteLanguageLearningRepository } from "./sqlite-language-learning-repository";
import { createReviewItem, scheduleReview, GRADE } from "../../src/core/language-learning/srs";
import { effectiveState } from "../../src/core/language-learning/knowledge";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createLearningBackupService, isLearningBackup } from "../services/language-learning-backup";

function openFileDatabase(file: string) {
  const fileDb = new Database(file);
  fileDb.pragma("journal_mode = WAL");
  ensureBootstrapSchema(fileDb);
  runDatabaseMigrations(fileDb, 1);
  ensureApplicationSchema(fileDb);
  runDatabaseMigrations(fileDb, CURRENT_SQLITE_SCHEMA_VERSION);
  ensurePostMigrationSchema(fileDb);
  return fileDb;
}

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  ensureBootstrapSchema(db);
  runDatabaseMigrations(db, 1);
  ensureApplicationSchema(db);
  runDatabaseMigrations(db, CURRENT_SQLITE_SCHEMA_VERSION);
  ensurePostMigrationSchema(db);
});

afterEach(() => {
  db.close();
});

describe("SQLite language-learning repository", () => {
  it("keeps vocabulary knowledge independent per user", () => {
    const repo = createSqliteLanguageLearningRepository(db);
    repo.setLemmaState("alice", { language: "de", key: "gehen", state: "known", label: "gehen" });
    repo.setLemmaState("bob", { language: "de", key: "gehen", state: "learning", label: "gehen" });

    expect(effectiveState(repo.loadKnowledge("alice", "de"), "gehen")).toBe("known");
    expect(effectiveState(repo.loadKnowledge("bob", "de"), "gehen")).toBe("learning");
    expect(effectiveState(repo.loadKnowledge("carol", "de"), "gehen")).toBe("unknown");
    expect(repo.loadKnowledge("alice", "en").lemmas).toEqual({});
  });

  it("stores form overrides separately from lemma knowledge", () => {
    const repo = createSqliteLanguageLearningRepository(db);
    repo.setLemmaState("u", { language: "de", key: "gehen", state: "known", label: "gehen" });
    repo.setFormState("u", { language: "de", key: "gehen", form: "ging", state: "learning" });
    let snapshot = repo.loadKnowledge("u", "de");
    expect(effectiveState(snapshot, "gehen", "geht")).toBe("known");
    expect(effectiveState(snapshot, "gehen", "ging")).toBe("learning");
    repo.clearFormState("u", "de", "gehen", "ging");
    snapshot = repo.loadKnowledge("u", "de");
    expect(effectiveState(snapshot, "gehen", "ging")).toBe("known");
  });

  it("tracks lookups and keeps translations across state changes", () => {
    const repo = createSqliteLanguageLearningRepository(db);
    repo.recordLookup("u", "de", "Haus", "Haus");
    repo.recordLookup("u", "de", "Haus", "Haus");
    repo.setTranslation("u", "de", "Haus", "Haus", "house");
    const record = repo.setLemmaState("u", { language: "de", key: "Haus", state: "ignored", label: "Haus" });
    expect(record.lookupCount).toBe(2);
    expect(record.translation).toBe("house");
    expect(record.state).toBe("ignored");
  });

  it("persists review items and history", () => {
    const repo = createSqliteLanguageLearningRepository(db);
    const now = new Date("2026-01-01T00:00:00Z");
    const item = createReviewItem({ language: "de", key: "gehen", itemType: "lexeme", label: "gehen", translation: "to go" }, now);
    repo.upsertReviewItem("u", item);
    const { item: next, intervalBefore, correct } = scheduleReview(item, GRADE.good, now);
    repo.upsertReviewItem("u", next);
    repo.logReview("u", { itemId: item.id, reviewedAt: now.toISOString(), grade: GRADE.good, exercise: "recall", correct, intervalBefore, intervalAfter: next.intervalDays });

    const [stored] = repo.listReviewItems("u", "de");
    expect(stored).toMatchObject({ id: item.id, repetitions: 1, intervalDays: 1, translation: "to go" });
    expect(stored).not.toHaveProperty("userId");
    expect(repo.listReviewLog("u", item.id)).toEqual([expect.objectContaining({ exercise: "recall", correct: true })]);
    expect(repo.listReviewItems("other")).toEqual([]);
    repo.deleteReviewItem("u", item.id);
    expect(repo.listReviewItems("u")).toEqual([]);
    expect(repo.listReviewLog("u")).toEqual([]);
  });

  it("stores annotations by stable element id and reading state per document", () => {
    const repo = createSqliteLanguageLearningRepository(db);
    repo.saveAnnotation("u", {
      id: "a1", documentId: "doc", targetType: "sentence", targetId: "ch1.b2.s0", chapterId: "ch1",
      quote: "Er ging.", note: "past tense", category: "grammar", createdAt: "t", updatedAt: "t",
    });
    expect(repo.listAnnotations("u", "doc")[0]).toMatchObject({ targetId: "ch1.b2.s0", category: "grammar" });
    expect(repo.listAnnotations("u", "other")).toEqual([]);

    repo.saveReadingState("u", {
      documentId: "doc", chapterId: "ch2", blockId: "ch2.b4", progress: 0.4,
      completedChapters: ["ch1"], secondsRead: 120, sessions: 2, updatedAt: "t",
    });
    expect(repo.getReadingState("u", "doc")).toMatchObject({ chapterId: "ch2", completedChapters: ["ch1"], sessions: 2 });
    expect(repo.getReadingState("v", "doc")).toBeNull();
  });

  it("keeps vocabulary after the database is closed and reopened (another book, same language)", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ll-db-"));
    try {
      const file = path.join(directory, "app.db");
      const first = openFileDatabase(file);
      createSqliteLanguageLearningRepository(first).setLemmaState("u", { language: "fr", key: "maison", state: "learning", label: "maison" });
      first.close();
      const second = openFileDatabase(file);
      expect(effectiveState(createSqliteLanguageLearningRepository(second).loadKnowledge("u", "fr"), "maison")).toBe("learning");
      second.close();
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it("sets many states in one transaction", () => {
    const repo = createSqliteLanguageLearningRepository(db);
    repo.setLemmaState("u", { language: "fr", key: "chat", state: "learning", label: "chat", translation: "gato" });
    expect(repo.setLemmaStates("u", [
      { language: "fr", key: "chat", state: "known", label: "chat" },
      { language: "fr", key: "chien", state: "known", label: "chien" },
    ])).toBe(2);
    const snapshot = repo.loadKnowledge("u", "fr");
    expect(snapshot.lemmas.chat).toMatchObject({ state: "known", translation: "gato" });
    expect(snapshot.lemmas.chien?.state).toBe("known");
  });

  it("finds and merges vocabulary filed under a wrong language or the signed-out profile", () => {
    const repo = createSqliteLanguageLearningRepository(db, () => "2026-02-01T00:00:00.000Z");
    repo.setLemmaState("u", { language: "pt", key: "jour", state: "known", label: "jour" });
    repo.setLemmaState("u", { language: "pt", key: "écran", state: "learning", label: "écran" });
    repo.recordLookup("u", "pt", "tactique", "tactique");
    repo.upsertReviewItem("u", createReviewItem({ language: "pt", key: "écran", itemType: "lexeme", label: "écran", translation: null, context: null, contextForm: null, documentId: null, sentenceId: null }));
    repo.setLemmaState("u", { language: "fr", key: "jour", state: "learning", label: "jour" });
    repo.setLemmaState("local", { language: "fr", key: "nuit", state: "known", label: "nuit" });

    const buckets = repo.listKnowledgeBuckets(["u", "local"]);
    expect(buckets.find((bucket) => bucket.userId === "u" && bucket.language === "pt")).toMatchObject({ count: 2 });
    expect(buckets.find((bucket) => bucket.userId === "local")?.keys).toEqual(["nuit"]);

    expect(repo.mergeKnowledge("u", { userId: "u", language: "pt" }, "fr")).toEqual({ moved: 2, merged: 1, reviewItems: 1 });
    expect(repo.mergeKnowledge("u", { userId: "local", language: "fr" }, "fr")).toMatchObject({ moved: 1 });
    const french = repo.loadKnowledge("u", "fr");
    expect(Object.keys(french.lemmas).sort()).toEqual(["jour", "nuit", "tactique", "écran"].sort());
    expect(repo.loadKnowledge("u", "pt").lemmas).toEqual({});
    expect(repo.listReviewItems("u", "fr").map((item) => item.id)).toEqual(["fr:écran"]);
    expect(repo.loadKnowledge("local", "fr").lemmas).toEqual({});
  });

  it("exports and re-imports everything; the newest version of a record wins", () => {
    let clock = "2026-01-01T00:00:00.000Z";
    const repo = createSqliteLanguageLearningRepository(db, () => clock);
    repo.setLemmaState("u", { language: "de", key: "Haus", state: "learning", label: "Haus", translation: "casa" });
    repo.upsertReviewItem("u", createReviewItem({ language: "de", key: "Haus", itemType: "lexeme", label: "Haus", translation: "casa", context: null, contextForm: null, documentId: "d", sentenceId: null }));
    const backup = repo.exportUserData("u");
    expect(isLearningBackup(JSON.parse(JSON.stringify(backup)))).toBe(true);

    clock = "2026-03-01T00:00:00.000Z";
    repo.setLemmaState("u", { language: "de", key: "Haus", state: "known", label: "Haus" });
    db.prepare("DELETE FROM ll_review_items").run();
    const result = repo.importUserData("u", backup);
    expect(result.reviewItems).toBe(1);
    // The newer local state is kept; the deleted review item is restored.
    expect(repo.loadKnowledge("u", "de").lemmas.Haus?.state).toBe("known");
    expect(repo.listReviewItems("u")).toHaveLength(1);

    const fresh = createSqliteLanguageLearningRepository(db);
    expect(fresh.importUserData("v", backup).knowledge).toBe(1);
    expect(fresh.loadKnowledge("v", "de").lemmas.Haus).toMatchObject({ state: "learning", translation: "casa" });
  });
});

describe("learning backups", () => {
  it("writes latest + daily copies and never overwrites a backup with an empty export", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ll-backup-"));
    try {
      const repo = createSqliteLanguageLearningRepository(db);
      const service = createLearningBackupService({ repository: repo, directory, today: () => "2026-11-15" });
      expect(service.writeBackup("u")).toBeNull();
      repo.setLemmaState("u", { language: "fr", key: "chat", state: "known", label: "chat" });
      const latest = service.writeBackup("u")!;
      expect(JSON.parse(fs.readFileSync(latest, "utf8")).knowledge).toHaveLength(1);
      expect(fs.existsSync(path.join(service.directoryFor("u"), "2026-11-15.json"))).toBe(true);

      db.prepare("DELETE FROM ll_knowledge").run();
      expect(service.writeBackup("u")).toBeNull();
      expect(JSON.parse(fs.readFileSync(latest, "utf8")).knowledge).toHaveLength(1);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});
