import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CURRENT_SQLITE_SCHEMA_VERSION, runDatabaseMigrations } from "../database-migrations";
import { ensureApplicationSchema, ensureBootstrapSchema, ensurePostMigrationSchema } from "./sqlite-schema";
import { createSqliteDocumentFileRepository } from "./sqlite-document-file-repository";
import { createSqliteDocumentSearchIndex } from "./sqlite-document-search-index";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  ensureBootstrapSchema(db);
  runDatabaseMigrations(db, 1);
  ensureApplicationSchema(db);
  runDatabaseMigrations(db, CURRENT_SQLITE_SCHEMA_VERSION);
  ensurePostMigrationSchema(db);
  db.prepare("INSERT INTO documents (title, fileHash, filePath) VALUES (?, ?, ?)")
    .run("Book", "original", "/library/book.pdf");
});

afterEach(() => {
  db.close();
});

describe("SQLite document file repository", () => {
  it("updates location, identity and processing fields while refreshing FTS", () => {
    const index = createSqliteDocumentSearchIndex(db);
    index.rebuild();
    const repository = createSqliteDocumentFileRepository(db, index);
    repository.updatePath("original", "/library/New/book.pdf");
    repository.updateFileType("original", "epub");
    repository.updateNumPages("original", 42);
    repository.updateSyncStatus("original", true, "Fiction");
    repository.updateThumbnailPath("original", "/covers/book.jpg");
    repository.updateProcessingStatus("original", "completed");
    repository.updateFileSize("original", 1234);

    expect(db.prepare<[], Record<string, unknown>>(
      `SELECT fileName, folderPath, fileMtime, fileType, numPages, isSynced,
        category, thumbnailPath, processingStatus, fileSize FROM documents`,
    ).get()).toEqual({
      fileName: "book.pdf",
      folderPath: "/library/New",
      fileMtime: null,
      fileType: "epub",
      numPages: 42,
      isSynced: 1,
      category: "Fiction",
      thumbnailPath: "/covers/book.jpg",
      processingStatus: "completed",
      fileSize: 1234,
    });
    expect(db.prepare<[], { folderPath: string; fileType: string }>(
      "SELECT folderPath, fileType FROM documents_fts",
    ).get()).toEqual({ folderPath: "/library/New", fileType: "epub" });

    repository.updateIdentity("original", "new-hash", "/library/Other/renamed.epub", 2000);
    expect(db.prepare<[], { fileHash: string; folderPath: string; fileSize: number }>(
      "SELECT fileHash, folderPath, fileSize FROM documents",
    ).get()).toEqual({ fileHash: "new-hash", folderPath: "/library/Other", fileSize: 2000 });
    expect(db.prepare<[], { folderPath: string }>("SELECT folderPath FROM documents_fts").get())
      .toEqual({ folderPath: "/library/Other" });
  });

  it("removes the document and its search entry, reporting missing documents", () => {
    const index = createSqliteDocumentSearchIndex(db);
    index.rebuild();
    const repository = createSqliteDocumentFileRepository(db, index);
    expect(repository.remove("missing")).toEqual({ success: false, error: "Document not found" });
    expect(repository.remove("original")).toEqual({ success: true });
    expect(db.prepare("SELECT * FROM documents").all()).toEqual([]);
    expect(db.prepare("SELECT * FROM documents_fts").all()).toEqual([]);
  });
});
