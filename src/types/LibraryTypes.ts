export interface BookWithThumbnail {
  id: number;
  title: string;
  filePath: string;
  fileHash: string;
  fileName?: string | null;
  folderPath?: string | null;
  fileMtime?: number | null;
  currentPage: number;
  currentZoom: number | null;
  currentScroll: number | null;
  annotations: string | null;
  thumbnailPath: string | null;
  thumbnail?: string;
  numPages: number;
  createdAt: string;
  lastOpenedAt: string;
  isSynced: number;
  category: string | null;
  isFavorite: number;
  rating: number;
  notes: string | null;
  author: string | null;
  description: string | null;
  isbn: string | null;
  publisher: string | null;
  publishDate: string | null;
  fileSize: number;
  processingStatus: "pending" | "processing" | "completed" | "failed";
  fileType?: "pdf" | "epub";
  importedAt?: string | null;
  updatedAt?: string | null;
}

export type LibrarySection = "all" | "synced" | "unsynced";
export type LibrarySortOption = "title" | "recent" | "pages" | "size";
export type LibraryFileTypeFilter = "all" | "pdf" | "epub";

export interface LibraryListQuery {
  section?: LibrarySection;
  search?: string;
  folderPath?: string | null;
  fileType?: LibraryFileTypeFilter;
  sort?: LibrarySortOption;
  limit?: number;
  offset?: number;
}

export interface LibraryListResult {
  items: BookWithThumbnail[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface FolderInfo {
  name: string;
  path: string;
  fullPath: string;
  bookCount: number;
  subfolders: FolderInfo[];
}
