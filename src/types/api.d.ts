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

declare global {
  interface Window {
    api: Window["api"] & {
      extractVocabulary: (fileHash: string) => Promise<VocabularyExtractResult>;
      getVocabularyStats: (fileHash: string) => Promise<VocabularyStats>;
      getWordCount: (fileHash: string, word: string) => Promise<WordCountResult>;
      deleteVocabulary: (fileHash: string) => Promise<{ success: boolean }>;
    };
  }
}

export {};