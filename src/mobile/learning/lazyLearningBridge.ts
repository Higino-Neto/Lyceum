import type { LearningBridge } from "../../platform";

/** Keeps the learning runtime (repository, IndexedDB, dictionaries) out of the startup bundle. */
const runtime = () => import("./learningRuntime").then((module) => module.mobileLearningBridge);

export const lazyMobileLearningBridge: LearningBridge = {
  dictionaryGetIndex: async () => (await runtime()).dictionaryGetIndex(),
  dictionaryLookup: async (word, dictId) => (await runtime()).dictionaryLookup(word, dictId),
  dictionaryDownload: async (id) => (await runtime()).dictionaryDownload(id),
  dictionaryDelete: async (id) => (await runtime()).dictionaryDelete?.(id) ?? false,
  onDictionaryDownloadProgress(callback) {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    void runtime().then((bridge) => {
      if (!cancelled) unsubscribe = bridge.onDictionaryDownloadProgress?.(callback);
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  },
  languageLearningTranslateOnline: async (text, source, target) => {
    const bridge = await runtime();
    return bridge.languageLearningTranslateOnline
      ? bridge.languageLearningTranslateOnline(text, source, target)
      : { success: false, error: "UNAVAILABLE" };
  },
};
