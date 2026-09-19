import type { BookFileType } from "../../types/LibraryTypes";

export interface DocumentFileRepository {
  updatePath(fileHash: string, newPath: string): void;
  updateFileType(fileHash: string, fileType: BookFileType): void;
  updateNumPages(fileHash: string, numPages: number): void;
  updateSyncStatus(fileHash: string, isSynced: boolean, category?: string): void;
  updateThumbnailPath(fileHash: string, thumbnailPath: string): void;
  updateProcessingStatus(fileHash: string, status: "pending" | "processing" | "completed" | "failed"): void;
  updateFileSize(fileHash: string, fileSize: number): void;
  updateIdentity(oldFileHash: string, newFileHash: string, filePath: string, fileSize: number): void;
  remove(fileHash: string): { success: boolean; error?: string };
}
