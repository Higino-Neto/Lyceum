import type Database from "better-sqlite3";
import type {
  DocumentMetadataPatch,
  DocumentMetadataRepository,
} from "../../src/core/library/document-metadata";
import type { DocumentRecord } from "../../src/types/LibraryTypes";
import type { DocumentSearchIndex } from "./sqlite-document-search-index";

const METADATA_FIELDS: readonly (keyof DocumentMetadataPatch)[] = [
  "title", "author", "description", "isbn", "publisher", "publishDate",
  "language", "identifier", "asin", "subject", "series", "seriesIndex",
  "authorSort", "titleSort",
];

/** Owns user-editable document metadata and keeps the full-text index current. */
export function createSqliteDocumentMetadataRepository(
  db: Database.Database,
  searchIndex: Pick<DocumentSearchIndex, "refreshByHash">,
): DocumentMetadataRepository {
  return {
    toggleFavorite(fileHash) {
      const doc = db.prepare<[string], Pick<DocumentRecord, "isFavorite">>(
        "SELECT isFavorite FROM documents WHERE fileHash = ?",
      ).get(fileHash);
      if (!doc) return false;
      const newValue = doc.isFavorite === 1 ? 0 : 1;
      db.prepare("UPDATE documents SET isFavorite = ?, updatedAt = CURRENT_TIMESTAMP WHERE fileHash = ?")
        .run(newValue, fileHash);
      return newValue === 1;
    },
    updateRating(fileHash, rating) {
      db.prepare("UPDATE documents SET rating = ?, updatedAt = CURRENT_TIMESTAMP WHERE fileHash = ?")
        .run(rating, fileHash);
    },
    updateNotes(fileHash, notes) {
      db.prepare("UPDATE documents SET notes = ?, updatedAt = CURRENT_TIMESTAMP WHERE fileHash = ?")
        .run(notes, fileHash);
    },
    updateMetadata(fileHash, patch) {
      const fields = METADATA_FIELDS.filter((field) => patch[field] !== undefined);
      if (fields.length === 0) return;
      const sets = fields.map((field) => `${field} = ?`);
      const values = fields.map((field) => patch[field]!);
      sets.push("updatedAt = CURRENT_TIMESTAMP");
      db.prepare(`UPDATE documents SET ${sets.join(", ")} WHERE fileHash = ?`)
        .run(...values, fileHash);
      searchIndex.refreshByHash(fileHash);
    },
    updateTitle(fileHash, title) {
      db.prepare("UPDATE documents SET title = ?, updatedAt = CURRENT_TIMESTAMP WHERE fileHash = ?")
        .run(title, fileHash);
      searchIndex.refreshByHash(fileHash);
    },
    updateAuthor(fileHash, author) {
      db.prepare("UPDATE documents SET author = ?, updatedAt = CURRENT_TIMESTAMP WHERE fileHash = ?")
        .run(author, fileHash);
      searchIndex.refreshByHash(fileHash);
    },
    getFavorites() {
      return db.prepare<[], DocumentRecord>("SELECT * FROM documents WHERE isFavorite = 1").all();
    },
  };
}
