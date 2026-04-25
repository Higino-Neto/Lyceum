import {
  LanguageCode,
  DictionaryLookupResult,
} from "./languageServices";

const CACHE_PREFIX = "lyceum-dict-cache:";
const FAVORITES_PREFIX = "lyceum-dict-fav:";
const MAX_CACHE_SIZE = 1000;

function getCacheKey(word: string, lang: LanguageCode): string {
  return `${CACHE_PREFIX}${lang}:${word.toLowerCase()}`;
}

function getFavoriteKey(word: string, lang: LanguageCode): string {
  return `${FAVORITES_PREFIX}${lang}:${word.toLowerCase()}`;
}

function getCacheMetaKey(lang: LanguageCode): string {
  return `${CACHE_PREFIX}meta:${lang}`;
}

export async function getCachedWord(
  word: string,
  lang: LanguageCode
): Promise<DictionaryLookupResult | undefined> {
  const key = getCacheKey(word, lang);
  const cached = localStorage.getItem(key);
  if (!cached) return undefined;

  try {
    return JSON.parse(cached) as DictionaryLookupResult;
  } catch {
    return undefined;
  }
}

export async function setCachedWord(
  word: string,
  lang: LanguageCode,
  lookupResult: DictionaryLookupResult
): Promise<void> {
  const key = getCacheKey(word, lang);
  const value = JSON.stringify({
    ...lookupResult,
    lookedUpAt: Date.now(),
  });

  try {
    localStorage.setItem(key, value);

    const metaKey = getCacheMetaKey(lang);
    const existing = localStorage.getItem(metaKey);
    const entries: string[] = existing ? JSON.parse(existing) : [];
    
    if (!entries.includes(key)) {
      entries.push(key);
      if (entries.length > MAX_CACHE_SIZE) {
        const toRemove = entries.shift();
        if (toRemove) localStorage.removeItem(toRemove);
      }
      localStorage.setItem(metaKey, JSON.stringify(entries));
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === "QuotaExceededError") {
      localStorage.clear();
      localStorage.setItem(key, value);
    }
  }
}

export async function saveWord(
  word: string,
  lang: LanguageCode,
  lookupResult: DictionaryLookupResult
): Promise<void> {
  const key = getFavoriteKey(word, lang);
  const value = JSON.stringify(lookupResult);
  localStorage.setItem(key, value);
}

export async function getSavedWords(
  lang?: LanguageCode
): Promise<DictionaryLookupResult[]> {
  const results: DictionaryLookupResult[] = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(FAVORITES_PREFIX)) continue;
    
    if (lang && !key.includes(`:${lang}:`)) continue;
    
    try {
      const item = localStorage.getItem(key);
      if (item) {
        results.push(JSON.parse(item) as DictionaryLookupResult);
      }
    } catch {
      // Skip invalid entries
    }
  }
  
  return results;
}

export async function removeSavedWord(
  word: string,
  lang: LanguageCode
): Promise<void> {
  const key = getFavoriteKey(word, lang);
  localStorage.removeItem(key);
}

export async function isWordSaved(
  word: string,
  lang: LanguageCode
): Promise<boolean> {
  const key = getFavoriteKey(word, lang);
  return localStorage.getItem(key) !== null;
}

export async function getSavedWordsCount(lang?: LanguageCode): Promise<number> {
  let count = 0;
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(FAVORITES_PREFIX)) continue;
    
    if (lang && !key.includes(`:${lang}:`)) continue;
    count++;
  }
  
  return count;
}

export async function clearCache(): Promise<void> {
  const keysToRemove: string[] = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(CACHE_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach((key) => localStorage.removeItem(key));
}

export async function clearAllSavedWords(): Promise<void> {
  const keysToRemove: string[] = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(FAVORITES_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach((key) => localStorage.removeItem(key));
}

export async function getCacheStats(): Promise<{
  cachedCount: number;
  favoritesCount: number;
}> {
  let cachedCount = 0;
  let favoritesCount = 0;
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    
    if (key.startsWith(CACHE_PREFIX)) {
      if (!key.includes("meta:")) cachedCount++;
    } else if (key.startsWith(FAVORITES_PREFIX)) {
      favoritesCount++;
    }
  }
  
  return { cachedCount, favoritesCount };
}