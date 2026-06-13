export type MobileTab = "library" | "reader" | "recent" | "favorites" | "profile";
export type MobileFileType = "pdf" | "epub" | "txt";
export type MobileLibraryScope = "all" | "managed" | "source";
export type MobileLibrarySort =
  | "title_asc"
  | "title_desc"
  | "recent_desc"
  | "imported_desc"
  | "progress_desc"
  | "size_desc";

export interface MobileBook {
  id: string;
  title: string;
  author?: string;
  description?: string;
  isbn?: string;
  publisher?: string;
  publishDate?: string;
  fileName: string;
  fileType: MobileFileType;
  dataUrl?: string;
  storagePath?: string;
  mimeType?: string;
  fileSize?: number;
  folderId?: string;
  sourceFolderId?: string;
  sourceRelativePath?: string;
  thumbnailKey?: string;
  thumbnailPath?: string;
  thumbnailUrl?: string;
  thumbnailSource?: "extracted" | "generated";
  thumbnailExtractAttempted?: boolean;
  importedAt: string;
  updatedAt?: string;
  lastOpenedAt?: string;
  currentPage: number;
  totalPages: number;
  progressPercent?: number;
  epubLocation?: string;
  textScrollPercent?: number;
  currentZoom?: number;
  minutesRead: number;
  category: string;
  isFavorite: boolean;
  rating?: number;
  notes?: string;
}

export interface MobileLibraryFolder {
  id: string;
  name: string;
  parentId?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface MobileSourceFolder {
  id: string;
  name: string;
  createdAt: string;
  lastImportedAt: string;
  lastFileCount: number;
  nativeUri?: string;
  note?: string;
}

export interface MobileReadingSession {
  id: string;
  bookId: string;
  title: string;
  date: string;
  minutes: number;
  pages: number;
  startPage?: number;
  endPage?: number;
  startProgress?: number;
  endProgress?: number;
}

export interface MobileHabit {
  id: string;
  name: string;
  targetDays: number[];
  completions: Record<string, boolean>;
}

export interface MobileLibraryState {
  schemaVersion: number;
  books: MobileBook[];
  folders: MobileLibraryFolder[];
  sourceFolders: MobileSourceFolder[];
  categories: string[];
  sessions: MobileReadingSession[];
  habits: MobileHabit[];
  selectedBookId?: string;
  selectedFolderId?: string;
}

export interface MobileStats {
  books: number;
  pagesRead: number;
  minutesRead: number;
  currentStreak: number;
  finishedHabitsToday: number;
}
