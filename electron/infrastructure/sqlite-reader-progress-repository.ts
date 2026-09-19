import type Database from "better-sqlite3";
import { assertReadingStatus, type ReaderProgressRepository } from "../../src/core/reader/progress";

/** Persists the current position and status of a document, independent of reader format. */
export function createSqliteReaderProgressRepository(db: Database.Database): ReaderProgressRepository {
  const savePosition = db.prepare(`UPDATE documents
    SET currentPage = ?, currentZoom = ?, currentScroll = ?, annotations = ?,
      readingStatus = CASE
        WHEN readingStatus IS NULL AND COALESCE(numPages, 0) > 1 AND ? >= numPages THEN 'read'
        WHEN readingStatus IS NULL AND ? > 1 THEN 'reading'
        ELSE readingStatus
      END,
      completedAt = CASE
        WHEN readingStatus IS NULL AND COALESCE(numPages, 0) > 1 AND ? >= numPages
          THEN COALESCE(completedAt, CURRENT_TIMESTAMP)
        ELSE completedAt
      END
    WHERE fileHash = ?`);

  return {
    markOpened(fileHash) {
      db.prepare("UPDATE documents SET lastOpenedAt = CURRENT_TIMESTAMP WHERE fileHash = ?").run(fileHash);
    },
    savePosition(fileHash, position) {
      savePosition.run(
        position.currentPage,
        position.currentZoom,
        position.currentScroll,
        position.annotations,
        position.currentPage,
        position.currentPage,
        position.currentPage,
        fileHash,
      );
    },
    updateStatus(fileHash, status) {
      assertReadingStatus(status);
      const result = db.prepare(`UPDATE documents SET readingStatus = ?,
        completedAt = CASE WHEN ? = 'read' THEN COALESCE(completedAt, CURRENT_TIMESTAMP) ELSE NULL END,
        updatedAt = CURRENT_TIMESTAMP WHERE fileHash = ?`).run(status, status, fileHash);
      return result.changes > 0;
    },
  };
}
