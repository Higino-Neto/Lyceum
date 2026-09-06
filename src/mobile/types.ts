export type MobileTab =
  | "dashboard"
  | "readings"
  | "library"
  | "reader"
  | "leaderboard"
  | "profile";
export type MobileFileType = "pdf" | "epub" | "txt";
export type MobileLibraryScope = "all" | "managed" | "source";
export type MobileLibrarySort =
  | "title_asc"
  | "title_desc"
  | "recent_desc"
  | "imported_desc"
  | "progress_desc"
  | "size_desc"
  | "status"
  | "series";

export type ReadingStatus = "want" | "reading" | "finished" | "abandoned";
export interface MobileCollection { id: string; name: string; bookIds?: string[]; rule?: import("./libraryModel").MobileLibraryQuery; updatedAt: string }

export interface MobileBook {
  readingStatus?: ReadingStatus;
  tags?: string[];
  seriesName?: string;
  seriesIndex?: number;
  language?: string;
  contentHash?: string;
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
  textOffset?: number;
  currentZoom?: number;
  pdfRotation?: number;
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

export interface MobileLibraryState {
  schemaVersion: number;
  books: MobileBook[];
  folders: MobileLibraryFolder[];
  sourceFolders: MobileSourceFolder[];
  categories: string[];
  collections?: MobileCollection[];
  selectedBookId?: string;
  selectedFolderId?: string;
}
