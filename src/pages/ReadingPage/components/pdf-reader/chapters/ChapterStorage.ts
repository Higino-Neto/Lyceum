export interface ChapterProgressState {
  read: Record<string, boolean>;
  expanded: Record<string, boolean>;
}

const STORAGE_PREFIX = "lyceum:pdf-chapters:";

export function getChapterStorageKey(fileHash: string): string {
  return `${STORAGE_PREFIX}${fileHash}`;
}

export function loadChapterState(fileHash: string): ChapterProgressState {
  try {
    const raw = localStorage.getItem(getChapterStorageKey(fileHash));
    if (!raw) {
      return { read: {}, expanded: {} };
    }
    const parsed = JSON.parse(raw) as Partial<ChapterProgressState>;
    return {
      read: parsed.read && typeof parsed.read === "object" ? parsed.read : {},
      expanded:
        parsed.expanded && typeof parsed.expanded === "object" ? parsed.expanded : {},
    };
  } catch {
    return { read: {}, expanded: {} };
  }
}

export function saveChapterState(fileHash: string, state: ChapterProgressState): void {
  try {
    localStorage.setItem(getChapterStorageKey(fileHash), JSON.stringify(state));
  } catch {
    // Ignore quota / serialization errors; persistence is best-effort.
  }
}
