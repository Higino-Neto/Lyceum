import type Database from "better-sqlite3";
import type { DocumentFileRepository } from "../../src/core/library/document-files";
import { getFileMtime, getFileName, getFolderPath } from "./document-file-metadata";
import type { DocumentSearchIndex } from "./sqlite-document-search-index";

/** Persists document file identity, state, and location. */
export function createSqliteDocumentFileRepository(
  db: Database.Database,
  searchIndex: Pick<DocumentSearchIndex, "refreshByHash">,
): DocumentFileRepository {
  return {
    updatePath(fileHash, newPath) {
      db.prepare(`UPDATE documents SET filePath = ?, fileName = ?, folderPath = ?,
        fileMtime = ?, updatedAt = CURRENT_TIMESTAMP WHERE fileHash = ?`)
        .run(newPath, getFileName(newPath), getFolderPath(newPath), getFileMtime(newPath), fileHash);
      searchIndex.refreshByHash(fileHash);
    },
    updateFileType(fileHash, fileType) {
      db.prepare("UPDATE documents SET fileType = ?, updatedAt = CURRENT_TIMESTAMP WHERE fileHash = ?")
        .run(fileType, fileHash);
      searchIndex.refreshByHash(fileHash);
    },
    updateNumPages(fileHash, numPages) {
      db.prepare("UPDATE documents SET numPages = ? WHERE fileHash = ?").run(numPages, fileHash);
    },
    updateSyncStatus(fileHash, isSynced, category) {
      db.prepare("UPDATE documents SET isSynced = ?, category = ?, updatedAt = CURRENT_TIMESTAMP WHERE fileHash = ?")
        .run(isSynced ? 1 : 0, category || null, fileHash);
    },
    updateThumbnailPath(fileHash, thumbnailPath) {
      db.prepare("UPDATE documents SET thumbnailPath = ?, updatedAt = CURRENT_TIMESTAMP WHERE fileHash = ?")
        .run(thumbnailPath, fileHash);
    },
    updateProcessingStatus(fileHash, status) {
      db.prepare("UPDATE documents SET processingStatus = ?, updatedAt = CURRENT_TIMESTAMP WHERE fileHash = ?")
        .run(status, fileHash);
    },
    updateFileSize(fileHash, fileSize) {
      db.prepare("UPDATE documents SET fileSize = ?, updatedAt = CURRENT_TIMESTAMP WHERE fileHash = ?")
        .run(fileSize, fileHash);
    },
    updateIdentity(oldFileHash, newFileHash, filePath, fileSize) {
      db.prepare(`UPDATE documents SET fileHash = ?, filePath = ?, fileName = ?,
        folderPath = ?, fileMtime = ?, fileSize = ?, updatedAt = CURRENT_TIMESTAMP
        WHERE fileHash = ?`)
        .run(newFileHash, filePath, getFileName(filePath), getFolderPath(filePath),
          getFileMtime(filePath), fileSize, oldFileHash);
      searchIndex.refreshByHash(newFileHash);
    },
    remove(fileHash) {
      try {
        const document = db.prepare<[string], { id: number }>(
          "SELECT id FROM documents WHERE fileHash = ?",
        ).get(fileHash);
        if (!document) return { success: false, error: "Document not found" };
        db.prepare("DELETE FROM documents_fts WHERE documentId = ?").run(document.id);
        db.prepare("DELETE FROM documents WHERE fileHash = ?").run(fileHash);
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
  };
}
