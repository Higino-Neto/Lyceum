import {
  rankDifficultWords,
  type KnowledgeState,
  type LinguisticDocument,
} from "../../../../core/language-learning";
import type { LearningSession } from "./useLearningSession";

export type WordScope = "chapter" | "book" | "all";
export type WordSort = "relevance" | "frequency" | "alphabetical" | "recent";

export interface WordRow {
  key: string;
  label: string;
  /** Index in this book's lexicon; null for words only known from other books. */
  lexeme: number | null;
  state: KnowledgeState;
  translation: string | null;
  frequency: number;
  score: number;
  updatedAt: string;
  properNoun: boolean;
}

export function fold(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();
}

function isWordLike(lemma: string) {
  return /\p{L}/u.test(lemma);
}

/** Builds the rows for a scope; pure so it can be tested and memoized. */
export function buildWordRows(
  document: LinguisticDocument,
  session: Pick<LearningSession, "snapshot" | "formStates" | "lookups" | "lapses">,
  scope: WordScope,
  chapterIndex: number,
): WordRow[] {
  const { snapshot } = session;
  const chapterScope = scope === "chapter" ? [chapterIndex] : undefined;
  const relevance = new Map<number, number>();
  for (const word of rankDifficultWords(document, snapshot, session.formStates, { lookups: session.lookups, lapses: session.lapses }, chapterScope, Number.MAX_SAFE_INTEGER)) {
    relevance.set(word.lexeme, word.score);
  }
  const chapterCounts = scope === "chapter" ? document.chapterStats[chapterIndex]?.lexemeCounts ?? {} : null;
  const lexemeByKey = new Map<string, number>();
  document.lexicon.forEach((entry, index) => lexemeByKey.set(entry.key, index));

  const rowFor = (lexeme: number | null, key: string, label: string, frequency: number): WordRow => {
    const record = snapshot.lemmas[key];
    const state = record?.state ?? "unknown";
    const entry = lexeme === null ? undefined : document.lexicon[lexeme];
    const relevant = lexeme === null ? undefined : relevance.get(lexeme);
    return {
      key,
      label,
      lexeme,
      state,
      translation: record?.translation ?? null,
      frequency,
      // Words still to learn rank first by impact; the rest follow by frequency.
      score: relevant ?? (state === "known" || state === "ignored" ? -1000 : -500) + Math.log2(1 + frequency),
      updatedAt: record?.updatedAt ?? "",
      properNoun: entry?.features?.properNoun === "candidate",
    };
  };

  if (scope === "all") {
    const rows: WordRow[] = [];
    for (const record of Object.values(snapshot.lemmas)) {
      if (record.state === "unknown" && !record.translation) continue;
      const lexeme = lexemeByKey.get(record.key) ?? null;
      const frequency = lexeme === null ? 0 : document.lexicon[lexeme]?.count ?? 0;
      rows.push(rowFor(lexeme, record.key, record.label, frequency));
    }
    return rows;
  }

  const rows: WordRow[] = [];
  document.lexicon.forEach((entry, lexeme) => {
    const frequency = chapterCounts ? chapterCounts[lexeme] ?? 0 : entry.count;
    if (frequency === 0 || !isWordLike(entry.lemma)) return;
    rows.push(rowFor(lexeme, entry.key, entry.lemma, frequency));
  });
  return rows;
}

export function sortWordRows(rows: WordRow[], sort: WordSort, locale: string) {
  const collator = new Intl.Collator(locale, { sensitivity: "base" });
  const sorted = rows.slice();
  if (sort === "alphabetical") sorted.sort((a, b) => collator.compare(a.label, b.label));
  else if (sort === "frequency") sorted.sort((a, b) => b.frequency - a.frequency || collator.compare(a.label, b.label));
  else if (sort === "recent") sorted.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.frequency - a.frequency);
  else sorted.sort((a, b) => b.score - a.score || b.frequency - a.frequency);
  return sorted;
}
