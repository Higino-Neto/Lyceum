import { describe, expect, it } from "vitest";
import {
  analyzeDocument,
  computeCoverage,
  computeFormStates,
  emptySnapshot,
  getLanguageModule,
  OccurrenceIndex,
  rankDifficultWords,
  type ChapterInput,
} from "../../core/language-learning";
import { applyStateClasses, renderChapterHtml } from "../../pages/ReadingPage/components/lyceum-reader/renderChapter";

const SENTENCES = [
  "Der alte Mann geht jeden Morgen mit seinem Hund durch den Park.",
  "Gestern hatte die Lehrerin keine Zeit, weil sie viele Hefte korrigieren musste.",
  "Wir stehen früh auf und fahren mit dem Zug in die Stadt.",
  "Obwohl es regnete, spielten die Kinder im Garten hinter dem Haus.",
  "Ich freue mich auf den Urlaub am Meer.",
];

function buildChapters(chapterCount: number, paragraphsPerChapter: number): ChapterInput[] {
  let variant = 0;
  return Array.from({ length: chapterCount }, (_, c) => ({
    id: `c${c}`,
    href: `c${c}.xhtml`,
    title: `Kapitel ${c + 1}`,
    blocks: Array.from({ length: paragraphsPerChapter }, () => {
      variant += 1;
      // Unique nouns keep the lexicon realistically large.
      const extra = `Das Wort Begriff${variant} erscheint hier.`;
      return { kind: "paragraph" as const, text: `${SENTENCES.join(" ")} ${extra}` };
    }),
  }));
}

function time<T>(run: () => T): [T, number] {
  const start = performance.now();
  const result = run();
  return [result, performance.now() - start];
}

describe("performance with large documents", () => {
  it("analyzes, indexes and aggregates ~200k tokens within interactive budgets", () => {
    const chapters = buildChapters(48, 70); // 3360 paragraphs, ~200k tokens
    const [document, analyzeMs] = time(() => analyzeDocument({ documentId: "big", title: "Big", language: "de", chapters }, getLanguageModule("de")));
    expect(document.totals.tokens).toBeGreaterThan(180_000);

    const [index, indexMs] = time(() => new OccurrenceIndex(document));
    const snapshot = emptySnapshot();
    const [states, statesMs] = time(() => computeFormStates(document, snapshot));
    const [, coverageMs] = time(() => computeCoverage(document, snapshot, states));
    const [, rankMs] = time(() => rankDifficultWords(document, snapshot, states));
    const gehen = document.lexicon.findIndex((entry) => entry.key === "gehen");
    const [occurrences, lookupMs] = time(() => index.lexemeOccurrences(gehen));
    expect(occurrences.length).toBe(48 * 70);

    const chapter = document.chapters[0]!;
    const [html, renderMs] = time(() => renderChapterHtml(chapter, 0, states));
    const container = window.document.createElement("div");
    container.innerHTML = html;
    const changed = computeFormStates(document, { lemmas: { gehen: { language: "de", key: "gehen", label: "gehen", state: "known", lookupCount: 0, updatedAt: "t" } }, forms: {} });
    const [, patchMs] = time(() => applyStateClasses(container, changed));
    expect(container.querySelector(`.lx-w[data-l="${gehen}"]`)).toHaveClass("s-k");

    // Generous budgets: preprocessing happens once in a worker; reading-time
    // operations must stay well under a frame or two.
    expect(analyzeMs).toBeLessThan(15_000);
    expect(indexMs).toBeLessThan(1_000);
    expect(statesMs + coverageMs).toBeLessThan(500);
    expect(rankMs).toBeLessThan(1_000);
    expect(lookupMs).toBeLessThan(5);
    expect(renderMs).toBeLessThan(500);
    expect(patchMs).toBeLessThan(1_000);

    console.info("[perf]", {
      tokens: document.totals.tokens,
      lexemes: document.totals.lexemes,
      analyzeMs: Math.round(analyzeMs),
      indexMs: Math.round(indexMs),
      coverageMs: Math.round(statesMs + coverageMs),
      rankMs: Math.round(rankMs),
      renderChapterMs: Math.round(renderMs),
      patchMs: Math.round(patchMs),
      jsonMB: (JSON.stringify(document).length / 1e6).toFixed(1),
    });
  }, 60_000);
});
