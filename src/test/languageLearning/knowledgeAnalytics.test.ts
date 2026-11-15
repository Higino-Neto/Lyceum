import { describe, expect, it } from "vitest";
import {
  analyzeDocument,
  checkAnswer,
  clozeSentence,
  computeCoverage,
  computeFormStates,
  createReviewItem,
  cycleState,
  effectiveState,
  emptySnapshot,
  formKey,
  getLanguageModule,
  GRADE,
  rankDifficultWords,
  recommendWordsToLearn,
  scheduleReview,
  stateAfterAddingToVocabulary,
  stateAfterReview,
  summarizeChapters,
  chooseExercise,
  availableExercises,
  type KnowledgeSnapshot,
  type KnowledgeState,
} from "../../core/language-learning";

function snapshotWith(lemmas: Record<string, KnowledgeState>, forms: Record<string, [string, KnowledgeState]> = {}): KnowledgeSnapshot {
  const snapshot = emptySnapshot();
  for (const [key, state] of Object.entries(lemmas)) {
    snapshot.lemmas[key] = { language: "de", key, label: key, state, lookupCount: 0, updatedAt: "t" };
  }
  for (const [key, [form, state]] of Object.entries(forms)) {
    snapshot.forms[formKey(key, form)] = { language: "de", key, form, state, updatedAt: "t" };
  }
  return snapshot;
}

// "der" ×4 in ch1? Build a tiny, countable document.
const document = analyzeDocument({
  documentId: "d",
  title: "T",
  language: "de",
  chapters: [
    { id: "a", href: "a", title: "A", blocks: [{ kind: "paragraph", text: "Ich gehe. Ich ging. Ich gehe gern." }] },
    { id: "b", href: "b", title: "B", blocks: [{ kind: "paragraph", text: "Ich gehe. Berlin ist groß." }] },
  ],
}, getLanguageModule("de"));

describe("knowledge states", () => {
  it("assigns unknown to words without user data", () => {
    expect(effectiveState(emptySnapshot(), "gehen")).toBe("unknown");
  });

  it("lets forms inherit lemma state unless overridden", () => {
    const snapshot = snapshotWith({ gehen: "known" }, { gehen: ["ging", "learning"] });
    expect(effectiveState(snapshot, "gehen", "gehe")).toBe("known");
    expect(effectiveState(snapshot, "gehen", "ging")).toBe("learning");
  });

  it("follows the documented transitions", () => {
    expect(cycleState("unknown")).toBe("learning");
    expect(cycleState("learning")).toBe("known");
    expect(cycleState("known")).toBe("unknown");
    expect(stateAfterAddingToVocabulary("unknown")).toBe("learning");
    expect(stateAfterAddingToVocabulary("known")).toBe("known");
    expect(stateAfterReview("learning", 30, true)).toBe("known");
    expect(stateAfterReview("known", 0, false)).toBe("learning");
    expect(stateAfterReview("ignored", 30, true)).toBe("ignored");
  });
});

describe("coverage statistics", () => {
  it("distinguishes unique and occurrence-weighted coverage", () => {
    // tokens: ich×4, gehen×4 (gehe×3, ging×1), gern, Berlin, sein(ist), groß = 12 tokens, 6 lexemes
    const snapshot = snapshotWith({ ich: "known" });
    const coverage = computeCoverage(document, snapshot, computeFormStates(document, snapshot));
    expect(coverage.occurrences.total).toBe(document.totals.tokens);
    expect(coverage.occurrences.known).toBe(4);
    expect(coverage.unique.known).toBe(1);
    expect(coverage.unique.total).toBe(document.totals.lexemes);
    expect(coverage.occurrenceCoverage.known).toBeCloseTo((4 / document.totals.tokens) * 100);
    expect(coverage.uniqueCoverage.known).toBeCloseTo((1 / document.totals.lexemes) * 100);
  });

  it("reflects form overrides only in occurrence counts", () => {
    const snapshot = snapshotWith({ gehen: "known" }, { gehen: ["ging", "learning"] });
    const coverage = computeCoverage(document, snapshot, computeFormStates(document, snapshot));
    expect(coverage.occurrences.known).toBe(3);
    expect(coverage.occurrences.learning).toBe(1);
    expect(coverage.unique.known).toBe(1);
  });

  it("excludes ignored words from percentages", () => {
    const snapshot = snapshotWith({ Berlin: "ignored", ich: "known" });
    const coverage = computeCoverage(document, snapshot, computeFormStates(document, snapshot));
    expect(coverage.occurrences.ignored).toBe(1);
    expect(coverage.occurrenceCoverage.known).toBeCloseTo((4 / (document.totals.tokens - 1)) * 100);
  });

  it("aggregates chapters consistently with the whole document", () => {
    const snapshot = snapshotWith({ ich: "known" });
    const states = computeFormStates(document, snapshot);
    const summaries = summarizeChapters(document, snapshot, states);
    const sum = summaries.reduce((total, chapter) => total + chapter.coverage.occurrences.known, 0);
    expect(sum).toBe(computeCoverage(document, snapshot, states).occurrences.known);
    expect(summaries.map((s) => s.coverage.occurrences.total)).toEqual(document.chapterStats.map((c) => c.tokenCount));
  });

  it("works with incomplete linguistic information (no lemmatization)", () => {
    const plain = analyzeDocument({
      documentId: "x", title: "x", language: "sv",
      chapters: [{ id: "c", href: "c", title: "c", blocks: [{ kind: "paragraph", text: "hund hundar hund" }] }],
    }, getLanguageModule("sv"));
    const snapshot = emptySnapshot();
    snapshot.lemmas.hund = { language: "sv", key: "hund", label: "hund", state: "known", lookupCount: 0, updatedAt: "t" };
    const coverage = computeCoverage(plain, snapshot, computeFormStates(plain, snapshot));
    expect(coverage.occurrences).toMatchObject({ known: 2, unknown: 1, total: 3 });
  });
});

describe("difficulty ranking and recommendations", () => {
  it("ranks frequent and blocking words above rare ones, not alphabetically", () => {
    const snapshot = snapshotWith({ ich: "known" });
    const states = computeFormStates(document, snapshot);
    const ranked = rankDifficultWords(document, snapshot, states);
    expect(ranked[0]?.key).toBe("gehen");
    // "Ich gehe." / "Ich ging." are blocked only by gehen.
    expect(ranked[0]?.unlocksSentences).toBeGreaterThanOrEqual(3);
    const withLookups = rankDifficultWords(document, snapshot, states, { lookups: { "groß": 10 } });
    expect(withLookups.findIndex((w) => w.key === "groß")).toBeLessThan(ranked.findIndex((w) => w.key === "groß"));
  });

  it("projects coverage exactly", () => {
    const snapshot = snapshotWith({ ich: "known" });
    const states = computeFormStates(document, snapshot);
    const recommendation = recommendWordsToLearn(document, snapshot, states, {}, undefined, 1)!;
    expect(recommendation.words[0]?.key).toBe("gehen");
    expect(recommendation.projectedCoverage).toBeCloseTo(((4 + 4) / document.totals.tokens) * 100);
  });
});

describe("spaced repetition (SM-2)", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  const item = createReviewItem({ language: "de", key: "gehen", itemType: "lexeme", label: "gehen", translation: "to go", context: "Ich ging nach Hause.", contextForm: "ging" }, now);

  it("follows the SM-2 interval progression", () => {
    const first = scheduleReview(item, GRADE.good, now).item;
    const second = scheduleReview(first, GRADE.good, now).item;
    const third = scheduleReview(second, GRADE.good, now).item;
    expect([first.intervalDays, second.intervalDays, third.intervalDays]).toEqual([1, 6, Math.round(6 * second.easeFactor)]);
    expect(Date.parse(first.dueAt) - now.getTime()).toBe(24 * 3600 * 1000);
  });

  it("resets on lapses and lowers ease, never below 1.3", () => {
    let current = scheduleReview(item, GRADE.good, now).item;
    const lapse = scheduleReview(current, GRADE.again, now);
    expect(lapse.correct).toBe(false);
    expect(lapse.item).toMatchObject({ repetitions: 0, intervalDays: 0, lapses: 1 });
    current = lapse.item;
    for (let i = 0; i < 20; i += 1) current = scheduleReview(current, GRADE.again, now).item;
    expect(current.easeFactor).toBe(1.3);
  });

  it("builds only exercises supported by the item's data", () => {
    expect(availableExercises(item, { speech: false })).toEqual(["recognition", "recall", "cloze", "production"]);
    const bare = createReviewItem({ language: "de", key: "x", itemType: "expression", label: "x" }, now);
    expect(availableExercises(bare, { speech: true })).toEqual(["recognition", "production"]);
    expect(chooseExercise(item, { speech: true })).toBe("recognition");
  });

  it("creates cloze gaps on whole words and checks answers honestly", () => {
    expect(clozeSentence("Ich ging nach Hause.", "ging")).toEqual({ before: "Ich ", after: " nach Hause.", answer: "ging" });
    expect(clozeSentence("Ich vergingte.", "ging")).toBeNull();
    expect(checkAnswer("Straße", "straße")).toBe("correct");
    expect(checkAnswer("Straße", "strasse")).toBe("accent");
    expect(checkAnswer("gegangen", "gegangn")).toBe("typo");
    expect(checkAnswer("gehen", "laufen")).toBe("wrong");
  });
});
