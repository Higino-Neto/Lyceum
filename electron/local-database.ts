import Database from "better-sqlite3";
import { app } from "electron";
import path from "path";

interface DocumentRecord {
  id: number;
  title: string;
  filePath: string;
  fileHash: string;
  currentPage: number;
  currentZoom: number | null;
  currentScroll: number | null;
  annotations: string | null;
  thumbnailPath: string | null;
  createdAt: string;
}

let db: Database.Database;

export function initDatabase() {
  const dbPath = path.join(app.getPath("userData"), "app.db");
  db = new Database(dbPath);

  db.exec(`
        CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            numPages INTEGER DEFAULT 1,
            filePath TEXT,
            fileHash TEXT UNIQUE,
            currentPage INTEGER DEFAULT 1,
            currentZoom REAL,
            currentScroll REAL,
            annotations TEXT,
            thumbnailPath TEXT,
            createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
            lastOpenedAt TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);
}

export function updateLastOpened(fileHash: string) {
  db.prepare(
    `
    UPDATE documents SET lastOpenedAt = CURRENT_TIMESTAMP WHERE fileHash = ?
  `,
  ).run(fileHash);
}

export function updateReadingState(
  fileHash: string,
  state: {
    currentPage: number;
    currentZoom: number;
    currentScroll: number;
    annotations: string;
  },
) {
  const statement = db.prepare(`
    UPDATE documents
    SET currentPage = ?,
        currentZoom = ?,
        currentScroll = ?,
        annotations = ?
    WHERE fileHash = ?
    `);

  statement.run(
    state.currentPage,
    state.currentZoom,
    state.currentScroll,
    state.annotations,
    fileHash,
  );
}

export function addDocument(title: string, filePath: string, fileHash: string) {
  const statement = db.prepare(`
        INSERT INTO documents (title, filePath, fileHash)
        VALUES (?, ?, ?)
        `);
  return statement.run(title, filePath, fileHash);
}
export function getAllDocuments(): DocumentRecord[] {
  return db.prepare<[], DocumentRecord>(`select * from documents`).all();
}
export function getDocumentByHash(
  fileHash: string,
): DocumentRecord | undefined {
  return db
    .prepare<
      [string],
      DocumentRecord
    >(`select * from documents where fileHash = ?`)
    .get(fileHash);
}

export function getLastDocument(): DocumentRecord | undefined {
  return db
    .prepare<
      [],
      DocumentRecord
    >(`SELECT * FROM documents ORDER BY lastOpenedAt DESC LIMIT 1`)
    .get();
}
