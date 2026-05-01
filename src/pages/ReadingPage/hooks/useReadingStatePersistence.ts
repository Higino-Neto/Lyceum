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

const LOCAL_READING_STATE_PREFIX = "lyceum-reading-state:";

interface LocalReadingStateRecord {
  savedAt: number;
  state: PersistedReadingState;
}

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

function getLocalStorageKey(fileHash: string) {
  return `${LOCAL_READING_STATE_PREFIX}${fileHash}`;
}

function readLocalReadingState(fileHash: string): LocalReadingStateRecord | null {
  if (!fileHash) return null;

  try {
    const raw = localStorage.getItem(getLocalStorageKey(fileHash));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<LocalReadingStateRecord> | null;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return {
      savedAt: normalizeNumber(parsed.savedAt, 0),
      state: normalizeReadingState(parsed.state),
    };
  } catch {
    return null;
  }
}

function writeLocalReadingState(fileHash: string, state: PersistedReadingState) {
  if (!fileHash) return;

  try {
    const record: LocalReadingStateRecord = {
      savedAt: Date.now(),
      state,
    };
    localStorage.setItem(getLocalStorageKey(fileHash), JSON.stringify(record));
  } catch {
    // Local storage is only a synchronous safety net; the database save still runs.
  }
}

function getAnnotationPositionScore(annotations: string) {
  if (!annotations || annotations === DEFAULT_READING_STATE.annotations) {
    return 0;
  }

  try {
    const parsed = JSON.parse(annotations) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.length > 0 ? 1 : 0;
    }

    if (!parsed || typeof parsed !== "object") {
      return 1;
    }

    const location = parsed as {
      cfi?: unknown;
      href?: unknown;
      percentage?: unknown;
      location?: unknown;
      scrollTop?: unknown;
      sectionScrollTop?: unknown;
    };

    return Math.max(
      typeof location.percentage === "number" ? location.percentage * 10000 : 0,
      typeof location.location === "number" ? location.location + 1 : 0,
      typeof location.scrollTop === "number" ? location.scrollTop / 100 : 0,
      typeof location.sectionScrollTop === "number" ? location.sectionScrollTop / 100 : 0,
      typeof location.cfi === "string" || typeof location.href === "string" ? 1 : 0,
    );
  } catch {
    return 1;
  }
}

function getReadingPositionScore(state: PersistedReadingState) {
  return Math.max(
    state.currentPage - DEFAULT_READING_STATE.currentPage,
    state.currentScroll / 100,
    Math.abs(state.currentZoom - DEFAULT_READING_STATE.currentZoom) >= 0.01 ? 1 : 0,
    getAnnotationPositionScore(state.annotations),
  );
}

function hasUsefulReadingPosition(state: PersistedReadingState) {
  if (
    state.currentPage > DEFAULT_READING_STATE.currentPage ||
    state.currentScroll > DEFAULT_READING_STATE.currentScroll ||
    Math.abs(state.currentZoom - DEFAULT_READING_STATE.currentZoom) >= 0.01
  ) {
    return true;
  }

  if (!state.annotations || state.annotations === DEFAULT_READING_STATE.annotations) {
    return false;
  }

  return getAnnotationPositionScore(state.annotations) > 0;
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

    const localBackup = readLocalReadingState(fileHash);
    let saved: Awaited<ReturnType<typeof window.api.getReadingState>> | null = null;

    try {
      saved = await window.api.getReadingState(fileHash);
    } catch (error) {
      console.error("Failed to load reading state from database:", error);
    }

    const databaseState = normalizeReadingState(
      saved
        ? {
            currentPage: saved.currentPage,
            currentZoom: saved.currentZoom ?? undefined,
            currentScroll: saved.currentScroll ?? undefined,
            annotations: saved.annotations ?? undefined,
          }
        : undefined,
    );
    const localScore = localBackup ? getReadingPositionScore(localBackup.state) : 0;
    const databaseScore = getReadingPositionScore(databaseState);
    const normalized =
      localBackup &&
      (localScore >= databaseScore || !hasUsefulReadingPosition(databaseState))
        ? localBackup.state
        : databaseState;

    loadedStateRef.current = normalized;
    lastSavedStateRef.current = normalized;
    pendingStateRef.current = null;

    return normalized;
  }, [fileHash]);

  const saveNow = useCallback(
    async (partialState?: Partial<PersistedReadingState>) => {
      if (!fileHash) return;

      const pendingState = pendingStateRef.current;
      clearScheduledSave();

      if (!partialState && !pendingState) {
        return;
      }

      const baseState =
        lastSavedStateRef.current ||
        loadedStateRef.current ||
        DEFAULT_READING_STATE;
      const nextState = normalizeReadingState({
        ...baseState,
        ...pendingState,
        ...partialState,
      });

      pendingStateRef.current = null;

      if (!hasMeaningfulChange(lastSavedStateRef.current, nextState)) {
        return;
      }

      writeLocalReadingState(fileHash, nextState);

      try {
        await window.api.saveReadingState({
          fileHash,
          state: nextState,
        });
      } catch (error) {
        console.error("Failed to save reading state to database:", error);
      }

      lastSavedStateRef.current = nextState;
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
      writeLocalReadingState(fileHash, nextState);

      if (!hasMeaningfulChange(lastSavedStateRef.current, nextState)) {
        clearScheduledSave();
        pendingStateRef.current = null;
        return;
      }

      clearScheduledSave();
      saveTimeoutRef.current = setTimeout(() => {
        void saveNow(pendingStateRef.current ?? undefined);
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
