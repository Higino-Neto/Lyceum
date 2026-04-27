import { sanitizeLookupWord, simplifyEnglishText } from "./languageLearning";
import {
  getCachedWord,
  setCachedWord,
  saveWord,
  getSavedWords,
  removeSavedWord,
  isWordSaved,
} from "./offlineDictionary";

export const SUPPORTED_LANGUAGES = [
  { code: "en", name: "Inglês", flag: "🇬🇧" },
  { code: "fr", name: "Francês", flag: "🇫🇷" },
  { code: "es", name: "Espanhol", flag: "🇪🇸" },
  { code: "de", name: "Alemão", flag: "🇩🇪" },
  { code: "it", name: "Italiano", flag: "🇮🇹" },
  { code: "ja", name: "Japonês", flag: "🇯🇵" },
  { code: "ko", name: "Coreano", flag: "🇰🇷" },
  { code: "zh", name: "Chinês", flag: "🇨🇳" },
  { code: "ru", name: "Russo", flag: "🇷🇺" },
  { code: "nl", name: "Holandês", flag: "🇳🇱" },
  { code: "pl", name: "Polonês", flag: "🇵🇱" },
  { code: "pt", name: "Português", flag: "🇧🇷" },
  { code: "la", name: "Latim", flag: "🇻🇦" },
] as const;

export type LanguageCode = typeof SUPPORTED_LANGUAGES[number]["code"];

export type LookupSource = "cache" | "api" | "fallback";

export const DEFAULT_SOURCE_LANGUAGE: LanguageCode = "en";
export const DEFAULT_TARGET_LANGUAGE: LanguageCode = "pt";

export const DICTIONARY_SUPPORTED_LANGUAGES: LanguageCode[] = ["en", "fr", "es", "de", "it", "pt"];

export function isDictionarySupported(lang: LanguageCode): boolean {
  return DICTIONARY_SUPPORTED_LANGUAGES.includes(lang);
}

export interface DictionaryDefinition {
  definition: string;
  example?: string;
  synonyms?: string[];
}

export interface DictionaryLookupResult {
  word: string;
  phonetic?: string;
  audioUrl?: string;
  meanings: Array<{
    partOfSpeech: string;
    definitions: DictionaryDefinition[];
  }>;
  source: LookupSource;
  lookedUpAt?: number;
}

export interface TranslationResult {
  translatedText: string;
  provider: "mymemory" | "local-dictionary";
}

const DICTIONARY_API_BASE_URL = "https://api.dictionaryapi.dev/api/v2/entries";
const MY_MEMORY_URL = "https://api.mymemory.translated.net/get";
const MAX_TRANSLATION_CHARACTERS = 280;

async function getDownloadedDictionaries() {
  try {
    const windowApi = window.api as any;
    if (!windowApi?.dictionaryGetIndex) return [];
    const dicts = await windowApi.dictionaryGetIndex();
    return dicts.filter((d: { isDownloaded?: boolean }) => d.isDownloaded);
  } catch {
    return [];
  }
}

async function findDictionaryForPair(sourceLang: string, targetLang: string) {
  const downloaded = await getDownloadedDictionaries();
  const pair = downloaded.find(
    (d: { sourceLang: string; targetLang: string }) =>
      d.sourceLang === sourceLang && d.targetLang === targetLang
  );
  return pair;
}

async function translateWithLocalDictionary(
  word: string,
  sourceLang: string,
  targetLang: string,
): Promise<{ translations: string[]; phonetic?: string } | null> {
  const dict = await findDictionaryForPair(sourceLang, targetLang);
  if (!dict) {
    console.log(`[Translation] No local dictionary found for ${sourceLang} → ${targetLang}`);
    return null;
  }

  try {
    const windowApi = window.api as any;
    if (!windowApi?.dictionaryLookup) return null;

    console.log(`[Translation] Looking up "${word}" in ${dict.id}...`);
    const result = await windowApi.dictionaryLookup(word, dict.id);
    if (result?.found && result.content) {
      console.log(`[Translation] Using local dictionary (${dict.id}): ${sourceLang} → ${targetLang}`, { word });
      return cleanDictionaryHtml(result.content);
    } else {
      console.log(`[Translation] Word "${word}" not found in local dictionary`);
    }
  } catch (error) {
    console.error("[Translation] Local dictionary error:", error);
  }
  return null;
}

function cleanDictionaryHtml(html: string): { translations: string[]; phonetic?: string } {
  const doc = new DOMParser().parseFromString(html, "text/html");
  
  const translations: string[] = [];
  let phonetic = "";
  
  // Get phonetic from font tags
  const fontElements = doc.querySelectorAll('font[color="gray"]');
  fontElements.forEach(font => {
    const text = font.textContent?.trim();
    if (text && (text.includes("ː") || text.includes("/"))) {
      phonetic = text.replace(/\//g, "").trim();
    }
  });
  
  // Process divs to extract translations
  // Each main div contains: phonetic line (with /br) and translations in ol/li structure
  const mainDivs = doc.querySelectorAll("div");
  
  mainDivs.forEach(div => {
    // Skip divs that contain font (phonetic) elements - they're the header
    if (div.querySelector('font[color="gray"]')) {
      return;
    }
    
    const text = div.textContent?.trim();
    if (!text) return;
    
    // Split by common delimiters and filter
    const parts = text
      .split(/[,;]/)
      .map(s => s.trim())
      .filter(s => s.length > 0 && s.length < 100);
    
    translations.push(...parts);
  });
  
  // Remove duplicates
  const unique = [...new Set(translations)];
  
  return { translations: unique, phonetic: phonetic || undefined };
}

function ensureOkResponse(response: Response, fallbackMessage: string) {
  if (!response.ok) {
    throw new Error(fallbackMessage);
  }
}

function cleanText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

export async function fetchDictionaryEntry(
  word: string,
  signal?: AbortSignal,
  lang: LanguageCode = "en",
): Promise<DictionaryLookupResult> {
  const lookupWord = sanitizeLookupWord(word);

  if (!lookupWord) {
    throw new Error("Palavra invalida para consulta.");
  }

  const response = await fetch(
    `${DICTIONARY_API_BASE_URL}/${lang}/${encodeURIComponent(lookupWord)}`,
    { signal },
  );

  ensureOkResponse(response, "Nao foi possivel buscar a definicao desta palavra.");

  const payload = (await response.json()) as Array<{
    word?: string;
    phonetic?: string;
    phonetics?: Array<{ text?: string; audio?: string }>;
    meanings?: Array<{
      partOfSpeech?: string;
      definitions?: Array<{
        definition?: string;
        example?: string;
        synonyms?: string[];
      }>;
    }>;
  }>;

  const entry = payload?.[0];
  if (!entry) {
    throw new Error("Nenhuma definicao foi encontrada.");
  }

  const phonetic =
    entry.phonetic || entry.phonetics?.find((item) => item.text?.trim())?.text;
  const audioUrl = entry.phonetics
    ?.map((item) => item.audio?.trim())
    .find(Boolean);

  const meanings = entry.meanings
    ?.map((meaning) => ({
      partOfSpeech: meaning.partOfSpeech || "unknown",
      definitions: meaning.definitions
        ?.map((item) => ({
          definition: cleanText(item.definition || ""),
          example: item.example ? cleanText(item.example) : undefined,
          synonyms: item.synonyms || [],
        }))
        .filter((item) => item.definition)
        .slice(0, 5) || [],
    }))
    .filter((meaning) => meaning.definitions.length > 0);

  if (!meanings || meanings.length === 0) {
    throw new Error("Nenhuma definicao foi encontrada.");
  }

  return {
    word: cleanText(entry.word || lookupWord),
    phonetic: phonetic ? cleanText(phonetic) : undefined,
    audioUrl: audioUrl
      ? audioUrl.startsWith("//")
        ? `https:${audioUrl}`
        : audioUrl
      : undefined,
    meanings,
    source: "api",
    lookedUpAt: Date.now(),
  };
}

function ensureTextLength(text: string) {
  if (text.length > MAX_TRANSLATION_CHARACTERS) {
    throw new Error("Selecione um trecho menor para traduzir.");
  }
}

async function requestMyMemoryTranslation(
  text: string,
  sourceLanguage: string,
  targetLanguage: string,
  signal?: AbortSignal,
  fallback = true,
) {
  console.log(`[Translation] Using MyMemory API: ${sourceLanguage} → ${targetLanguage}`, { text: text.substring(0, 50) });
  
  const query = new URLSearchParams({
    q: text,
    langpair: `${sourceLanguage}|${targetLanguage}`,
  });

  const response = await fetch(`${MY_MEMORY_URL}?${query.toString()}`, {
    signal,
  });

  if (!response.ok) {
    if (fallback && sourceLanguage !== "pt" && targetLanguage !== "pt") {
      const intermediate = await requestMyMemoryTranslation(text, sourceLanguage, "pt", signal, false);
      return requestMyMemoryTranslation(intermediate, "pt", targetLanguage, signal, false);
    }
    throw new Error("Não foi possível traduzir este trecho agora.");
  }

  const payload = (await response.json()) as {
    responseData?: {
      translatedText?: string;
    };
  };

  const translatedText = cleanText(payload.responseData?.translatedText || "");

  if (!translatedText) {
    if (fallback && sourceLanguage !== "pt" && targetLanguage !== "pt") {
      const intermediate = await requestMyMemoryTranslation(text, sourceLanguage, "pt", signal, false);
      return requestMyMemoryTranslation(intermediate, "pt", targetLanguage, signal, false);
    }
    throw new Error("A tradução retornou vazia.");
  }

  return translatedText;
}

export async function translateText(
  text: string,
  sourceLanguage: LanguageCode = "en",
  targetLanguage: LanguageCode = "pt",
  signal?: AbortSignal,
): Promise<TranslationResult> {
  const cleaned = cleanText(text);
  if (!cleaned) {
    throw new Error("Nao ha texto para traduzir.");
  }

  ensureTextLength(cleaned);

  // Try local dictionary first for single words
  const isSingleWord = cleaned.split(/\s+/).length === 1;
  let translatedText: string;
  let provider: "mymemory" | "local-dictionary" = "mymemory";

  if (isSingleWord) {
    const localResult = await translateWithLocalDictionary(cleaned, sourceLanguage, targetLanguage);
    if (localResult) {
      translatedText = localResult.translations.join(", ");
      provider = "local-dictionary";
    } else {
      translatedText = await requestMyMemoryTranslation(
        cleaned,
        sourceLanguage,
        targetLanguage,
        signal,
      );
    }
  } else {
    translatedText = await requestMyMemoryTranslation(
      cleaned,
      sourceLanguage,
      targetLanguage,
      signal,
    );
  }

  return {
    translatedText,
    provider,
  };
}

export async function simplifySelectedText(
  text: string,
  signal?: AbortSignal,
  sourceLanguage: LanguageCode = "en",
  targetLanguage: LanguageCode = "pt",
) {
  const cleaned = cleanText(text);
  if (!cleaned) {
    throw new Error("Nao ha texto para simplificar.");
  }

  if (sourceLanguage === "en") {
    const heuristicVersion = simplifyEnglishText(cleaned);
    if (heuristicVersion && heuristicVersion !== cleaned) {
      return heuristicVersion;
    }
  }

  const translated = await requestMyMemoryTranslation(
    cleaned,
    sourceLanguage,
    targetLanguage,
    signal,
  );

  return requestMyMemoryTranslation(translated, targetLanguage, sourceLanguage, signal);
}

export interface LookupOptions {
  useCache?: boolean;
  saveToCache?: boolean;
  saveToFavorites?: boolean;
}

export async function lookupWord(
  word: string,
  lang: LanguageCode = "en",
  signal?: AbortSignal,
  options: LookupOptions = { useCache: true, saveToCache: true },
): Promise<DictionaryLookupResult> {
  const { useCache = true, saveToCache = true, saveToFavorites = false } = options;
  const normalizedWord = sanitizeLookupWord(word);

  if (!normalizedWord) {
    throw new Error("Palavra inválida para consulta.");
  }

  if (useCache) {
    const cached = await getCachedWord(normalizedWord, lang);
    if (cached) {
      return { ...cached, source: "cache" };
    }
  }

  try {
    const result = await fetchDictionaryEntry(normalizedWord, signal, lang);

    if (saveToCache) {
      await setCachedWord(normalizedWord, lang, result);
    }

    if (saveToFavorites) {
      await saveWord(normalizedWord, lang, result);
    }

    return result;
  } catch (apiError) {
    if (useCache) {
      const cached = await getCachedWord(normalizedWord, lang);
      if (cached) {
        return { ...cached, source: "fallback" };
      }
    }

    throw apiError;
  }
}

export async function lookupWithTranslation(
  word: string,
  sourceLang: LanguageCode = "en",
  targetLang: LanguageCode = "pt",
  signal?: AbortSignal,
): Promise<{
  source: DictionaryLookupResult;
  translated: DictionaryLookupResult | null;
}> {
  const normalizedWord = sanitizeLookupWord(word);

  if (!normalizedWord) {
    throw new Error("Palavra inválida para consulta.");
  }

  const source = await lookupWord(normalizedWord, sourceLang, signal, { useCache: true, saveToCache: true });

  if (sourceLang === targetLang) {
    return { source, translated: null };
  }

  // Try to get translation from local dictionary
  const localTranslation = await translateWithLocalDictionary(normalizedWord, sourceLang, targetLang);
  
  if (localTranslation) {
    // Create a simple translated result from local dictionary
    return {
      source,
      translated: {
        word: normalizedWord,
        phonetic: localTranslation.phonetic,
        meanings: [
          {
            partOfSpeech: "dictionary",
            definitions: localTranslation.translations.map(t => ({
              definition: t,
            })),
          },
        ],
        source: "cache",
      },
    };
  }

  try {
    const translatedMeanings = await Promise.all(
      source.meanings.map(async (meaning) => ({
        partOfSpeech: meaning.partOfSpeech,
        definitions: await Promise.all(
          meaning.definitions.map(async (def) => {
            let translatedDef = def.definition;
            let translatedExample = def.example;

            if (def.definition) {
              try {
                const result = await requestMyMemoryTranslation(def.definition, sourceLang, targetLang, signal);
                if (result) {
                  translatedDef = result;
                }
              } catch { }
            }

            if (def.example) {
              try {
                const result = await requestMyMemoryTranslation(def.example, sourceLang, targetLang, signal);
                if (result) {
                  translatedExample = result;
                }
              } catch { }
            }

            return {
              definition: translatedDef,
              example: translatedExample,
              synonyms: def.synonyms || [],
            };
          }),
        ),
      })),
    );

    return {
      source,
      translated: {
        ...source,
        meanings: translatedMeanings,
      },
    };
  } catch {
    return { source, translated: null };
  }
}

export async function toggleFavoriteWord(
  word: string,
  lang: LanguageCode = "en",
): Promise<boolean> {
  const normalizedWord = sanitizeLookupWord(word);
  if (!normalizedWord) return false;

  const saved = await isWordSaved(normalizedWord, lang);
  if (saved) {
    await removeSavedWord(normalizedWord, lang);
    return false;
  }

  const cached = await getCachedWord(normalizedWord, lang);
  if (cached) {
    await saveWord(normalizedWord, lang, cached);
    return true;
  }

  const result = await fetchDictionaryEntry(normalizedWord, undefined, lang);
  await saveWord(normalizedWord, lang, result);
  return true;
}

export async function isFavoriteWord(
  word: string,
  lang: LanguageCode = "en",
): Promise<boolean> {
  const normalizedWord = sanitizeLookupWord(word);
  if (!normalizedWord) return false;
  return isWordSaved(normalizedWord, lang);
}

export async function getFavoriteWords(
  lang?: LanguageCode,
): Promise<DictionaryLookupResult[]> {
  return getSavedWords(lang);
}
