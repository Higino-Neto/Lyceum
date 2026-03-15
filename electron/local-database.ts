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
  numPages: number;
  createdAt: string;
  lastOpenedAt: string;
  isSynced: number;
  category: string | null;
}

let db: Database.Database;

export function initDatabase() {
  const dbPath = path.join(app.getPath("userData"), "app.db");
  db = new Database(dbPath);

  db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE
  )
  `);

  db.exec(`
  CREATE TABLE IF NOT EXISTS document_categories (
    documentId INTEGER,
    categoryId INTEGER,
    PRIMARY KEY (documentId, categoryId),
    FOREIGN KEY (documentId) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE CASCADE
  )
  `);

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
            lastOpenedAt TEXT DEFAULT CURRENT_TIMESTAMP,
            isSynced INTEGER DEFAULT 0,
            category TEXT
            )
        `);

  try {
    db.exec(`ALTER TABLE documents ADD COLUMN isSynced INTEGER DEFAULT 0`);
  } catch (e) {}

  try {
    db.exec(`ALTER TABLE documents ADD COLUMN category TEXT`);
  } catch (e) {}

  const updateStmt = db.prepare(`
    UPDATE documents
    SET thumbnailPath = REPLACE(thumbnailPath, '.jpg', '-1.jpg')
    WHERE thumbnailPath IS NOT NULL AND thumbnailPath NOT LIKE '%-1.jpg'
  `);
  updateStmt.run();
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

export function addDocument(
  title: string,
  filePath: string,
  fileHash: string,
  thumbnailPath?: string,
  numPages: number = 1,
) {
  const statement = db.prepare(`
        INSERT INTO documents (title, filePath, fileHash, thumbnailPath, numPages)
        VALUES (?, ?, ?, ?, ?)
        `);
  return statement.run(
    title,
    filePath,
    fileHash,
    thumbnailPath || null,
    numPages,
  );
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

export function updateDocumentPath(fileHash: string, newPath: string) {
  db.prepare(
    `
    UPDATE documents
    SET filePath = ?
    WHERE fileHash = ?
  `,
  ).run(newPath, fileHash);
}

export function updateDocumentSyncStatus(fileHash: string, isSynced: boolean, category?: string) {
  db.prepare(
    `
    UPDATE documents
    SET isSynced = ?, category = ?
    WHERE fileHash = ?
  `,
  ).run(isSynced ? 1 : 0, category || null, fileHash);
}

export function updateThumbnailPath(fileHash: string, thumbnailPath: string) {
  db.prepare(
    `
    UPDATE documents
    SET thumbnailPath = ?
    WHERE fileHash = ?
  `,
  ).run(thumbnailPath, fileHash);
}

export function getDocumentsBySyncStatus(synced: boolean): DocumentRecord[] {
  return db.prepare<[number], DocumentRecord>(
    `SELECT * FROM documents WHERE isSynced = ?`
  ).all(synced ? 1 : 0);
}

export function getCategories(): string[] {
  const results = db.prepare<[], { category: string }>(
    `SELECT DISTINCT category FROM documents WHERE category IS NOT NULL`
  ).all();
  return results.map(r => r.category);
}

export function searchDocuments(query: string): DocumentRecord[] {
  return db.prepare<[string], DocumentRecord>(
    `SELECT * FROM documents WHERE title LIKE ? LIMIT 10`
  ).all(`%${query}%`);
}
