import { lemmatize, normalizeWord } from "./lemmatizer";
import { getDictionaryStorage } from "./dictionary-storage";

export interface LookupResult {
  word: string;
  lemma: string;
  content: string;
  source: "exact" | "normalized" | "lemma" | "fallback";
  found: boolean;
}

export class LookupEngine {
  private dictId: string;

  constructor(dictId: string) {
    this.dictId = dictId;
  }

  lookup(inputWord: string): LookupResult {
    const original = inputWord;
    const normalized = normalizeWord(original);
    
    if (!normalized) {
      return {
        word: original,
        lemma: normalized,
        content: "",
        source: "fallback",
        found: false,
      };
    }

    const storage = getDictionaryStorage(this.dictId);
    
    let result = this.tryLookup(storage, normalized, "exact");
    if (result.found) return result;

    if (normalized !== original.toLowerCase()) {
      result = this.tryLookup(storage, original.toLowerCase(), "exact");
      if (result.found) return result;
    }

    const lemma = lemmatize(normalized);
    if (lemma !== normalized) {
      result = this.tryLookup(storage, lemma, "lemma");
      if (result.found) return { ...result, lemma };
    }

    return {
      word: normalized,
      lemma: lemma || normalized,
      content: "",
      source: "fallback",
      found: false,
    };
  }

  private tryLookup(storage: ReturnType<typeof getDictionaryStorage>, word: string, source: LookupResult["source"]): LookupResult {
    try {
      const entry = storage.lookup(word);
      if (entry) {
        return {
          word,
          lemma: word,
          content: entry.content,
          source,
          found: true,
        };
      }
    } catch (error) {
      console.error("[LookupEngine] Lookup error:", error);
    }

    return {
      word,
      lemma: word,
      content: "",
      source,
      found: false,
    };
  }
}

const engineCache = new Map<string, LookupEngine>();

export function getLookupEngine(dictId: string): LookupEngine {
  let engine = engineCache.get(dictId);
  if (!engine) {
    engine = new LookupEngine(dictId);
    engineCache.set(dictId, engine);
  }
  return engine;
}

export function closeAllEngines(): void {
  for (const engine of engineCache.values()) {
    engineCache.delete(engineCache.keys().next().value);
  }
  engineCache.clear();
}

export async function quickLookup(
  word: string,
  dictId: string = "eng-por"
): Promise<LookupResult> {
  const engine = getLookupEngine(dictId);
  return engine.lookup(word);
}