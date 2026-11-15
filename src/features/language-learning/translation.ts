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
  if (typeof window === "undefined") return null;
  return (window as unknown as { api?: DictionaryBridge }).api ?? null;
}

/** Extracts glosses from the HTML of an offline dictionary entry. */
export function parseDictionaryHtml(html: string): string[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll('font[color="gray"]').forEach((node) => node.remove());
  const glosses: string[] = [];
  const nodes = doc.querySelectorAll("li, div");
  const sources = nodes.length > 0 ? Array.from(nodes) : [doc.body];
  for (const node of sources) {
    if (node.querySelector("li, div")) continue;
    for (const part of (node.textContent ?? "").split(/[,;]/)) {
      const value = part.replace(/\s+/g, " ").trim();
      if (value && value.length < 80) glosses.push(value);
    }
  }
  return Array.from(new Set(glosses));
}

/** Offline bilingual dictionaries downloaded in Lyceum settings. */
export class OfflineDictionaryProvider implements TranslationProvider {
  readonly id = "offline-dictionary";
  private index: DictionaryInfo[] | null = null;

  supports(request: TranslationRequest) {
    return request.kind === "word";
  }

  refresh() {
    this.index = null;
  }

  /** Exact pair first; otherwise a dictionary from the source language into English. */
  private async findDictionary(source: string, target: string) {
    const bridge = dictionaryBridge();
    if (!bridge?.dictionaryGetIndex) return null;
    if (!this.index) {
      try {
        const raw = await bridge.dictionaryGetIndex();
        this.index = Array.isArray(raw) ? (raw as DictionaryInfo[]) : [];
      } catch {
        this.index = [];
      }
    }
    return this.index.find((d) => d.isDownloaded && d.sourceLang === source && d.targetLang === target)
      ?? this.index.find((d) => d.isDownloaded && d.sourceLang === source && d.targetLang === "en")
      ?? null;
  }

  async isAvailable(request: TranslationRequest) {
    return Boolean(await this.findDictionary(request.source, request.target));
  }

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    const dictionary = await this.findDictionary(request.source, request.target);
    const bridge = dictionaryBridge();
    if (!dictionary || !bridge?.dictionaryLookup) throw new Error("UNAVAILABLE");
    const result = (await bridge.dictionaryLookup(request.text, dictionary.id)) as DictionaryLookup | null;
    if (!result?.found || !result.content) throw new Error("NOT_FOUND");
    const glosses = parseDictionaryHtml(result.content);
    if (glosses.length === 0) throw new Error("NOT_FOUND");
    return {
      text: glosses.slice(0, 3).join(", "),
      alternatives: glosses.slice(3, 12),
      providerId: this.id,
      ...(dictionary.targetLang !== request.target ? { language: dictionary.targetLang } : {}),
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
    const bridge = (typeof window === "undefined" ? undefined : (window as unknown as { api?: OnlineBridge }).api);
    return this.enabled() && typeof bridge?.languageLearningTranslateOnline === "function";
  }

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    const bridge = (window as unknown as { api?: OnlineBridge }).api;
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
    if (request.source === request.target) return { status: "unavailable" };
    const cacheKey = `${request.kind}|${request.source}|${request.target}|${request.text}`;
    const cached = this.cache.get(cacheKey);
    if (cached?.status === "ok") return cached;

    let lastError: string | null = null;
    let anyAvailable = false;
    for (const provider of this.providers) {
      if (!provider.supports(request) || !(await provider.isAvailable(request))) continue;
      anyAvailable = true;
      try {
        const outcome: TranslationOutcome = { status: "ok", result: await provider.translate(request) };
        this.cache.set(cacheKey, outcome);
        return outcome;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }
    if (!anyAvailable) return { status: "unavailable" };
    return { status: "error", message: lastError ?? "UNKNOWN" };
  }
}

export function createDefaultTranslationService(onlineEnabled: () => boolean) {
  return new TranslationService([new OfflineDictionaryProvider(), new OnlineTranslationProvider(onlineEnabled)]);
}
