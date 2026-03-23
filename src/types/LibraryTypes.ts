export interface BookWithThumbnail {
  id: number;
  title: string;
  filePath: string;
  fileHash: string;
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
}