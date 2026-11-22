import { effectiveState, type KnowledgeSnapshot, type LinguisticDocument, type OccurrenceIndex } from "../../core/language-learning";
import { packKey, type PackEntry } from "../../core/dictionary-packs";

/** Dictionary form rows that are not inflections of the word itself. */
const NON_INFLECTION_TAGS = new Set(["auxiliary", "table-tags", "inflection-template", "class", "romanization"]);

const formLookupCache = new WeakMap<LinguisticDocument, Map<string, number[]>>();

/** `form text -> surface form indexes` for a document, built once per document. */
function formLookup(document: LinguisticDocument) {
  let lookup = formLookupCache.get(document);
  if (!lookup) {
    lookup = new Map();
    document.forms.forEach((form, index) => {
      const key = packKey(form.form);
      const list = lookup!.get(key);
      if (list) list.push(index);
      else lookup!.set(key, [index]);
    });
    formLookupCache.set(document, lookup);
  }
  return lookup;
}

/** Single-word inflections the dictionary lists for an entry, the headword included. */
export function dictionaryInflections(entry: PackEntry | undefined): string[] {
  if (!entry) return [];
  const keys = new Set<string>([packKey(entry.word)]);
  for (const item of entry.forms) {
    if (item.tags.some((tag) => NON_INFLECTION_TAGS.has(tag))) continue;
    const key = packKey(item.form);
    if (key && !key.includes(" ")) keys.add(key);
  }
  return [...keys];
}

export interface InflectionSet {
  /** Surface form indexes in the book: the lemma's own forms plus every dictionary inflection found in the text. */
  forms: number[];
  /** Occurrences of all those forms, in reading order. */
  occurrences: number[];
  /** Total occurrences counting every inflection. */
  count: number;
}

/**
 * Every form of a word that appears in the book. The reading engine groups
 * forms under one lemma, but it misses irregular inflections it could not
 * lemmatize (`fut` → `être`); the Wiktionary inflection table fills that gap.
 */
export function inflectionSet(document: LinguisticDocument, index: OccurrenceIndex, lexeme: number, entry: PackEntry | undefined): InflectionSet {
  const forms = new Set(index.formsOfLexeme(lexeme));
  const lookup = formLookup(document);
  for (const key of dictionaryInflections(entry)) for (const form of lookup.get(key) ?? []) forms.add(form);
  const list = [...forms].sort((a, b) => (document.forms[b]?.count ?? 0) - (document.forms[a]?.count ?? 0));
  const occurrences = list.length === 1 ? index.formOccurrences(list[0]!) : list.flatMap((form) => index.formOccurrences(form)).sort((a, b) => a - b);
  return { forms: list, occurrences, count: occurrences.length };
}

/** Changes needed so every inflection in the set reads as `known`. */
export function markAllInflectionsPlan(document: LinguisticDocument, snapshot: KnowledgeSnapshot, lexeme: number, forms: number[]) {
  const entry = document.lexicon[lexeme];
  const clearForms: Array<{ key: string; form: string }> = [];
  const setForms: Array<{ key: string; form: string }> = [];
  if (!entry) return { clearForms, setForms, allKnown: true };
  let allKnown = (snapshot.lemmas[entry.key]?.state ?? "unknown") === "known";
  for (const formIndex of forms) {
    const form = document.forms[formIndex];
    const owner = form ? document.lexicon[form.lexeme] : undefined;
    if (!form || !owner) continue;
    const known = effectiveState(snapshot, owner.key, form.form) === "known";
    if (!known) allKnown = false;
    if (form.lexeme === lexeme) {
      const override = snapshot.forms[`${owner.key}\u0000${form.form}`];
      if (override && override.state !== "known") clearForms.push({ key: owner.key, form: form.form });
    } else if (!known) {
      // A homograph or a form the engine filed under another lemma: only this form changes.
      setForms.push({ key: owner.key, form: form.form });
    }
  }
  return { clearForms, setForms, allKnown };
}
