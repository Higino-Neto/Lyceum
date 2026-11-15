import type { ExpressionKind, GrammarFeatures, LanguageCapability } from "../model";

/** A word token inside a sentence, before linguistic analysis. */
export interface SentenceTokenInput {
  text: string;
  lower: string;
  /** Index of the token inside its sentence. */
  index: number;
  /** Text between this token and the next one (punctuation, spaces). */
  trailing: string;
}

export interface TokenAnalysis {
  lemma: string;
  pos?: string;
  /** Features of the inflected form (case, tense, person, ...). */
  features?: GrammarFeatures;
  /** Features that belong to the lemma (noun gender, verb class, ...). */
  lemmaFeatures?: GrammarFeatures;
  /** True when the lemma comes from rules instead of a lexicon. */
  estimated?: boolean;
  properNounCandidate?: boolean;
}

export interface ConstructionMatch {
  key: string;
  label: string;
  kind: ExpressionKind;
  tokens: number[];
  note?: string;
  glosses?: Record<string, string>;
}

export interface SentenceAnalysis {
  tokens: TokenAnalysis[];
  constructions: ConstructionMatch[];
}

/** Document-wide facts available to analyzers (pass 1 of the pipeline). */
export interface AnalysisContext {
  /** True when this lower-cased form occurs anywhere in the document. */
  attested(lowerForm: string): boolean;
  /** True when the form occurs capitalised somewhere other than sentence start. */
  attestedCapitalizedInside(lowerForm: string): boolean;
  /** True when the form occurs in lower case somewhere. */
  attestedLowercase(lowerForm: string): boolean;
}

/**
 * Declarative multi-word expression. `chunks` are matched on lemmas or
 * lower-cased forms; tokens inside a chunk must be contiguous, chunks may
 * appear in any order inside the same sentence unless `ordered` is set.
 * The special part `{refl}` matches any reflexive pronoun of the language.
 */
export interface ExpressionPattern {
  label: string;
  kind: ExpressionKind;
  chunks: string[][];
  ordered?: boolean;
  /** Maximum distance in tokens between first and last matched token. */
  maxSpan?: number;
  note?: string;
  glosses?: Record<string, string>;
}

/** Context observation of one token, used for document-wide feature inference. */
export interface LexemeObservation {
  previousLower: string | null;
  formEqualsLemma: boolean;
}

export type GrammarRole =
  | "subject"
  | "finite-verb"
  | "verb-complement"
  | "separable-particle"
  | "direct-object"
  | "indirect-object"
  | "prepositional-phrase"
  | "subordinator";

export type Confidence = "likely" | "possible";

export interface GrammarNote {
  /** Stable code mapped to a localized explanation in the UI. */
  code: string;
  params?: Record<string, string>;
  tokens?: number[];
}

export interface ClauseAnalysis {
  type: "main" | "subordinate" | "relative" | "infinitive";
  start: number;
  end: number;
  finiteVerb?: number;
  subordinator?: number;
}

export interface RoleAnalysis {
  role: GrammarRole;
  tokens: number[];
  confidence: Confidence;
  features?: GrammarFeatures;
  note?: GrammarNote;
}

export interface GrammarAnalysis {
  clauses: ClauseAnalysis[];
  roles: RoleAnalysis[];
  notes: GrammarNote[];
}

export interface AnalyzedTokenView {
  text: string;
  lower: string;
  lemma: string;
  pos?: string;
  features?: GrammarFeatures;
  trailing: string;
}

export interface LanguageModule {
  /** ISO 639-1 code this module handles ("de", "en", ...). */
  code: string;
  /** Module identifier persisted with the analysis ("de-rules"). */
  id: string;
  /** Bump when output changes so stored analyses can be refreshed. */
  version: number;
  capabilities: LanguageCapability[];
  /** BCP 47 tag used for speech synthesis. */
  speechLang: string;
  /** Whether lemma keys keep their case (German nouns vs verbs). */
  caseSensitiveLemmas: boolean;
  segmentSentences(text: string): Array<[number, number]>;
  tokenize(text: string): Array<[number, number]>;
  analyzeSentence(tokens: SentenceTokenInput[], context: AnalysisContext): SentenceAnalysis;
  expressions?: ExpressionPattern[];
  reflexivePronouns?: string[];
  analyzeGrammar?(tokens: AnalyzedTokenView[]): GrammarAnalysis;
  /**
   * True when a lower-cased surface form can be a regular inflection of the
   * lemma. Used only by expression matching, never to assign lemmas.
   */
  formMatchesLemma?(lowerForm: string, lemma: string): boolean;
  /** Infers lemma features (e.g. noun gender) from all document occurrences. */
  inferLexemeFeatures?(
    lemma: string,
    pos: string | undefined,
    observations: LexemeObservation[],
  ): GrammarFeatures | null;
}
