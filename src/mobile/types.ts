export type MobileTab = "library" | "reader" | "dashboard" | "habits" | "profile";
export type MobileFileType = "pdf" | "epub" | "txt" | "html" | "other";

export interface MobileBook {
  id: string;
  title: string;
  author?: string;
  fileName: string;
  fileType: MobileFileType;
  dataUrl?: string;
  storagePath?: string;
  mimeType?: string;
  fileSize?: number;
  thumbnailKey?: string;
  thumbnailPath?: string;
  thumbnailUrl?: string;
  thumbnailSource?: "extracted" | "generated";
  thumbnailExtractAttempted?: boolean;
  importedAt: string;
  lastOpenedAt?: string;
  currentPage: number;
  totalPages: number;
  minutesRead: number;
  category: string;
  isFavorite: boolean;
  notes?: string;
}

export interface MobileReadingSession {
  id: string;
  bookId: string;
  title: string;
  date: string;
  minutes: number;
  pages: number;
}

export interface MobileHabit {
  id: string;
  name: string;
  targetDays: number[];
  completions: Record<string, boolean>;
}

export interface MobileLibraryState {
  books: MobileBook[];
  sessions: MobileReadingSession[];
  habits: MobileHabit[];
  selectedBookId?: string;
}

export interface MobileStats {
  books: number;
  pagesRead: number;
  minutesRead: number;
  currentStreak: number;
  finishedHabitsToday: number;
}
