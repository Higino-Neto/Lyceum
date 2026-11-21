import { getLearningBridge } from "../../platform";
import { DictionaryPackProvider, isPackCatalogEntry } from "./dictionaryPacks";
/**
 * Extensible translation provider architecture. Providers declare what they
 * support; when none is available the UI shows an unavailable state rather
 * than fabricated output.
 */
export type TranslationKind = "word" | "sentence" | "paragraph";

export interface TranslationRequest {
  text: string;
  source: string;
  target: string;
  kind: TranslationKind;
  /** The word as written on the page (`courait`) when `text` is its lemma. */
  form?: string;
}

export interface TranslationResult {
  text: string;
  alternatives: string[];
  providerId: string;
  /** Language of `text` when it differs from the requested target (dictionary fallback). */
  language?: string;
}

export interface TranslationProvider {
  id: string;
  supports(request: TranslationRequest): boolean;
  isAvailable(request: TranslationRequest): Promise<boolean>;
  translate(request: TranslationRequest): Promise<TranslationResult>;
  /** Drops cached provider state (e.g. after a dictionary was installed). */
  refresh?(): void;
}

export type TranslationOutcome =
  | { status: "ok"; result: TranslationResult }
  | { status: "unavailable" }
  | { status: "error"; message: string };

interface DictionaryInfo {
  id: string;
  sourceLang: string;
  targetLang: string;
  isDownloaded?: boolean;
}

interface DictionaryLookup {
  found?: boolean;
  content?: string;
}

interface DictionaryBridge {
  dictionaryGetIndex?: () => Promise<unknown>;
  dictionaryLookup?: (word: string, dictId?: string) => Promise<unknown>;
}

function dictionaryBridge(): DictionaryBridge | null {
  return getLearningBridge() as DictionaryBridge | null;
}

/** Extracts glosses from the HTML of an offline dictionary entry. */
export function parseDictionaryHtml(html: string): string[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  // Pronunciation (gray) and grammar labels (FreeDict/WikDict "grammar" class,
  // green) are metadata, not translations.
  doc.querySelectorAll('font[color="gray"], font.grammar, font[color="green"]').forEach((node) => node.remove());
  const glosses: string[] = [];
  const nodes = doc.querySelectorAll("li, div");
  const sources = nodes.length > 0 ? Array.from(nodes) : [doc.body];
  for (const node of sources) {
    if (node.querySelector("li, div")) continue;
    for (const part of (node.textContent ?? "").split(/[,;\n]/)) {
      const value = part.replace(/\s+/g, " ").replace(/^\d+[.)]\s*/, "").replace(/^[/\s]+|[/\s]+$/g, "").trim();
      if (value && value.length < 80) glosses.push(value);
    }
  }
  return Array.from(new Set(glosses));
}

const ISO3_TO_ISO1: Record<string, string> = {
  ara: "ar", ces: "cs", dan: "da", deu: "de", ell: "el", eng: "en", fin: "fi", fra: "fr",
  hun: "hu", ita: "it", jpn: "ja", kor: "ko", nld: "nl", nor: "no", pol: "pl", por: "pt",
  ron: "ro", rus: "ru", spa: "es", swe: "sv", tur: "tr", ukr: "uk", zho: "zh",
};

/** `pt-BR` → `pt`, `fra` → `fr`: dictionaries and books label languages differently. */
export function baseLanguage(code: string | null | undefined): string {
  const base = (code ?? "").toLowerCase().split(/[-_]/)[0] ?? "";
  return ISO3_TO_ISO1[base] ?? base;
}

/** How long a cached dictionary index is trusted before a miss re-reads it. */
const INDEX_MISS_REFRESH_MS = 5_000;
/** Multi-word expressions short enough to exist as dictionary headwords. */
const MAX_DICTIONARY_PHRASE_WORDS = 4;

/** Offline bilingual dictionaries downloaded in Lyceum settings. */
export class OfflineDictionaryProvider implements TranslationProvider {
  readonly id = "offline-dictionary";
  private index: DictionaryInfo[] | null = null;
  private indexLoadedAt = 0;

  supports(request: TranslationRequest) {
    if (request.kind === "word") return true;
    // Short expressions ("tout à fait") are often dictionary headwords too.
    return request.kind === "sentence"
      && request.text.trim().split(/\s+/).length <= MAX_DICTIONARY_PHRASE_WORDS;
  }

  refresh() {
    this.index = null;
  }

  private async loadIndex(force = false) {
    const bridge = dictionaryBridge();
    if (!bridge?.dictionaryGetIndex) return [];
    if (!this.index || force) {
      try {
        const raw = await bridge.dictionaryGetIndex();
        this.index = Array.isArray(raw) ? (raw as DictionaryInfo[]) : [];
      } catch {
        this.index = [];
      }
      this.indexLoadedAt = Date.now();
    }
    return this.index;
  }

  /**
   * Exact pair first, then the source language into English, then any
   * downloaded dictionary for the source language (its output language is
   * reported so the UI can label it).
   */
  private pick(index: DictionaryInfo[], source: string, target: string) {
    const from = baseLanguage(source);
    const to = baseLanguage(target);
    const downloaded = index.filter((d) => d.isDownloaded && !isPackCatalogEntry(d) && baseLanguage(d.sourceLang) === from);
    return downloaded.find((d) => baseLanguage(d.targetLang) === to)
      ?? downloaded.find((d) => baseLanguage(d.targetLang) === "en")
      ?? downloaded[0]
      ?? null;
  }

  private async findDictionary(source: string, target: string) {
    let index = await this.loadIndex();
    let dictionary = this.pick(index, source, target);
    // A dictionary installed after the index was cached must not be missed.
    if (!dictionary && Date.now() - this.indexLoadedAt > INDEX_MISS_REFRESH_MS) {
      index = await this.loadIndex(true);
      dictionary = this.pick(index, source, target);
    }
    return dictionary;
  }

  async isAvailable(request: TranslationRequest) {
    return Boolean(await this.findDictionary(request.source, request.target));
  }

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    const dictionary = await this.findDictionary(request.source, request.target);
    const bridge = dictionaryBridge();
    if (!dictionary || !bridge?.dictionaryLookup) throw new Error("UNAVAILABLE");
    const result = (await bridge.dictionaryLookup(request.text.trim(), dictionary.id)) as DictionaryLookup | null;
    if (!result?.found || !result.content) throw new Error("NOT_FOUND");
    const glosses = parseDictionaryHtml(result.content);
    if (glosses.length === 0) throw new Error("NOT_FOUND");
    return {
      text: glosses.slice(0, 3).join(", "),
      alternatives: glosses.slice(3, 12),
      providerId: this.id,
      ...(baseLanguage(dictionary.targetLang) !== baseLanguage(request.target) ? { language: dictionary.targetLang } : {}),
    };
  }
}

interface OnlineBridge {
  languageLearningTranslateOnline?: (text: string, source: string, target: string) =>
    Promise<{ success: true; translation: string } | { success: false; error: string }>;
}

/** MyMemory via the main process. Only active when the user opts in. */
export class OnlineTranslationProvider implements TranslationProvider {
  readonly id = "online-mymemory";

  constructor(private readonly enabled: () => boolean) {}

  supports(request: TranslationRequest) {
    return request.text.length <= 500;
  }

  async isAvailable() {
    const bridge = getLearningBridge() as OnlineBridge | null;
    return this.enabled() && typeof bridge?.languageLearningTranslateOnline === "function";
  }

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    const bridge = getLearningBridge() as OnlineBridge | null;
    if (!bridge?.languageLearningTranslateOnline) throw new Error("UNAVAILABLE");
    const response = await bridge.languageLearningTranslateOnline(request.text, request.source, request.target);
    if (!response.success) throw new Error("error" in response ? response.error : "UNKNOWN");
    return { text: response.translation, alternatives: [], providerId: this.id };
  }
}

export class TranslationService {
  private readonly cache = new Map<string, TranslationOutcome>();

  constructor(private readonly providers: TranslationProvider[]) {}

  refresh() {
    this.cache.clear();
    for (const provider of this.providers) provider.refresh?.();
  }

  async translate(request: TranslationRequest): Promise<TranslationOutcome> {
    if (baseLanguage(request.source) === baseLanguage(request.target)) return { status: "unavailable" };
    const cacheKey = `${request.kind}|${request.source}|${request.target}|${request.text}|${request.form ?? ""}`;
    const cached = this.cache.get(cacheKey);
    if (cached?.status === "ok") return cached;

    let lastError: string | null = null;
    let anyAvailable = false;
    // A result in another language (English definitions) is kept only until a
    // later provider answers in the requested language.
    let fallback: TranslationResult | null = null;
    const target = baseLanguage(request.target);
    for (const provider of this.providers) {
      if (!provider.supports(request) || !(await provider.isAvailable(request))) continue;
      anyAvailable = true;
      try {
        const result = await provider.translate(request);
        if (result.language && baseLanguage(result.language) !== target) {
          fallback ??= result;
          continue;
        }
        const outcome: TranslationOutcome = { status: "ok", result };
        this.cache.set(cacheKey, outcome);
        return outcome;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }
    if (fallback) {
      const outcome: TranslationOutcome = { status: "ok", result: fallback };
      this.cache.set(cacheKey, outcome);
      return outcome;
    }
    if (!anyAvailable) return { status: "unavailable" };
    return { status: "error", message: lastError ?? "UNKNOWN" };
  }
}

export function createDefaultTranslationService(onlineEnabled: () => boolean) {
  return new TranslationService([new DictionaryPackProvider(), new OfflineDictionaryProvider(), new OnlineTranslationProvider(onlineEnabled)]);
}
