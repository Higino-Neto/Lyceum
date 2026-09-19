import path from "node:path";
import type Database from "better-sqlite3";
import type { DocumentRecord } from "../../src/types/LibraryTypes";

export interface DocumentSearchIndex {
  refreshById(documentId: number): void;
  refreshByHash(fileHash: string): void;
  rebuild(): void;
}

/** Keeps FTS writes together and independent of the local-database facade. */
export function createSqliteDocumentSearchIndex(db: Database.Database): DocumentSearchIndex {
  const deleteById = db.prepare("DELETE FROM documents_fts WHERE documentId = ?");
  const insert = db.prepare(
    `INSERT INTO documents_fts (documentId, title, author, folderPath, fileType)
     VALUES (?, ?, ?, ?, ?)`,
  );

  const insertDocument = (document: DocumentRecord) => {
    const folderPath = document.filePath
      ? path.dirname(document.filePath).replace(/\\/g, "/")
      : "";
    insert.run(
      document.id,
      document.title || "",
      document.author || "",
      document.folderPath || folderPath,
      document.fileType || "",
    );
  };

  const refreshById = (documentId: number) => {
    try {
      const document = db.prepare<[number], DocumentRecord>(
        "SELECT * FROM documents WHERE id = ?",
      ).get(documentId);
      deleteById.run(documentId);
      if (document) insertDocument(document);
    } catch (error) {
      console.error("[DB] Error refreshing document search index:", error);
    }
  };

  return {
    refreshById,
    refreshByHash(fileHash) {
      const document = db.prepare<[string], Pick<DocumentRecord, "id">>(
        "SELECT id FROM documents WHERE fileHash = ?",
      ).get(fileHash);
      if (document) refreshById(document.id);
    },
    rebuild() {
      try {
        db.prepare("DELETE FROM documents_fts").run();
        const documents = db.prepare<[], DocumentRecord>("SELECT * FROM documents").all();
        const insertMany = db.transaction((items: DocumentRecord[]) => {
          for (const document of items) insertDocument(document);
        });
        insertMany(documents);
      } catch (error) {
        console.error("[DB] Error rebuilding document search index:", error);
      }
    },
  };
}
