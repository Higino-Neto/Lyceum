import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CURRENT_SQLITE_SCHEMA_VERSION, runDatabaseMigrations } from "../database-migrations";
import { ensureApplicationSchema, ensureBootstrapSchema } from "./sqlite-schema";
import { createSqliteDocumentQueryRepository, tokenizeDocumentSearch } from "./sqlite-document-query";

let db: Database.Database;
const libraryPath = "/data/library";

function addDocument(
  hash: string,
  title: string,
  folderPath: string,
  fileType: string,
  isSynced: number,
  numPages: number,
): void {
  const filePath = `${folderPath}/${hash}.${fileType}`;
  const result = db.prepare(
    `INSERT INTO documents (title, filePath, fileName, folderPath, fileHash, fileType, isSynced, numPages)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(title, filePath, `${hash}.${fileType}`, folderPath, hash, fileType, isSynced, numPages);
  db.prepare(
    "INSERT INTO documents_fts (documentId, title, author, folderPath, fileType) VALUES (?, ?, ?, ?, ?)",
  ).run(result.lastInsertRowid, title, "", folderPath, fileType);
}

beforeEach(() => {
  db = new Database(":memory:");
  ensureBootstrapSchema(db);
  runDatabaseMigrations(db, 1);
  ensureApplicationSchema(db);
  runDatabaseMigrations(db, CURRENT_SQLITE_SCHEMA_VERSION);
  addDocument("a", "Álgebra", libraryPath, "pdf", 1, 200);
  addDocument("b", "Biografia", `${libraryPath}/historia`, "epub", 1, 100);
  addDocument("c", "Cálculo", `${libraryPath}/historia/antiga`, "pdf", 0, 50);
});

afterEach(() => {
  db.close();
});

describe("SQLite document query repository", () => {
  it("normalizes accented search into safe FTS prefix tokens", () => {
    expect(tokenizeDocumentSearch(" Álge-bra! ")).toBe("alge* bra*");
    expect(tokenizeDocumentSearch("…")).toBe("");
  });

  it("paginates and sorts without changing the total", () => {
    const repository = createSqliteDocumentQueryRepository(db, libraryPath);
    expect(repository.list({ sort: "title_asc", limit: 2 })).toMatchObject({
      total: 3,
      limit: 2,
      offset: 0,
      hasMore: true,
    });
    expect(repository.list({ sort: "pages_desc", limit: 2, offset: 2 }).items.map((item) => item.fileHash))
      .toEqual(["c"]);
    expect(repository.list({ limit: 999 }).limit).toBe(200);
  });

  it("combines sync, format, folder and FTS filters", () => {
    const repository = createSqliteDocumentQueryRepository(db, libraryPath);
    expect(repository.list({ section: "synced", fileType: "pdf" }).items.map((item) => item.fileHash))
      .toEqual(["a"]);
    expect(repository.list({ section: "unsynced", fileType: "epub,pdf" }).items.map((item) => item.fileHash))
      .toEqual(["c"]);
    expect(repository.list({ search: "Álgebra" }).items.map((item) => item.fileHash))
      .toEqual(["a"]);
    expect(repository.list({ folderPath: "historia", includeSubfolders: false }).items.map((item) => item.fileHash))
      .toEqual(["b"]);
    expect(repository.list({ folderPath: "historia", includeSubfolders: true }).items.map((item) => item.fileHash))
      .toEqual(["b", "c"]);
  });

  it("counts documents in normalized folders", () => {
    const repository = createSqliteDocumentQueryRepository(db, libraryPath);
    expect(repository.folderCounts()).toEqual({
      "/data/library": 1,
      "/data/library/historia": 1,
      "/data/library/historia/antiga": 1,
    });
  });

  it("resolves document identities and legacy status queries", () => {
    db.prepare("UPDATE documents SET processingStatus = 'completed' WHERE fileHash IN ('a', 'c')").run();
    db.prepare(
      "UPDATE documents SET bookId = ?, category = ?, processingStatus = ?, lastOpenedAt = ? WHERE fileHash = ?",
    ).run("logical-book", "Ensaios", "failed", "2030-01-01T00:00:00.000Z", "b");
    const repository = createSqliteDocumentQueryRepository(db, libraryPath);
    const document = repository.byHash("b")!;
    expect(repository.all()).toHaveLength(3);
    expect(repository.byFilePath(document.filePath)?.id).toBe(document.id);
    expect(repository.byTitle("Biografia")?.id).toBe(document.id);
    expect(repository.byId(document.id)?.fileHash).toBe("b");
    expect(repository.byBookId("logical-book").map(({ fileHash }) => fileHash)).toEqual(["b"]);
    expect(repository.lastOpened()?.fileHash).toBe("b");
    expect(repository.bySyncStatus(false).map(({ fileHash }) => fileHash)).toEqual(["c"]);
    expect(repository.legacyCategories()).toEqual(["Ensaios"]);
    expect(repository.searchTitles("Biog").map(({ fileHash }) => fileHash)).toEqual(["b"]);
    expect(repository.pendingProcessing().map(({ fileHash }) => fileHash)).toEqual(["b"]);
    expect(repository.byHash("missing")).toBeUndefined();
  });
});
