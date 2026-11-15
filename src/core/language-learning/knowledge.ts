import type {
  KnowledgeRecord,
  KnowledgeSnapshot,
  KnowledgeState,
  LinguisticDocument,
} from "./model";

export function formKey(key: string, form: string) {
  return `${key}\u0000${form}`;
}

export function emptySnapshot(): KnowledgeSnapshot {
  return { lemmas: {}, forms: {} };
}

/**
 * Effective knowledge of one occurrence. A form override wins over the lemma
 * state so knowing "gehen" does not force "ging" to be known; without an
 * override, forms inherit their lemma's state.
 */
export function effectiveState(snapshot: KnowledgeSnapshot, key: string, form?: string): KnowledgeState {
  if (form !== undefined) {
    const override = snapshot.forms[formKey(key, form)];
    if (override) return override.state;
  }
  return snapshot.lemmas[key]?.state ?? "unknown";
}

export function lemmaState(snapshot: KnowledgeSnapshot, key: string): KnowledgeState {
  return snapshot.lemmas[key]?.state ?? "unknown";
}

/** Keyboard-friendly cycle used by the reader shortcuts. */
export function cycleState(state: KnowledgeState): KnowledgeState {
  if (state === "unknown") return "learning";
  if (state === "learning") return "known";
  if (state === "known") return "unknown";
  return "unknown";
}

/** Adding a word to the vocabulary starts learning, but never demotes. */
export function stateAfterAddingToVocabulary(state: KnowledgeState): KnowledgeState {
  return state === "known" ? "known" : "learning";
}

/** Review outcomes feed back into knowledge: mastered items become known. */
export const MASTERY_INTERVAL_DAYS = 21;

export function stateAfterReview(current: KnowledgeState, intervalDays: number, correct: boolean): KnowledgeState {
  if (current === "ignored") return "ignored";
  if (!correct) return current === "known" ? "learning" : current === "unknown" ? "learning" : current;
  return intervalDays >= MASTERY_INTERVAL_DAYS ? "known" : current === "unknown" ? "learning" : current;
}

/** Applies a lemma change to a snapshot immutably. */
export function withLemmaState(
  snapshot: KnowledgeSnapshot,
  record: KnowledgeRecord,
): KnowledgeSnapshot {
  return { ...snapshot, lemmas: { ...snapshot.lemmas, [record.key]: record } };
}

/** Per-form effective states for a whole document, computed once per snapshot. */
export function computeFormStates(document: LinguisticDocument, snapshot: KnowledgeSnapshot): KnowledgeState[] {
  return document.forms.map((form) => {
    const lexeme = document.lexicon[form.lexeme];
    return lexeme ? effectiveState(snapshot, lexeme.key, form.form) : "unknown";
  });
}
