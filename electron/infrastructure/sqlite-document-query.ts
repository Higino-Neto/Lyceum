import path from "node:path";
import type Database from "better-sqlite3";
import type {
  DocumentRecord,
  LibraryListQuery,
  LibraryListResult,
  LibrarySortOption,
} from "../../src/types/LibraryTypes";

const ORDER_BY: Record<LibrarySortOption, string> = {
  title: "LOWER(COALESCE(NULLIF(d.title, ''), d.fileName, d.filePath)) ASC, d.id ASC",
  recent: "datetime(COALESCE(d.lastOpenedAt, d.updatedAt, d.importedAt, d.createdAt)) DESC, d.id DESC",
  pages: "COALESCE(d.numPages, 0) DESC, LOWER(COALESCE(NULLIF(d.title, ''), d.fileName, d.filePath)) ASC",
  size: "COALESCE(d.fileSize, 0) DESC, LOWER(COALESCE(NULLIF(d.title, ''), d.fileName, d.filePath)) ASC",
  title_asc: "LOWER(COALESCE(NULLIF(d.title, ''), d.fileName, d.filePath)) ASC, d.id ASC",
  title_desc: "LOWER(COALESCE(NULLIF(d.title, ''), d.fileName, d.filePath)) DESC, d.id DESC",
  recent_desc: "datetime(COALESCE(d.lastOpenedAt, d.updatedAt, d.importedAt, d.createdAt)) DESC, d.id DESC",
  recent_asc: "datetime(COALESCE(d.lastOpenedAt, d.updatedAt, d.importedAt, d.createdAt)) ASC, d.id ASC",
  pages_desc: "COALESCE(d.numPages, 0) DESC, LOWER(COALESCE(NULLIF(d.title, ''), d.fileName, d.filePath)) ASC",
  pages_asc: "COALESCE(d.numPages, 0) ASC, LOWER(COALESCE(NULLIF(d.title, ''), d.fileName, d.filePath)) ASC",
  size_desc: "COALESCE(d.fileSize, 0) DESC, LOWER(COALESCE(NULLIF(d.title, ''), d.fileName, d.filePath)) ASC",
  size_asc: "COALESCE(d.fileSize, 0) ASC, LOWER(COALESCE(NULLIF(d.title, ''), d.fileName, d.filePath)) ASC",
};

export function tokenizeDocumentSearch(query: string): string {
  const tokens = query
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .match(/[a-z0-9]+/g);
  return tokens?.map((token) => `${token}*`).join(" ") || "";
}

export interface DocumentQueryRepository {
  list(query?: LibraryListQuery): LibraryListResult;
  folderCounts(): Record<string, number>;
  all(): DocumentRecord[];
  byHash(fileHash: string): DocumentRecord | undefined;
  byFilePath(filePath: string): DocumentRecord | undefined;
  byTitle(title: string): DocumentRecord | undefined;
  byId(id: number): DocumentRecord | undefined;
  byBookId(bookId: string): DocumentRecord[];
  lastOpened(): DocumentRecord | undefined;
  bySyncStatus(synced: boolean): DocumentRecord[];
  legacyCategories(): string[];
  searchTitles(query: string): DocumentRecord[];
  pendingProcessing(): DocumentRecord[];
}

/** Read-only document queries. A caller owns the connection and its migrations. */
export function createSqliteDocumentQueryRepository(
  db: Database.Database,
  libraryPath: string,
): DocumentQueryRepository {
  return {
    all: () => db.prepare<[], DocumentRecord>("SELECT * FROM documents").all(),
    byHash: (fileHash) => db.prepare<[string], DocumentRecord>(
      "SELECT * FROM documents WHERE fileHash = ?",
    ).get(fileHash),
    byFilePath: (filePath) => db.prepare<[string], DocumentRecord>(
      "SELECT * FROM documents WHERE filePath = ?",
    ).get(filePath),
    byTitle: (title) => db.prepare<[string], DocumentRecord>(
      "SELECT * FROM documents WHERE title = ? LIMIT 1",
    ).get(title),
    byId: (id) => db.prepare<[number], DocumentRecord>(
      "SELECT * FROM documents WHERE id = ?",
    ).get(id),
    byBookId: (bookId) => db.prepare<[string], DocumentRecord>(
      "SELECT * FROM documents WHERE bookId = ?",
    ).all(bookId),
    lastOpened: () => db.prepare<[], DocumentRecord>(
      "SELECT * FROM documents ORDER BY lastOpenedAt DESC LIMIT 1",
    ).get(),
    bySyncStatus: (synced) => db.prepare<[number], DocumentRecord>(
      "SELECT * FROM documents WHERE isSynced = ?",
    ).all(synced ? 1 : 0),
    legacyCategories: () => db.prepare<[], { category: string }>(
      "SELECT DISTINCT category FROM documents WHERE category IS NOT NULL",
    ).all().map((row) => row.category),
    searchTitles: (query) => db.prepare<[string], DocumentRecord>(
      "SELECT * FROM documents WHERE title LIKE ? LIMIT 10",
    ).all(`%${query}%`),
    pendingProcessing: () => db.prepare<[], DocumentRecord>(
      "SELECT * FROM documents WHERE processingStatus = 'pending' OR processingStatus = 'failed'",
    ).all(),
    folderCounts() {
      const rows = db.prepare<[], { folderPath: string; count: number }>(`
        SELECT LOWER(RTRIM(REPLACE(folderPath, '\\', '/'), '/')) AS folderPath,
               COUNT(*) AS count
        FROM documents
        WHERE folderPath IS NOT NULL AND folderPath <> ''
        GROUP BY LOWER(RTRIM(REPLACE(folderPath, '\\', '/'), '/'))
      `).all();

      return Object.fromEntries(
        rows.filter((row) => Boolean(row.folderPath)).map((row) => [row.folderPath, row.count]),
      );
    },

    list(query: LibraryListQuery = {}) {
      const limit = Math.min(Math.max(query.limit ?? 60, 1), 200);
      const offset = Math.max(query.offset ?? 0, 0);
      const where: string[] = [];
      const values: unknown[] = [];
      let join = "";

      if (query.section === "synced") {
        where.push("d.isSynced = 1");
      } else if (query.section === "unsynced") {
        where.push("(d.isSynced IS NULL OR d.isSynced <> 1)");
      }

      if (query.fileType && query.fileType !== "all") {
        const fileTypes = String(query.fileType)
          .split(",")
          .map((type) => type.trim().toLowerCase())
          .filter(Boolean);
        if (fileTypes.length === 1) {
          where.push("LOWER(COALESCE(d.fileType, '')) = ?");
          values.push(fileTypes[0]);
        } else if (fileTypes.length > 1) {
          where.push(`LOWER(COALESCE(d.fileType, '')) IN (${fileTypes.map(() => "?").join(",")})`);
          values.push(...fileTypes);
        }
      }

      if (query.folderPath !== undefined && query.folderPath !== null) {
        const absoluteFolder = path.isAbsolute(query.folderPath)
          ? query.folderPath
          : path.join(libraryPath, query.folderPath);
        const normalizedFolder = absoluteFolder.replace(/\\/g, "/");
        const normalizedFilePath = "REPLACE(d.filePath, '\\', '/')";

        if (query.includeSubfolders === false) {
          where.push(
            `(d.folderPath = ? OR (${normalizedFilePath} LIKE ? AND ${normalizedFilePath} NOT LIKE ?))`,
          );
          values.push(normalizedFolder, `${normalizedFolder}/%`, `${normalizedFolder}/%/%`);
        } else {
          where.push(`(d.folderPath = ? OR d.folderPath LIKE ? OR ${normalizedFilePath} LIKE ?)`);
          values.push(normalizedFolder, `${normalizedFolder}/%`, `${normalizedFolder}/%`);
        }
      }

      const ftsQuery = query.search ? tokenizeDocumentSearch(query.search) : "";
      if (ftsQuery) {
        join = "INNER JOIN documents_fts fts ON fts.documentId = d.id";
        where.push("documents_fts MATCH ?");
        values.push(ftsQuery);
      }

      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const baseSql = `FROM documents d ${join} ${whereSql}`;
      const total = db.prepare<unknown[], { total: number }>(
        `SELECT COUNT(*) as total ${baseSql}`,
      ).get(...values)?.total ?? 0;
      const items = db.prepare<unknown[], DocumentRecord>(
        `SELECT d.* ${baseSql}
         ORDER BY ${ORDER_BY[query.sort || "title"]}
         LIMIT ? OFFSET ?`,
      ).all(...values, limit, offset);

      return { items, total, limit, offset, hasMore: offset + items.length < total };
    },
  };
}
