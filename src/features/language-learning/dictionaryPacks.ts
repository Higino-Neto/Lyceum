import { getLearningBridge } from "../../platform";
import { PACK_TARGET_ANY, type PackEntry, type PackLookupResult } from "../../core/dictionary-packs";
import type { TranslationProvider, TranslationRequest, TranslationResult } from "./translation";

interface PackCatalogRow {
  id: string;
  sourceLang: string;
  targetLang: string;
  isDownloaded?: boolean;
}

export function isPackCatalogEntry(entry: { targetLang?: string }) {
  return entry.targetLang === PACK_TARGET_ANY;
}

function baseLanguage(code: string | null | undefined) {
  return (code ?? "").toLowerCase().split(/[-_]/)[0] ?? "";
}

const lookupCache = new Map<string, Promise<PackLookupResult | null>>();
let installedCache: { at: number; langs: Set<string> } | null = null;
const INSTALLED_TTL_MS = 5_000;

/** Drops cached lookups and the installed list (after a pack was installed or removed). */
export function refreshDictionaryPacks() {
  lookupCache.clear();
  installedCache = null;
}

export async function installedPackLanguages(): Promise<Set<string>> {
  if (installedCache && Date.now() - installedCache.at < INSTALLED_TTL_MS) return installedCache.langs;
  const bridge = getLearningBridge();
  let langs = new Set<string>();
  try {
    const raw = await bridge?.dictionaryGetIndex?.();
    if (Array.isArray(raw)) {
      langs = new Set((raw as PackCatalogRow[]).filter((row) => isPackCatalogEntry(row) && row.isDownloaded).map((row) => baseLanguage(row.sourceLang)));
    }
  } catch {
    // Treated as "nothing installed".
  }
  installedCache = { at: Date.now(), langs };
  return langs;
}

/**
 * Looks a clicked word up in the pack of its language. `form` is the text on
 * the page (courait); `lemma` is the reading engine's lemma, used as a hint
 * and as the fallback key.
 */
export function lookupDictionaryPack(form: string, lemma: string | null, lang: string, target: string): Promise<PackLookupResult | null> {
  const source = baseLanguage(lang);
  const into = baseLanguage(target);
  const key = `${source}|${into}|${form}|${lemma ?? ""}`;
  let pending = lookupCache.get(key);
  if (!pending) {
    pending = (async () => {
      const bridge = getLearningBridge();
      if (!bridge?.dictionaryPackLookup || !(await installedPackLanguages()).has(source)) return null;
      const result = await bridge.dictionaryPackLookup(form || lemma || "", source, into, lemma);
      if (result.found || !lemma || lemma === form) return result;
      // The engine's lemma can be a headword the surface form is not linked to.
      return bridge.dictionaryPackLookup(lemma, source, into, null);
    })();
    pending.catch(() => lookupCache.delete(key));
    lookupCache.set(key, pending);
    if (lookupCache.size > 300) lookupCache.delete(lookupCache.keys().next().value as string);
  }
  return pending;
}

function uniqueWords(entries: PackEntry[]) {
  const words: string[] = [];
  for (const entry of entries) {
    for (const translation of entry.translations) {
      if (!words.includes(translation.word)) words.push(translation.word);
    }
  }
  return words;
}

function englishGlosses(entries: PackEntry[]) {
  const glosses: string[] = [];
  for (const entry of entries) {
    for (const sense of entry.senses) {
      if (sense.formOf?.length) continue;
      const gloss = sense.gloss.replace(/\s+/g, " ").trim();
      if (gloss && !glosses.includes(gloss)) glosses.push(gloss);
    }
  }
  return glosses;
}

/** Wiktionary packs: translations into the reader's language, else English definitions. */
export class DictionaryPackProvider implements TranslationProvider {
  readonly id = "wiktionary-pack";

  supports(request: TranslationRequest) {
    if (request.kind === "word") return true;
    return request.kind === "sentence" && request.text.trim().split(/\s+/).length <= 4;
  }

  refresh() {
    refreshDictionaryPacks();
  }

  async isAvailable(request: TranslationRequest) {
    return (await installedPackLanguages()).has(baseLanguage(request.source));
  }

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    const result = await lookupDictionaryPack(request.form ?? request.text, request.text, request.source, request.target);
    if (!result?.found) throw new Error("NOT_FOUND");
    const translations = uniqueWords(result.entries);
    if (translations.length > 0) {
      return { text: translations.slice(0, 3).join(", "), alternatives: translations.slice(3, 12), providerId: this.id };
    }
    const glosses = englishGlosses(result.entries);
    if (glosses.length === 0) throw new Error("NOT_FOUND");
    // No translation into the reader's language: English definitions, labelled.
    return {
      text: glosses[0] ?? "",
      alternatives: glosses.slice(1, 6),
      providerId: this.id,
      ...(baseLanguage(request.target) !== "en" ? { language: "en" } : {}),
    };
  }
}
