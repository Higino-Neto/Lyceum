import { useState, useEffect } from "react";
import toast from "react-hot-toast";

export interface DictionaryInfo {
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

export interface LookupResult {
  word: string;
  lemma: string;
  content: string;
  source: "exact" | "normalized" | "lemma" | "fallback";
  found: boolean;
}

const DICTIONARY_STORAGE_KEY = "lyceum-dictionary:selected";
const DEFAULT_DICT = "eng-por";

function getSelectedDictId(): string {
  try {
    return localStorage.getItem(DICTIONARY_STORAGE_KEY) || DEFAULT_DICT;
  } catch {
    return DEFAULT_DICT;
  }
}

function setSelectedDictId(dictId: string): void {
  try {
    localStorage.setItem(DICTIONARY_STORAGE_KEY, dictId);
  } catch {}
}

export function useDictionary() {
  const [dictionaries, setDictionaries] = useState<DictionaryInfo[]>([]);
  const [selectedDict, setSelectedDict] = useState<string>(getSelectedDictId());
  const [isLoaded, setIsLoaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});

  const loadDictionaries = async () => {
    const api = window.api as Record<string, any> | undefined;
    if (!api?.dictionaryGetIndex) return;
    try {
      const dicts = await api.dictionaryGetIndex();
      setDictionaries(dicts);
    } catch (err) {
      console.error("[Dictionary] Load error:", err);
    }
  };

  const refreshIndex = async () => {
    const api = window.api as Record<string, any> | undefined;
    if (!api?.dictionaryFetchIndex) return;
    try {
      const dicts = await api.dictionaryFetchIndex();
      setDictionaries(dicts);
    } catch (err) {
      console.error("[Dictionary] Refresh error:", err);
    }
  };

  const selectDictionary = (dictId: string) => {
    setSelectedDict(dictId);
    setSelectedDictId(dictId);
  };

  const downloadDictionary = async (dictId: string) => {
    const api = window.api as Record<string, any> | undefined;
    if (!api?.dictionaryDownload) return false;
    setIsDownloading(true);
    setDownloadProgress((prev) => ({ ...prev, [dictId]: 0 }));
    try {
      const result = await api.dictionaryDownload(dictId);
      if (!result.success) {
        toast.error(result.error || "Erro ao baixar dicionário");
        return false;
      }
      await loadDictionaries();
      return true;
    } catch (err) {
      console.error("[Dictionary] Download error:", err);
      return false;
    } finally {
      setIsDownloading(false);
      setDownloadProgress((prev) => ({ ...prev, [dictId]: 100 }));
    }
  };

  const deleteDictionary = async (dictId: string) => {
    const api = window.api as Record<string, any> | undefined;
    if (!api?.dictionaryDelete) return false;
    try {
      const result = await api.dictionaryDelete(dictId);
      if (!result.success) {
        toast.error("Erro ao remover dicionário");
        return false;
      }
      await loadDictionaries();
      return true;
    } catch (err) {
      console.error("[Dictionary] Delete error:", err);
      return false;
    }
  };

  const lookup = async (word: string, dictId?: string): Promise<LookupResult | null> => {
    const api = window.api as Record<string, any> | undefined;
    if (!api?.dictionaryLookup) return null;
    try {
      const result = await api.dictionaryLookup(word, dictId || selectedDict);
      return result;
    } catch (err) {
      console.error("[Dictionary] Lookup error:", err);
      return null;
    }
  };

  const getDictionaryInfo = (dictId: string): DictionaryInfo | undefined => {
    return dictionaries.find((d) => d.id === dictId);
  };

  useEffect(() => {
    loadDictionaries().finally(() => setIsLoaded(true));
  }, []);

  useEffect(() => {
    const api = window.api as Record<string, any> | undefined;
    if (!api?.onDictionaryDownloadProgress) return;
    const unsubscribe = api.onDictionaryDownloadProgress(({ dictId, progress }) => {
      setDownloadProgress((prev) => ({ ...prev, [dictId]: progress }));
    });
    return unsubscribe;
  }, []);

  return {
    dictionaries,
    selectedDict,
    isLoaded,
    isDownloading,
    downloadProgress,
    selectDictionary,
    downloadDictionary,
    deleteDictionary,
    lookup,
    getDictionaryInfo,
    refreshIndex,
  };
}