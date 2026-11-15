import type { KnowledgeSnapshot, KnowledgeState, LinguisticDocument } from "./model";
import { lemmaState } from "./knowledge";

export interface StateCounts {
  known: number;
  learning: number;
  unknown: number;
  ignored: number;
  total: number;
}

export interface CoverageStats {
  /** Distinct lexical entries by lemma state. */
  unique: StateCounts;
  /** Token occurrences by effective (form-aware) state. */
  occurrences: StateCounts;
  /** Percentages over non-ignored distinct entries. */
  uniqueCoverage: { known: number; learning: number; unknown: number };
  /** Percentages over non-ignored occurrences (frequency weighted). */
  occurrenceCoverage: { known: number; learning: number; unknown: number };
}

function emptyCounts(): StateCounts {
  return { known: 0, learning: 0, unknown: 0, ignored: 0, total: 0 };
}

function percentages(counts: StateCounts) {
  const denominator = counts.total - counts.ignored;
  if (denominator <= 0) return { known: 0, learning: 0, unknown: 0 };
  return {
    known: (counts.known / denominator) * 100,
    learning: (counts.learning / denominator) * 100,
    unknown: (counts.unknown / denominator) * 100,
  };
}

function chapterIndexes(document: LinguisticDocument, scope?: number[]) {
  return scope ?? document.chapters.map((_, index) => index);
}

/**
 * Coverage of a document (or a subset of chapters). `formStates` comes from
 * `computeFormStates` so form overrides are reflected in occurrence counts.
 */
export function computeCoverage(
  document: LinguisticDocument,
  snapshot: KnowledgeSnapshot,
  formStates: KnowledgeState[],
  scope?: number[],
): CoverageStats {
  const occurrences = emptyCounts();
  const seen = new Set<number>();

  for (const chapterIndex of chapterIndexes(document, scope)) {
    const chapter = document.chapters[chapterIndex];
    if (!chapter) continue;
    for (const block of chapter.blocks) {
      for (const sentence of block.sentences) {
        for (const token of sentence.tokens) {
          const state = formStates[token[3]] ?? "unknown";
          occurrences[state] += 1;
          occurrences.total += 1;
          seen.add(token[2]);
        }
      }
    }
  }

  const unique = emptyCounts();
  for (const lexeme of seen) {
    const entry = document.lexicon[lexeme];
    if (!entry) continue;
    unique[lemmaState(snapshot, entry.key)] += 1;
    unique.total += 1;
  }

  return {
    unique,
    occurrences,
    uniqueCoverage: percentages(unique),
    occurrenceCoverage: percentages(occurrences),
  };
}

export interface LearningSignals {
  /** key -> number of times the user looked the entry up. */
  lookups?: Record<string, number>;
  /** key -> review lapses (forgotten answers). */
  lapses?: Record<string, number>;
}

export interface DifficultWord {
  lexeme: number;
  key: string;
  lemma: string;
  state: KnowledgeState;
  score: number;
  frequency: number;
  lookups: number;
  lapses: number;
  /** Sentences in which this is the only non-known word. */
  unlocksSentences: number;
}

/**
 * Ranks unknown/learning words by how much they matter for this reading:
 * frequency in scope, sentences they alone block, user lookups and review
 * lapses. Never alphabetical or by first appearance.
 */
export function rankDifficultWords(
  document: LinguisticDocument,
  snapshot: KnowledgeSnapshot,
  formStates: KnowledgeState[],
  signals: LearningSignals = {},
  scope?: number[],
  limit = 20,
): DifficultWord[] {
  const frequency = new Map<number, number>();
  const unlocks = new Map<number, number>();

  for (const chapterIndex of chapterIndexes(document, scope)) {
    const chapter = document.chapters[chapterIndex];
    if (!chapter) continue;
    for (const block of chapter.blocks) {
      for (const sentence of block.sentences) {
        const blocking = new Set<number>();
        for (const token of sentence.tokens) {
          const state = formStates[token[3]] ?? "unknown";
          if (state === "known" || state === "ignored") continue;
          frequency.set(token[2], (frequency.get(token[2]) ?? 0) + 1);
          blocking.add(token[2]);
        }
        if (blocking.size === 1) {
          const [only] = blocking;
          if (only !== undefined) unlocks.set(only, (unlocks.get(only) ?? 0) + 1);
        }
      }
    }
  }

  const ranked: DifficultWord[] = [];
  for (const [lexeme, count] of frequency) {
    const entry = document.lexicon[lexeme];
    if (!entry) continue;
    const lookups = signals.lookups?.[entry.key] ?? 0;
    const lapses = signals.lapses?.[entry.key] ?? 0;
    const unlocksSentences = unlocks.get(lexeme) ?? 0;
    const score = Math.log2(1 + count) * 2 + unlocksSentences * 1.5 + lookups * 1.2 + lapses * 2;
    ranked.push({
      lexeme,
      key: entry.key,
      lemma: entry.lemma,
      state: lemmaState(snapshot, entry.key),
      score,
      frequency: count,
      lookups,
      lapses,
      unlocksSentences,
    });
  }
  return ranked.sort((a, b) => b.score - a.score || b.frequency - a.frequency).slice(0, limit);
}

export interface ChapterSummary {
  chapterIndex: number;
  chapterId: string;
  title: string;
  coverage: CoverageStats;
  topUnknown: DifficultWord[];
}

export function summarizeChapters(
  document: LinguisticDocument,
  snapshot: KnowledgeSnapshot,
  formStates: KnowledgeState[],
  signals: LearningSignals = {},
  topLimit = 5,
): ChapterSummary[] {
  return document.chapters
    .map((chapter, chapterIndex) => ({
      chapterIndex,
      chapterId: chapter.id,
      title: chapter.title,
      coverage: computeCoverage(document, snapshot, formStates, [chapterIndex]),
      topUnknown: rankDifficultWords(document, snapshot, formStates, signals, [chapterIndex], topLimit),
    }))
    .filter((summary) => summary.coverage.occurrences.total > 0);
}

export interface CoverageRecommendation {
  scope: number[] | null;
  words: DifficultWord[];
  currentCoverage: number;
  projectedCoverage: number;
}

/**
 * Exact projection: occurrence coverage if the top-ranked words were known.
 */
export function recommendWordsToLearn(
  document: LinguisticDocument,
  snapshot: KnowledgeSnapshot,
  formStates: KnowledgeState[],
  signals: LearningSignals = {},
  scope?: number[],
  count = 10,
): CoverageRecommendation | null {
  const coverage = computeCoverage(document, snapshot, formStates, scope);
  const denominator = coverage.occurrences.total - coverage.occurrences.ignored;
  if (denominator <= 0) return null;
  const words = rankDifficultWords(document, snapshot, formStates, signals, scope, count);
  if (words.length === 0) return null;
  const gained = words.reduce((sum, word) => sum + word.frequency, 0);
  return {
    scope: scope ?? null,
    words,
    currentCoverage: coverage.occurrenceCoverage.known,
    projectedCoverage: ((coverage.occurrences.known + gained) / denominator) * 100,
  };
}

/** Chapters ordered from hardest (lowest known occurrence coverage) to easiest. */
export function hardestChapters(summaries: ChapterSummary[], limit = 3): ChapterSummary[] {
  return [...summaries]
    .sort((a, b) => a.coverage.occurrenceCoverage.known - b.coverage.occurrenceCoverage.known)
    .slice(0, limit);
}
