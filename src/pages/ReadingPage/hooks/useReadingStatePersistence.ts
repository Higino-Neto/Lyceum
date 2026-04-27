import { useCallback, useEffect, useRef } from "react";

export interface PersistedReadingState {
  currentPage: number;
  currentZoom: number;
  currentScroll: number;
  annotations: string;
}

const DEFAULT_READING_STATE: PersistedReadingState = {
  currentPage: 1,
  currentZoom: 1,
  currentScroll: 0,
  annotations: "[]",
};

function normalizeNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeReadingState(
  state?: Partial<PersistedReadingState> | null,
): PersistedReadingState {
  return {
    currentPage: Math.max(
      1,
      Math.round(normalizeNumber(state?.currentPage, DEFAULT_READING_STATE.currentPage)),
    ),
    currentZoom: Math.max(
      0.1,
      normalizeNumber(state?.currentZoom, DEFAULT_READING_STATE.currentZoom),
    ),
    currentScroll: Math.max(
      0,
      normalizeNumber(state?.currentScroll, DEFAULT_READING_STATE.currentScroll),
    ),
    annotations:
      typeof state?.annotations === "string"
        ? state.annotations
        : DEFAULT_READING_STATE.annotations,
  };
}

function hasMeaningfulChange(
  previous: PersistedReadingState | null,
  next: PersistedReadingState,
) {
  if (!previous) return true;

  return (
    previous.currentPage !== next.currentPage ||
    Math.abs(previous.currentZoom - next.currentZoom) >= 0.01 ||
    Math.abs(previous.currentScroll - next.currentScroll) >= 8 ||
    previous.annotations !== next.annotations
  );
}

export default function useReadingStatePersistence(
  fileHash: string,
  debounceMs = 500,
) {
  const loadedStateRef = useRef<PersistedReadingState>(DEFAULT_READING_STATE);
  const lastSavedStateRef = useRef<PersistedReadingState>(DEFAULT_READING_STATE);
  const pendingStateRef = useRef<PersistedReadingState | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearScheduledSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
  }, []);

  const loadState = useCallback(async () => {
    loadedStateRef.current = DEFAULT_READING_STATE;
    lastSavedStateRef.current = DEFAULT_READING_STATE;
    pendingStateRef.current = null;
    clearScheduledSave();

    if (!fileHash) {
      return DEFAULT_READING_STATE;
    }

    const saved = await window.api.getReadingState(fileHash);
    const normalized = normalizeReadingState(
      saved
        ? {
            currentPage: saved.currentPage,
            currentZoom: saved.currentZoom ?? undefined,
            currentScroll: saved.currentScroll ?? undefined,
            annotations: saved.annotations ?? undefined,
          }
        : undefined,
    );

    loadedStateRef.current = normalized;
    lastSavedStateRef.current = normalized;
    pendingStateRef.current = null;

    return normalized;
  }, [fileHash]);

  const saveNow = useCallback(
    async (partialState?: Partial<PersistedReadingState>) => {
      if (!fileHash) return;

      clearScheduledSave();

      if (!partialState || !partialState.annotations) {
        return;
      }

      await window.api.saveReadingState({
        fileHash,
        state: partialState,
      });
    },
    [clearScheduledSave, fileHash],
  );

  const scheduleSave = useCallback(
    (partialState: Partial<PersistedReadingState>) => {
      if (!fileHash) return;

      const baseState =
        pendingStateRef.current ||
        lastSavedStateRef.current ||
        loadedStateRef.current ||
        DEFAULT_READING_STATE;
      const nextState = normalizeReadingState({
        ...baseState,
        ...partialState,
      });

      pendingStateRef.current = nextState;

      if (!hasMeaningfulChange(lastSavedStateRef.current, nextState)) {
        clearScheduledSave();
        pendingStateRef.current = null;
        return;
      }

      clearScheduledSave();
      saveTimeoutRef.current = setTimeout(() => {
        void saveNow();
      }, debounceMs);
    },
    [clearScheduledSave, debounceMs, fileHash, saveNow],
  );

  useEffect(() => {
    return () => {
      const pendingState = pendingStateRef.current;
      clearScheduledSave();
      if (pendingState) {
        void saveNow(pendingState);
      }
    };
  }, [clearScheduledSave, saveNow]);

  return {
    loadState,
    saveNow,
    scheduleSave,
    getLoadedState: () => loadedStateRef.current,
    getLastSavedState: () => lastSavedStateRef.current,
  };
}
