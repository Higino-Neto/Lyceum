export type VocabularyStatus = "new" | "learning" | "known";

export interface VocabularyEntry {
  normalizedWord: string;
  displayWord: string;
  status: VocabularyStatus;
  saved: boolean;
  updatedAt: number;
}

export interface PersistedVocabularyState {
  indexedWordCount: number;
  entries: Record<string, VocabularyEntry>;
}

export interface VocabularyStats {
  indexedWordCount: number;
  knownCount: number;
  learningCount: number;
  newCount: number;
  trackedCount: number;
  progressPercent: number;
}

export interface TokenizedTextPart {
  type: "word" | "text";
  value: string;
  normalizedWord?: string;
}

export interface LearningOverlayAnchor {
  left: number;
  top: number;
  placement: "top" | "bottom";
}

export interface WordInteractionPayload {
  displayWord: string;
  normalizedWord: string;
  anchor: LearningOverlayAnchor;
  scrollTop: number;
}

export interface TextSelectionPayload {
  selectedText: string;
  anchor: LearningOverlayAnchor;
  scrollTop: number;
}

const WORD_PATTERN = /\p{L}+(?:['-]\p{L}+)*/gu;

export const DEFAULT_VOCABULARY_STATE: PersistedVocabularyState = {
  indexedWordCount: 0,
  entries: {},
};

export const VOCABULARY_STORAGE_PREFIX = "lyceum-reader-settings:vocabulary:";

export function normalizeVocabularyWord(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\u2018\u2019`]/g, "'")
    .replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "")
    .toLocaleLowerCase();
}

export function tokenizeText(text: string): TokenizedTextPart[] {
  const parts: TokenizedTextPart[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(WORD_PATTERN)) {
    const word = match[0];
    const index = match.index ?? 0;

    if (index > lastIndex) {
      parts.push({
        type: "text",
        value: text.slice(lastIndex, index),
      });
    }

    parts.push({
      type: "word",
      value: word,
      normalizedWord: normalizeVocabularyWord(word),
    });

    lastIndex = index + word.length;
  }

  if (lastIndex < text.length) {
    parts.push({
      type: "text",
      value: text.slice(lastIndex),
    });
  }

  return parts;
}

export function extractUniqueWords(text: string) {
  const words = new Set<string>();

  for (const part of tokenizeText(text)) {
    if (part.type === "word" && part.normalizedWord) {
      words.add(part.normalizedWord);
    }
  }

  return words;
}

export function cycleVocabularyStatus(status: VocabularyStatus): VocabularyStatus {
  if (status === "new") return "learning";
  if (status === "learning") return "known";
  return "new";
}

export function cycleVocabularyStatusInverse(status: VocabularyStatus): VocabularyStatus {
  if (status === "new") return "known";
  if (status === "known") return "learning";
  return "new";
}

export function sanitizeLookupWord(word: string) {
  return normalizeVocabularyWord(word).replace(/'/g, "");
}

export function getVocabularyStatusLabel(status: VocabularyStatus) {
  if (status === "learning") return "Aprendendo";
  if (status === "known") return "Conhecida";
  return "Nova";
}

export function getVocabularyStatusClasses(status: VocabularyStatus) {
  if (status === "learning") {
    return "bg-amber-400/15 text-amber-200 border border-amber-300/40";
  }

  if (status === "known") {
    return "bg-emerald-500/15 text-emerald-200 border border-emerald-300/40";
  }

  return "bg-zinc-800 text-zinc-300 border border-zinc-700";
}

export function getVocabularyRowClasses(status: VocabularyStatus) {
  if (status === "learning") {
    return "border-amber-400/20 bg-amber-400/5";
  }

  if (status === "known") {
    return "border-emerald-400/20 bg-emerald-400/5";
  }

  return "border-zinc-800 bg-zinc-900/70";
}

export function buildVocabularyStorageKey(fileHash: string) {
  return `${VOCABULARY_STORAGE_PREFIX}${fileHash}`;
}

export function simplifyEnglishText(text: string) {
  if (!text.trim()) return "";

  const replacements: Array<[RegExp, string]> = [
    [/\bhowever\b/gi, "but"],
    [/\btherefore\b/gi, "so"],
    [/\bnevertheless\b/gi, "still"],
    [/\bfurthermore\b/gi, "also"],
    [/\bapproximately\b/gi, "about"],
    [/\bindividuals\b/gi, "people"],
    [/\butilize\b/gi, "use"],
    [/\bcommence\b/gi, "start"],
    [/\bendeavor\b/gi, "try"],
    [/\bsubsequent\b/gi, "next"],
    [/\bprior to\b/gi, "before"],
    [/\bin order to\b/gi, "to"],
  ];

  const withoutParentheses = text.replace(/\(([^)]+)\)/g, "$1");
  const rewritten = replacements.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    withoutParentheses,
  );

  return rewritten
    .replace(/\s*([,;:])\s*/g, ". ")
    .replace(/\s{2,}/g, " ")
    .replace(/([.!?])(?=[A-Z])/g, "$1 ")
    .trim();
}
