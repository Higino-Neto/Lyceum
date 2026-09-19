import type { DocumentRecord } from "../../types/LibraryTypes";

export interface DocumentMetadataPatch {
  title?: string;
  author?: string;
  description?: string;
  isbn?: string;
  publisher?: string;
  publishDate?: string;
  language?: string;
  identifier?: string;
  asin?: string;
  subject?: string;
  series?: string;
  seriesIndex?: string;
  authorSort?: string;
  titleSort?: string;
}

export interface DocumentMetadataRepository {
  toggleFavorite(fileHash: string): boolean;
  updateRating(fileHash: string, rating: number): void;
  updateNotes(fileHash: string, notes: string): void;
  updateMetadata(fileHash: string, patch: DocumentMetadataPatch): void;
  updateTitle(fileHash: string, title: string): void;
  updateAuthor(fileHash: string, author: string | null): void;
  getFavorites(): DocumentRecord[];
}
