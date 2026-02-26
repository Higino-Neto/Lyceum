import Database from "better-sqlite3";
import { app } from "electron";
import path from "path";

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
            createdAt TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);
}

export function addDocument(title: string, filePath: string, fileHash: string) {
  const statement = db.prepare(`
        INSERT INTO documents (title, filePath, fileHash)
        VALUES (?, ?, ?)
        `);
  return statement.run(title, filePath, fileHash);
}

export function getAllDocuments() {
  return db.prepare("select * from documents").all();
}
