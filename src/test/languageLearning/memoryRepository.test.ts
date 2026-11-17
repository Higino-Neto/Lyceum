import { describe, expect, it } from "vitest";
import {
  createMemoryLanguageLearningRepository,
  type LearningRowChange,
  type LearningRows,
} from "../../core/language-learning/memoryRepository";
import { createReviewItem, GRADE, scheduleReview } from "../../core/language-learning/srs";
import { effectiveState } from "../../core/language-learning/knowledge";
import { LEARNING_BACKUP_SCHEMA } from "../../core/language-learning/model";

/** Same cases as electron/infrastructure/sqlite-language-learning-repository.test.ts. */
describe("memory language-learning repository (SQLite contract)", () => {
  it("keeps vocabulary knowledge independent per user", () => {
    const repo = createMemoryLanguageLearningRepository();
    repo.setLemmaState("alice", { language: "de", key: "gehen", state: "known", label: "gehen" });
    repo.setLemmaState("bob", { language: "de", key: "gehen", state: "learning", label: "gehen" });
    expect(effectiveState(repo.loadKnowledge("alice", "de"), "gehen")).toBe("known");
    expect(effectiveState(repo.loadKnowledge("bob", "de"), "gehen")).toBe("learning");
    expect(effectiveState(repo.loadKnowledge("carol", "de"), "gehen")).toBe("unknown");
    expect(repo.loadKnowledge("alice", "en").lemmas).toEqual({});
  });

  it("stores form overrides separately from lemma knowledge", () => {
    const repo = createMemoryLanguageLearningRepository();
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
    const repo = createMemoryLanguageLearningRepository();
    repo.recordLookup("u", "de", "Haus", "Haus");
    repo.recordLookup("u", "de", "Haus", "Haus");
    repo.setTranslation("u", "de", "Haus", "Haus", "house");
    const record = repo.setLemmaState("u", { language: "de", key: "Haus", state: "ignored", label: "Haus" });
    expect(record.lookupCount).toBe(2);
    expect(record.translation).toBe("house");
    expect(record.state).toBe("ignored");
  });

  it("persists review items and history", () => {
    const repo = createMemoryLanguageLearningRepository();
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
    const repo = createMemoryLanguageLearningRepository();
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

  it("sets many states in one transaction", () => {
    const changes: LearningRowChange[][] = [];
    const repo = createMemoryLanguageLearningRepository({ onChange: (batch) => changes.push(batch) });
    repo.setLemmaState("u", { language: "fr", key: "chat", state: "learning", label: "chat", translation: "gato" });
    expect(repo.setLemmaStates("u", [
      { language: "fr", key: "chat", state: "known", label: "chat" },
      { language: "fr", key: "chien", state: "known", label: "chien" },
    ])).toBe(2);
    const snapshot = repo.loadKnowledge("u", "fr");
    expect(snapshot.lemmas.chat).toMatchObject({ state: "known", translation: "gato" });
    expect(snapshot.lemmas.chien?.state).toBe("known");
    expect(changes.map((batch) => batch.length)).toEqual([1, 2]);
  });

  it("finds and merges vocabulary filed under a wrong language or the signed-out profile", () => {
    const repo = createMemoryLanguageLearningRepository({ now: () => "2026-02-01T00:00:00.000Z" });
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
    const repo = createMemoryLanguageLearningRepository({ now: () => clock });
    repo.setLemmaState("u", { language: "de", key: "Haus", state: "learning", label: "Haus", translation: "casa" });
    const item = createReviewItem({ language: "de", key: "Haus", itemType: "lexeme", label: "Haus", translation: "casa", context: null, contextForm: null, documentId: "d", sentenceId: null });
    repo.upsertReviewItem("u", item);
    const backup = repo.exportUserData("u");
    expect(backup.schema).toBe(LEARNING_BACKUP_SCHEMA);

    clock = "2026-03-01T00:00:00.000Z";
    repo.setLemmaState("u", { language: "de", key: "Haus", state: "known", label: "Haus" });
    repo.deleteReviewItem("u", item.id);
    const result = repo.importUserData("u", JSON.parse(JSON.stringify(backup)));
    expect(result.reviewItems).toBe(1);
    expect(repo.loadKnowledge("u", "de").lemmas.Haus?.state).toBe("known");
    expect(repo.listReviewItems("u")).toHaveLength(1);

    const fresh = createMemoryLanguageLearningRepository();
    expect(fresh.importUserData("v", backup).knowledge).toBe(1);
    expect(fresh.loadKnowledge("v", "de").lemmas.Haus).toMatchObject({ state: "learning", translation: "casa" });
  });
});

describe("memory repository persistence journal", () => {
  /** Applies change batches the way the IndexedDB store does. */
  function replay(batches: LearningRowChange[][]): Partial<LearningRows> {
    const stores = new Map<string, Map<string, unknown>>();
    for (const batch of batches) {
      for (const change of batch) {
        const store = stores.get(change.store) ?? new Map<string, unknown>();
        stores.set(change.store, store);
        if (change.value === null) store.delete(change.id);
        else store.set(change.id, change.value);
      }
    }
    const rows = (name: string) => [...(stores.get(name)?.values() ?? [])] as never[];
    return {
      knowledge: rows("knowledge"), forms: rows("forms"), reviewItems: rows("reviewItems"),
      reviewLog: rows("reviewLog"), annotations: rows("annotations"), readingStates: rows("readingStates"),
    };
  }

  it("rebuilds the exact same vocabulary after a restart from the change journal", () => {
    const batches: LearningRowChange[][] = [];
    const first = createMemoryLanguageLearningRepository({ onChange: (batch) => batches.push(structuredClone(batch)) });
    first.setLemmaState("u", { language: "fr", key: "maison", state: "learning", label: "maison" });
    first.setTranslation("u", "fr", "maison", "maison", "casa");
    first.setLemmaStates("u", [{ language: "fr", key: "chat", state: "known", label: "chat" }]);
    first.setFormState("u", { language: "fr", key: "aller", form: "va", state: "known" });
    first.setLemmaState("u", { language: "pt", key: "nuit", state: "known", label: "nuit" });
    first.mergeKnowledge("u", { userId: "u", language: "pt" }, "fr");
    first.saveReadingState("u", { documentId: "d", chapterId: "c1", blockId: null, progress: 0.2, completedChapters: [], secondsRead: 0, sessions: 1, updatedAt: "t" });

    const second = createMemoryLanguageLearningRepository({ initial: replay(batches) });
    expect(second.rows()).toEqual(first.rows());
    expect(effectiveState(second.loadKnowledge("u", "fr"), "nuit")).toBe("known");
    expect(second.loadKnowledge("u", "fr").lemmas.maison).toMatchObject({ state: "learning", translation: "casa" });
  });
});
