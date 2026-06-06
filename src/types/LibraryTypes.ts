export type LibraryBookFileType =
  | "pdf"
  | "epub"
  | "docx"
  | "html"
  | "cbz"
  | "mobi"
  | "azw"
  | "azw3"
  | "azw4"
  | "kfx"
  | "prc"
  | "txt"
  | "lyceum";

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
  language?: string | null;
  identifier?: string | null;
  asin?: string | null;
  subject?: string | null;
  series?: string | null;
  seriesIndex?: string | null;
  authorSort?: string | null;
  titleSort?: string | null;
  fileSize: number;
  processingStatus: "pending" | "processing" | "completed" | "failed";
  bookId?: string | null;
  fileType?: LibraryBookFileType;
  importedAt?: string | null;
  updatedAt?: string | null;
  mergedBooks?: BookWithThumbnail[];
}

export type LibrarySection = "all" | "synced" | "unsynced" | "usb";
export type LibrarySortOption =
  | "title_asc"
  | "title_desc"
  | "recent_desc"
  | "recent_asc"
  | "pages_desc"
  | "pages_asc"
  | "size_desc"
  | "size_asc";
export type LibraryFileTypeFilter = "all" | LibraryBookFileType;

export interface LibraryListQuery {
  section?: LibrarySection;
  search?: string;
  folderPath?: string | null;
  includeSubfolders?: boolean;
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

export interface WatchFolderInfo {
  id: number;
  path: string;
  label: string | null;
  type: "watch" | "source";
  createdAt: string;
}

export interface LibraryRootInfo {
  id: number | null;
  type: "library" | "source";
  label: string;
  path: string;
}
