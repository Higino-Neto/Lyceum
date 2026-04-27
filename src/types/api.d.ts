interface VocabularyStats {
  hasIndex: boolean;
  totalWords: number;
  uniqueWords: number;
}

interface WordCountResult {
  word: string;
  count: number;
}

interface VocabularyExtractResult {
  success: boolean;
  totalWords?: number;
  uniqueWords?: number;
  error?: string;
}

interface DictionaryInfo {
  id: string;
  name: string;
  sourceLang: string;
  targetLang: string;
  size: number;
  url: string;
  version: string;
  hash: string;
  downloadedAt?: string;
  isDownloaded?: boolean;
}

interface LookupResult {
  word: string;
  lemma: string;
  content: string;
  source: "exact" | "normalized" | "lemma" | "fallback";
  found: boolean;
}

declare global {
  interface Window {
    api: {
      [key: string]: any;
    };
  }
}

export {};