import { sanitizeLookupWord, simplifyEnglishText } from "./languageLearning";

export interface DictionaryDefinition {
  definition: string;
  example?: string;
}

export interface DictionaryLookupResult {
  word: string;
  phonetic?: string;
  audioUrl?: string;
  partOfSpeech?: string;
  definitions: DictionaryDefinition[];
}

export interface TranslationResult {
  translatedText: string;
  provider: "mymemory";
}

const DICTIONARY_API_BASE_URL = "https://api.dictionaryapi.dev/api/v2/entries/en";
const MY_MEMORY_URL = "https://api.mymemory.translated.net/get";
const MAX_TRANSLATION_CHARACTERS = 280;

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
): Promise<DictionaryLookupResult> {
  const lookupWord = sanitizeLookupWord(word);

  if (!lookupWord) {
    throw new Error("Palavra invalida para consulta.");
  }

  const response = await fetch(
    `${DICTIONARY_API_BASE_URL}/${encodeURIComponent(lookupWord)}`,
    { signal },
  );

  ensureOkResponse(response, "Nao foi possivel buscar a definicao desta palavra.");

  const payload = (await response.json()) as Array<{
    word?: string;
    phonetic?: string;
    phonetics?: Array<{ text?: string; audio?: string }>;
    meanings?: Array<{
      partOfSpeech?: string;
      definitions?: Array<{ definition?: string; example?: string }>;
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
  const meaning = entry.meanings?.find((item) => item.definitions?.length);
  const definitions =
    meaning?.definitions
      ?.map((item) => ({
        definition: cleanText(item.definition || ""),
        example: item.example ? cleanText(item.example) : undefined,
      }))
      .filter((item) => item.definition)
      .slice(0, 3) || [];

  if (!definitions.length) {
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
    partOfSpeech: meaning?.partOfSpeech,
    definitions,
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
) {
  const query = new URLSearchParams({
    q: text,
    langpair: `${sourceLanguage}|${targetLanguage}`,
  });

  const response = await fetch(`${MY_MEMORY_URL}?${query.toString()}`, {
    signal,
  });

  ensureOkResponse(response, "Nao foi possivel traduzir este trecho agora.");

  const payload = (await response.json()) as {
    responseData?: {
      translatedText?: string;
    };
  };

  const translatedText = cleanText(payload.responseData?.translatedText || "");

  if (!translatedText) {
    throw new Error("A traducao retornou vazia.");
  }

  return translatedText;
}

export async function translateText(
  text: string,
  sourceLanguage = "en",
  targetLanguage = "pt-BR",
  signal?: AbortSignal,
): Promise<TranslationResult> {
  const cleaned = cleanText(text);
  if (!cleaned) {
    throw new Error("Nao ha texto para traduzir.");
  }

  ensureTextLength(cleaned);

  const translatedText = await requestMyMemoryTranslation(
    cleaned,
    sourceLanguage,
    targetLanguage,
    signal,
  );

  return {
    translatedText,
    provider: "mymemory",
  };
}

export async function simplifySelectedText(
  text: string,
  signal?: AbortSignal,
) {
  const cleaned = cleanText(text);
  if (!cleaned) {
    throw new Error("Nao ha texto para simplificar.");
  }

  const heuristicVersion = simplifyEnglishText(cleaned);

  if (heuristicVersion && heuristicVersion !== cleaned) {
    return heuristicVersion;
  }

  const translated = await requestMyMemoryTranslation(
    cleaned,
    "en",
    "pt-BR",
    signal,
  );

  return requestMyMemoryTranslation(translated, "pt-BR", "en", signal);
}
