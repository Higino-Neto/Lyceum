/**
 * Language-learning domain model.
 *
 * Two strictly separated families of data live here:
 *
 * 1. Document data (`LinguisticDocument` and friends): derived from the book
 *    text during import, versioned, immutable while reading and identical for
 *    every user. It is persisted inside the `.lyceum` package under
 *    `indexes/linguistic/`.
 * 2. User learning data (`KnowledgeRecord`, `ReviewItem`, `LearningAnnotation`,
 *    ...): owned by one user, never written into the package, and keyed by
 *    language + lemma so knowledge carries across documents.
 *
 * Nothing in this file is language specific. Grammatical properties are an
 * open `Record<string, string>` supplied by language modules.
 */

export const LINGUISTIC_SCHEMA = "lyceum.linguistic";
export const LINGUISTIC_SCHEMA_VERSION = 1;

/** Open grammatical feature bag ("gender" -> "fem", "case" -> "acc|dat", ...). */
export type GrammarFeatures = Record<string, string>;

/** Token flags packed into the compact token tuple. */
export const TOKEN_FLAG_PROPER_NOUN_CANDIDATE = 1;
export const TOKEN_FLAG_NUMBER = 2;
export const TOKEN_FLAG_LEMMA_ESTIMATED = 4;

/**
 * Compact token representation used on disk and in memory:
 * `[start, end, lexemeIndex, formIndex, flags]`, offsets relative to the
 * owning block text. Identity is the token id
 * `${sentenceId}.t${tokenIndexInSentence}`, never the offsets.
 */
export type TokenTuple = [start: number, end: number, lexeme: number, form: number, flags: number];

export interface LinguisticSentence {
  /** Stable id: `${blockId}.s${n}`. */
  id: string;
  start: number;
  end: number;
  tokens: TokenTuple[];
}

export type LinguisticBlockKind = "heading" | "paragraph" | "quote" | "list-item";

export interface LinguisticBlock {
  /** Stable id: `${chapterId}.b${n}`. */
  id: string;
  kind: LinguisticBlockKind;
  /** Heading level when `kind === "heading"`. */
  level?: number;
  text: string;
  sentences: LinguisticSentence[];
}

export interface LinguisticChapter {
  /** Stable id taken from the package spine id. */
  id: string;
  href: string;
  title: string;
  blocks: LinguisticBlock[];
  /** Total word tokens in the chapter (precomputed). */
  tokenCount: number;
}

export interface LexicalEntry {
  /** Stable cross-document key: `${lemma}` normalised, optionally `#pos`. */
  key: string;
  lemma: string;
  pos?: string;
  /** Grammatical properties of the lemma itself (e.g. noun gender). */
  features?: GrammarFeatures;
  /** True when the lemma was guessed by rules rather than a lexicon. */
  estimated?: boolean;
  /** Total occurrences in the document (precomputed). */
  count: number;
}

export interface SurfaceForm {
  /** Lower-cased surface form. */
  form: string;
  lexeme: number;
  /** Inflectional features of this form when known (case, tense, ...). */
  features?: GrammarFeatures;
  count: number;
}

export type ExpressionKind =
  | "idiom"
  | "phrasal"
  | "reflexive"
  | "separable"
  | "collocation"
  | "fixed";

export interface ExpressionEntry {
  key: string;
  /** Canonical display form ("sich freuen auf"). */
  label: string;
  kind: ExpressionKind;
  /** Short explanation of how the construction behaves, when known. */
  note?: string;
  /** Reference glosses shipped with the language module, by language code. */
  glosses?: Record<string, string>;
  count: number;
}

export interface ExpressionOccurrence {
  expression: number;
  sentenceId: string;
  /** Token indexes inside the sentence that realise the expression. */
  tokens: number[];
}

export interface ChapterStatistic {
  chapterId: string;
  tokenCount: number;
  uniqueLexemes: number;
  /** Lexeme index -> occurrences in chapter. */
  lexemeCounts: Record<number, number>;
}

export interface LinguisticAnalyzerInfo {
  language: string;
  module: string;
  moduleVersion: number;
  capabilities: LanguageCapability[];
}

export interface LinguisticDocument {
  schema: typeof LINGUISTIC_SCHEMA;
  schemaVersion: number;
  /** Stable document id (the package id). */
  documentId: string;
  title: string;
  language: string;
  analyzer: LinguisticAnalyzerInfo;
  createdAt: string;
  chapters: LinguisticChapter[];
  lexicon: LexicalEntry[];
  forms: SurfaceForm[];
  expressions: ExpressionEntry[];
  expressionOccurrences: ExpressionOccurrence[];
  chapterStats: ChapterStatistic[];
  totals: {
    tokens: number;
    lexemes: number;
    sentences: number;
    blocks: number;
  };
}

export type LanguageCapability =
  | "tokenization"
  | "sentence-segmentation"
  | "lemmatization"
  | "pos-tagging"
  | "morphology"
  | "expressions"
  | "syntax";

/* ------------------------------------------------------------------------ */
/* User learning data                                                       */
/* ------------------------------------------------------------------------ */

export type KnowledgeState = "unknown" | "learning" | "known" | "ignored";

export const KNOWLEDGE_STATES: readonly KnowledgeState[] = ["unknown", "learning", "known", "ignored"];

export function isKnowledgeState(value: unknown): value is KnowledgeState {
  return typeof value === "string" && (KNOWLEDGE_STATES as readonly string[]).includes(value);
}

/** Knowledge of a lemma (or expression key) for one user and language. */
export interface KnowledgeRecord {
  language: string;
  key: string;
  state: KnowledgeState;
  /** Display lemma kept for listings outside a document. */
  label: string;
  /** User-provided or saved translation. */
  translation?: string | null;
  note?: string | null;
  lookupCount: number;
  updatedAt: string;
}

/** Per-surface-form override ("I know gehen, but not ging"). */
export interface FormKnowledgeRecord {
  language: string;
  key: string;
  form: string;
  state: KnowledgeState;
  updatedAt: string;
}

export interface KnowledgeSnapshot {
  lemmas: Record<string, KnowledgeRecord>;
  /** `${key}\u0000${form}` -> override. */
  forms: Record<string, FormKnowledgeRecord>;
}

export type ExerciseType = "recognition" | "recall" | "cloze" | "listening" | "production";

export interface ReviewItem {
  id: string;
  language: string;
  key: string;
  itemType: "lexeme" | "expression";
  label: string;
  translation: string | null;
  /** Sentence from the document where the item was captured. */
  context: string | null;
  /** Surface form used in `context`, for cloze exercises. */
  contextForm: string | null;
  documentId: string | null;
  sentenceId: string | null;
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  lapses: number;
  dueAt: string;
  createdAt: string;
  lastReviewedAt: string | null;
}

export interface ReviewLogEntry {
  itemId: string;
  reviewedAt: string;
  grade: number;
  exercise: ExerciseType;
  correct: boolean;
  intervalBefore: number;
  intervalAfter: number;
}

export type AnnotationTarget = "token" | "expression" | "sentence" | "block";

export interface LearningAnnotation {
  id: string;
  documentId: string;
  targetType: AnnotationTarget;
  /** Stable element id (token/sentence/block id). */
  targetId: string;
  chapterId: string;
  quote: string;
  note: string;
  category: string;
  createdAt: string;
  updatedAt: string;
}

export interface LearningReadingState {
  documentId: string;
  chapterId: string;
  blockId: string | null;
  progress: number;
  completedChapters: string[];
  secondsRead: number;
  sessions: number;
  updatedAt: string;
}

/** Port implemented by the platform (SQLite on desktop). */
/** Saved knowledge for one user + language, used to find mislabeled buckets. */
export interface KnowledgeBucket {
  userId: string;
  language: string;
  /** Entries the user acted on (state other than unknown, or a saved translation). */
  count: number;
  keys: string[];
}

export interface KnowledgeMergeResult {
  moved: number;
  merged: number;
  reviewItems: number;
}

export const LEARNING_BACKUP_SCHEMA = "lyceum.learning-backup";

/** Portable copy of all user learning data (automatic backups, export/import). */
export interface LearningBackup {
  schema: typeof LEARNING_BACKUP_SCHEMA;
  version: 1;
  exportedAt: string;
  knowledge: KnowledgeRecord[];
  forms: FormKnowledgeRecord[];
  reviewItems: ReviewItem[];
  reviewLog: ReviewLogEntry[];
  annotations: LearningAnnotation[];
  readingStates: LearningReadingState[];
}

export interface LearningImportResult {
  knowledge: number;
  reviewItems: number;
  annotations: number;
}

export interface LanguageLearningRepository {
  loadKnowledge(userId: string, language: string): KnowledgeSnapshot;
  setLemmaState(userId: string, record: Omit<KnowledgeRecord, "updatedAt" | "lookupCount">): KnowledgeRecord;
  setFormState(userId: string, record: Omit<FormKnowledgeRecord, "updatedAt">): FormKnowledgeRecord;
  clearFormState(userId: string, language: string, key: string, form: string): void;
  recordLookup(userId: string, language: string, key: string, label: string): void;
  setTranslation(userId: string, language: string, key: string, label: string, translation: string | null): void;
  /** Sets many lemma states in one transaction. */
  setLemmaStates(userId: string, records: Array<Omit<KnowledgeRecord, "updatedAt" | "lookupCount">>): number;
  listKnowledgeBuckets(userIds: string[]): KnowledgeBucket[];
  /** Moves knowledge (and review items) from one user/language bucket into `userId`/`toLanguage`. */
  mergeKnowledge(userId: string, from: { userId: string; language: string }, toLanguage: string): KnowledgeMergeResult;
  exportUserData(userId: string): LearningBackup;
  /** Merges a backup; for each record the most recently updated version wins. */
  importUserData(userId: string, backup: LearningBackup): LearningImportResult;

  listReviewItems(userId: string, language?: string): ReviewItem[];
  upsertReviewItem(userId: string, item: ReviewItem): void;
  /** Upserts many review items in one transaction. */
  upsertReviewItems(userId: string, items: ReviewItem[]): number;
  deleteReviewItem(userId: string, id: string): void;
  logReview(userId: string, entry: ReviewLogEntry): void;
  listReviewLog(userId: string, itemId?: string): ReviewLogEntry[];

  listAnnotations(userId: string, documentId?: string): LearningAnnotation[];
  saveAnnotation(userId: string, annotation: LearningAnnotation): void;
  deleteAnnotation(userId: string, id: string): void;

  getReadingState(userId: string, documentId: string): LearningReadingState | null;
  saveReadingState(userId: string, state: LearningReadingState): void;
}
