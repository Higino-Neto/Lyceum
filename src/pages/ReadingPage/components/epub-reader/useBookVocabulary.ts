import { useCallback, useEffect, useMemo, useState } from "react";
import {
  VocabularyEntry,
  VocabularyStats,
  VocabularyStatus,
  PersistedVocabularyState,
  DEFAULT_VOCABULARY_STATE,
  VOCABULARY_STORAGE_PREFIX,
  normalizeVocabularyWord,
  extractUniqueWords,
  cycleVocabularyStatus,
  cycleVocabularyStatusInverse,
  buildVocabularyStorageKey,
} from "./languageLearning";

function loadVocabularyState(fileHash: string): PersistedVocabularyState {
  if (!fileHash) {
    return DEFAULT_VOCABULARY_STATE;
  }

  try {
    const stored = localStorage.getItem(buildVocabularyStorageKey(fileHash));
    if (!stored) {
      return DEFAULT_VOCABULARY_STATE;
    }

    const parsed = JSON.parse(stored) as Partial<PersistedVocabularyState>;
    const entries = parsed.entries && typeof parsed.entries === "object"
      ? parsed.entries
      : {};

    return {
      indexedWordCount: Math.max(0, Number(parsed.indexedWordCount) || 0),
      entries,
    };
  } catch {
    return DEFAULT_VOCABULARY_STATE;
  }
}

function saveVocabularyState(fileHash: string, state: PersistedVocabularyState) {
  if (!fileHash) return;

  try {
    localStorage.setItem(
      buildVocabularyStorageKey(fileHash),
      JSON.stringify(state),
    );
  } catch {
    // ignore storage failures
  }
}

function sortEntries(entries: VocabularyEntry[]) {
  return [...entries].sort((left, right) => {
    if (left.saved !== right.saved) {
      return left.saved ? -1 : 1;
    }

    return right.updatedAt - left.updatedAt;
  });
}

export default function useBookVocabulary(fileHash: string) {
  const [state, setState] = useState<PersistedVocabularyState>(() =>
    loadVocabularyState(fileHash),
  );

  useEffect(() => {
    setState(loadVocabularyState(fileHash));
  }, [fileHash]);

  useEffect(() => {
    saveVocabularyState(fileHash, state);
  }, [fileHash, state]);

  const updateWord = useCallback(
    (
      rawWord: string,
      updater: (current: VocabularyEntry | null) => VocabularyEntry | null,
    ) => {
      const normalizedWord = normalizeVocabularyWord(rawWord);
      if (!normalizedWord) return;

      setState((previous) => {
        const current = previous.entries[normalizedWord] || null;
        const nextEntry = updater(current);

        if (!nextEntry) {
          if (!current) return previous;

          const nextEntries = { ...previous.entries };
          delete nextEntries[normalizedWord];

          return {
            ...previous,
            entries: nextEntries,
          };
        }

        return {
          ...previous,
          entries: {
            ...previous.entries,
            [normalizedWord]: nextEntry,
          },
        };
      });
    },
    [],
  );

  const ensureWord = useCallback(
    (rawWord: string, displayWord?: string) => {
      updateWord(rawWord, (current) => {
        if (current) {
          return {
            ...current,
            displayWord: displayWord || current.displayWord,
            updatedAt: Date.now(),
          };
        }

        return {
          normalizedWord: normalizeVocabularyWord(rawWord),
          displayWord: displayWord || rawWord,
          status: "new",
          saved: false,
          updatedAt: Date.now(),
        };
      });
    },
    [updateWord],
  );

  const setWordStatus = useCallback(
    (rawWord: string, status: VocabularyStatus, displayWord?: string) => {
      updateWord(rawWord, (current) => ({
        normalizedWord: normalizeVocabularyWord(rawWord),
        displayWord: displayWord || current?.displayWord || rawWord,
        status,
        saved: current?.saved ?? false,
        updatedAt: Date.now(),
      }));
    },
    [updateWord],
  );

  const cycleWordStatus = useCallback(
    (rawWord: string, displayWord?: string) => {
      updateWord(rawWord, (current) => {
        const nextStatus = cycleVocabularyStatus(current?.status || "new");
        const saved = current?.saved ?? false;

        if (nextStatus === "new" && !saved) {
          return null;
        }

        return {
          normalizedWord: normalizeVocabularyWord(rawWord),
          displayWord: displayWord || current?.displayWord || rawWord,
          status: nextStatus,
          saved,
          updatedAt: Date.now(),
        };
      });
    },
    [updateWord],
  );

  const cycleWordStatusInverse = useCallback(
    (rawWord: string, displayWord?: string) => {
      updateWord(rawWord, (current) => {
        const nextStatus = cycleVocabularyStatusInverse(current?.status || "new");
        const saved = current?.saved ?? false;

        if (nextStatus === "new" && !saved) {
          return null;
        }

        return {
          normalizedWord: normalizeVocabularyWord(rawWord),
          displayWord: displayWord || current?.displayWord || rawWord,
          status: nextStatus,
          saved,
          updatedAt: Date.now(),
        };
      });
    },
    [updateWord],
  );

  const toggleWordSaved = useCallback(
    (rawWord: string, displayWord?: string) => {
      updateWord(rawWord, (current) => {
        const nextSaved = !(current?.saved ?? false);
        const nextStatus = current?.status || "new";

        if (!nextSaved && nextStatus === "new") {
          return null;
        }

        return {
          normalizedWord: normalizeVocabularyWord(rawWord),
          displayWord: displayWord || current?.displayWord || rawWord,
          status: nextStatus,
          saved: nextSaved,
          updatedAt: Date.now(),
        };
      });
    },
    [updateWord],
  );

  const setIndexedWordCount = useCallback((count: number) => {
    setState((previous) => {
      const normalizedCount = Math.max(0, Math.round(count));
      if (normalizedCount === previous.indexedWordCount) {
        return previous;
      }

      return {
        ...previous,
        indexedWordCount: normalizedCount,
      };
    });
  }, []);

  const trackedEntries = useMemo(
    () =>
      sortEntries(
        Object.values(state.entries).filter(
          (entry) => entry.saved || entry.status !== "new",
        ),
      ),
    [state.entries],
  );

  const stats = useMemo(() => {
    const entries = Object.values(state.entries);
    const knownCount = entries.filter((entry) => entry.status === "known").length;
    const learningCount = entries.filter(
      (entry) => entry.status === "learning",
    ).length;
    const indexedWordCount = state.indexedWordCount;
    const newCount = Math.max(0, indexedWordCount - knownCount - learningCount);
    const progressPercent =
      indexedWordCount > 0 ? Math.round((knownCount / indexedWordCount) * 100) : 0;

    return {
      indexedWordCount,
      knownCount,
      learningCount,
      newCount,
      trackedCount: trackedEntries.length,
      progressPercent,
    };
  }, [state.entries, state.indexedWordCount, trackedEntries.length]);

  return {
    entries: state.entries,
    trackedEntries,
    stats,
    ensureWord,
    setWordStatus,
    cycleWordStatus,
    cycleWordStatusInverse,
    toggleWordSaved,
    setIndexedWordCount,
  };
}
