export type BookFileType =
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

export type LibraryBookFileType = BookFileType;
export type ReadingDocumentFileType = BookFileType;
export type BookFormat = BookFileType;

export interface DocumentRecord {
  id: number;
  title: string;
  filePath: string;
  fileHash: string;
  fileName: string | null;
  folderPath: string | null;
  fileMtime: number | null;
  currentPage: number;
  currentZoom: number | null;
  currentScroll: number | null;
  annotations: string | null;
  thumbnailPath: string | null;
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
  language: string | null;
  identifier: string | null;
  asin: string | null;
  subject: string | null;
  series: string | null;
  seriesIndex: string | null;
  authorSort: string | null;
  titleSort: string | null;
  fileSize: number;
  processingStatus: "pending" | "processing" | "completed" | "failed";
  bookId: string | null;
  fileType: BookFileType;
  importedAt: string | null;
  updatedAt: string | null;
}

export interface BookWithThumbnail
  extends Omit<
    DocumentRecord,
    | "fileName"
    | "folderPath"
    | "fileMtime"
    | "language"
    | "identifier"
    | "asin"
    | "subject"
    | "series"
    | "seriesIndex"
    | "authorSort"
    | "titleSort"
    | "bookId"
    | "fileType"
    | "importedAt"
    | "updatedAt"
  > {
  fileName?: string | null;
  folderPath?: string | null;
  fileMtime?: number | null;
  language?: string | null;
  identifier?: string | null;
  asin?: string | null;
  subject?: string | null;
  series?: string | null;
  seriesIndex?: string | null;
  authorSort?: string | null;
  titleSort?: string | null;
  bookId?: string | null;
  fileType?: BookFileType;
  importedAt?: string | null;
  updatedAt?: string | null;
  thumbnail?: string;
  mergedBooks?: BookWithThumbnail[];
}

export type LibrarySection = "all" | "synced" | "unsynced" | "usb";
export type LibrarySortOption =
  | "title"
  | "recent"
  | "pages"
  | "size"
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
  fileType?: string;
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
  hasChildren?: boolean;
  isLoaded?: boolean;
  stats?: FolderStats;
}

export interface FolderStats {
  bookCount: number;
  totalSizeMB: number;
  lastModified: string | null;
  formatBreakdown: Record<string, number>;
}

export interface FolderChangedPayload {
  event: "add" | "addDir" | "change" | "unlink" | "unlinkDir" | "manual";
  path?: string;
  rootPath?: string;
  changedAt: string;
}

export interface WatchFolderInfo {
  id: number;
  path: string;
  label: string | null;
  type: "watch" | "source";
  createdAt: string;
}

export interface SourceFolderInfo extends WatchFolderInfo {
  type: "source";
}

export interface LibraryRootInfo {
  id: number | null;
  type: "library" | "source";
  label: string;
  path: string;
}
