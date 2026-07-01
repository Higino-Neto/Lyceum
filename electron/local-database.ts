import Database from "better-sqlite3";
import electron from "electron";
import path from "path";
import fs from "fs";
import { randomUUID } from "node:crypto";
import type {
  BookFileType,
  DocumentRecord,
  LibraryFileTypeFilter,
  LibraryListQuery,
  LibraryListResult,
  LibrarySection,
  LibrarySortOption,
  ReadingMap,
  ReadingMapItem,
  ReadingMapPayload,
  ReadingMapSection,
  ReadingMapSectionWithItems,
  ReadingStatus,
  ReadingStatusItem,
  ReadingStatusPayload,
} from "../src/types/LibraryTypes";

const { app } = electron;

export type {
  BookFileType,
  DocumentRecord,
  LibraryFileTypeFilter,
  LibraryListQuery,
  LibraryListResult,
  LibrarySection,
  LibrarySortOption,
};

export interface BookCategory {
  id: number;
  name: string;
  color: string;
  bookCount: number;
  createdAt: string;
}

export interface DocumentWithCategories extends DocumentRecord {
  categories: BookCategory[];
}

interface ReadingMapSectionRow extends Omit<ReadingMapSection, "order"> {
  orderIndex: number;
}

interface ReadingMapItemRow extends Omit<ReadingMapItem, "order" | "book" | "missingDocument"> {
  orderIndex: number;
}

interface ReadingStatusItemRow extends Omit<ReadingStatusItem, "order" | "book" | "missingDocument" | "localProgressPages"> {
  orderIndex: number;
}

const DEFAULT_READING_MAP_ID = "default-reading-map";
const ATLAS_NOTES_VAULT_SETTING_KEY = "notesVaultPath";
const DEFAULT_READING_MAP_SECTIONS = [
  {
    title: "Preambulo",
    description: "Uma introducao ao ato de ler com profundidade e proposito.\n\nCobre:\n- Principios de leitura ativa\n- Niveis de compreensao\n- Preparacao para estudo profundo",
  },
  {
    title: "Fundamentos",
    description: "Conceitos essenciais que sustentam o restante da trilha.\n\nCobre:\n- Mentalidade de crescimento\n- Definicao de objetivos\n- Disciplina e consistencia",
  },
  {
    title: "Aprofundamento",
    description: "Livros que aprofundam habitos, consciencia e foco.\n\nCobre:\n- Formacao de habitos\n- Consciencia e foco\n- Clareza mental",
  },
  {
    title: "Especializacao",
    description: "Aplicacao do conhecimento em areas especificas para desempenho excepcional.\n\nCobre:\n- Produtividade e foco profundo\n- Mentalidade e aprendizado\n- Resiliencia e incerteza",
  },
];

const DEFAULT_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280", "#14b8a6",
];

let db: Database.Database;

function normalizeStoredPath(filePath: string | null | undefined): string | null {
  return filePath ? filePath.replace(/\\/g, "/") : null;
}

function getFileName(filePath: string | null | undefined): string | null {
  return filePath ? path.basename(filePath) : null;
}

function getFolderPath(filePath: string | null | undefined): string | null {
  if (!filePath) return null;
  return normalizeStoredPath(path.dirname(filePath));
}

function getFileMtime(filePath: string | null | undefined): number | null {
  if (!filePath) return null;
  try {
    return Math.round(fs.statSync(filePath).mtimeMs);
  } catch {
    return null;
  }
}

function hydrateDocumentFileMetadata(): void {
  try {
    const docs = db.prepare<[], Pick<DocumentRecord, "id" | "filePath" | "fileName" | "folderPath" | "fileMtime">>(
      `SELECT id, filePath, fileName, folderPath, fileMtime FROM documents WHERE filePath IS NOT NULL`
    ).all();

    const update = db.prepare(
      `UPDATE documents
       SET fileName = ?,
           folderPath = ?,
           fileMtime = COALESCE(?, fileMtime),
           importedAt = COALESCE(importedAt, createdAt),
           updatedAt = COALESCE(updatedAt, createdAt)
       WHERE id = ?`
    );

    const updateMany = db.transaction((items: typeof docs) => {
      for (const doc of items) {
        const nextFileName = doc.fileName || getFileName(doc.filePath);
        const nextFolderPath = getFolderPath(doc.filePath);
        const nextMtime = doc.fileMtime ?? getFileMtime(doc.filePath);

        update.run(nextFileName, nextFolderPath, nextMtime, doc.id);
      }
    });

    updateMany(docs);
  } catch (error) {
    console.error("[DB] Error hydrating document file metadata:", error);
  }
}

function tokenizeSearch(query: string): string {
  const tokens = query
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .match(/[a-z0-9]+/g);

  return tokens?.map((token) => `${token}*`).join(" ") || "";
}

function refreshDocumentSearchIndexById(documentId: number): void {
  try {
    const doc = db.prepare<[number], DocumentRecord>(
      `SELECT * FROM documents WHERE id = ?`
    ).get(documentId);

    db.prepare(`DELETE FROM documents_fts WHERE documentId = ?`).run(documentId);

    if (!doc) return;

    db.prepare(
      `INSERT INTO documents_fts (documentId, title, author, folderPath, fileType)
       VALUES (?, ?, ?, ?, ?)`
    ).run(
      doc.id,
      doc.title || "",
      doc.author || "",
      doc.folderPath || getFolderPath(doc.filePath) || "",
      doc.fileType || "",
    );
  } catch (error) {
    console.error("[DB] Error refreshing document search index:", error);
  }
}

function refreshDocumentSearchIndex(fileHash: string): void {
  const doc = getDocumentByHash(fileHash);
  if (doc) refreshDocumentSearchIndexById(doc.id);
}

function rebuildDocumentSearchIndex(): void {
  try {
    db.prepare(`DELETE FROM documents_fts`).run();
    const docs = getAllDocuments();
    const insert = db.prepare(
      `INSERT INTO documents_fts (documentId, title, author, folderPath, fileType)
       VALUES (?, ?, ?, ?, ?)`
    );
    const insertMany = db.transaction((items: DocumentRecord[]) => {
      for (const doc of items) {
        insert.run(
          doc.id,
          doc.title || "",
          doc.author || "",
          doc.folderPath || getFolderPath(doc.filePath) || "",
          doc.fileType || "",
        );
      }
    });
    insertMany(docs);
  } catch (error) {
    console.error("[DB] Error rebuilding document search index:", error);
  }
}

export function initDatabase() {
  const dbPath = path.join(app.getPath("userData"), "app.db");
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.pragma("temp_store = MEMORY");

  db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#6b7280',
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP
  )
  `);

  db.exec(`
  CREATE TABLE IF NOT EXISTS document_categories (
    documentId INTEGER NOT NULL,
    categoryId INTEGER NOT NULL,
    PRIMARY KEY (documentId, categoryId),
    FOREIGN KEY (documentId) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE CASCADE
  )
  `);

  db.exec(`
  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
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
    isFavorite INTEGER DEFAULT 0,
    rating REAL DEFAULT 0,
    notes TEXT,
    author TEXT,
    description TEXT,
    isbn TEXT,
    publisher TEXT,
    publishDate TEXT,
    language TEXT,
    identifier TEXT,
    asin TEXT,
    subject TEXT,
    series TEXT,
    seriesIndex TEXT,
    authorSort TEXT,
    titleSort TEXT,
    fileSize INTEGER DEFAULT 0,
    processingStatus TEXT DEFAULT 'pending',
    bookId TEXT,
    fileName TEXT,
    folderPath TEXT,
    fileMtime INTEGER,
    importedAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
    readingStatus TEXT,
    completedAt TEXT
  )
  `);

  const migrationColumns = [
    "isSynced", "isFavorite", "rating", "notes", "author",
    "description", "isbn", "publisher", "publishDate", "language", "identifier", "asin", "subject",
    "series", "seriesIndex", "authorSort", "titleSort", "fileSize", "processingStatus", "bookId", "fileType",
    "fileName", "folderPath", "fileMtime", "importedAt", "updatedAt", "readingStatus", "completedAt"
  ];

  for (const col of migrationColumns) {
    const sql = `ALTER TABLE documents ADD COLUMN ${col} ${
      col === "isSynced" || col === "isFavorite" ? "INTEGER DEFAULT 0" :
      col === "rating" ? "REAL DEFAULT 0" :
      col === "fileSize" ? "INTEGER DEFAULT 0" :
      col === "fileType" ? "TEXT DEFAULT 'pdf'" :
      col === "fileMtime" ? "INTEGER" :
      col === "importedAt" || col === "updatedAt" ? "TEXT" :
      col === "readingStatus" || col === "completedAt" ? "TEXT" :
      "TEXT"
    }`;
    try {
      db.exec(sql);
    } catch {
      // Column already exists
    }
  }

  try {
    db.exec(`ALTER TABLE categories ADD COLUMN color TEXT NOT NULL DEFAULT '#6b7280'`);
  } catch {
    // Column already exists
  }

  try {
    db.exec(`ALTER TABLE categories ADD COLUMN createdAt TEXT DEFAULT CURRENT_TIMESTAMP`);
  } catch {
    // Column already exists
  }

  db.exec(`CREATE INDEX IF NOT EXISTS idx_document_categories_doc ON document_categories(documentId)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_document_categories_cat ON document_categories(categoryId)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_documents_file_hash ON documents(fileHash)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_documents_file_path ON documents(filePath)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_documents_folder_path ON documents(folderPath)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_documents_file_type ON documents(fileType)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_documents_is_synced ON documents(isSynced)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_documents_last_opened ON documents(lastOpenedAt DESC)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_documents_title ON documents(title COLLATE NOCASE)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_documents_author ON documents(author COLLATE NOCASE)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_documents_processing ON documents(processingStatus)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_documents_reading_status ON documents(readingStatus)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS reading_maps (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS reading_map_sections (
      id TEXT PRIMARY KEY,
      mapId TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      orderIndex INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (mapId) REFERENCES reading_maps(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS reading_map_items (
      id TEXT PRIMARY KEY,
      sectionId TEXT NOT NULL,
      bookId TEXT,
      title TEXT NOT NULL,
      author TEXT,
      coverPath TEXT,
      status TEXT NOT NULL DEFAULT 'want_to_read',
      orderIndex INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sectionId) REFERENCES reading_map_sections(id) ON DELETE CASCADE
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_reading_maps_updated ON reading_maps(updatedAt DESC)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_reading_map_sections_map ON reading_map_sections(mapId, orderIndex)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_reading_map_items_section ON reading_map_items(sectionId, orderIndex)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS reading_status_items (
      id TEXT PRIMARY KEY,
      bookId TEXT,
      title TEXT NOT NULL,
      author TEXT,
      coverPath TEXT,
      description TEXT,
      isbn TEXT,
      publisher TEXT,
      publishDate TEXT,
      subject TEXT,
      status TEXT NOT NULL DEFAULT 'want_to_read',
      orderIndex INTEGER NOT NULL DEFAULT 0,
      isPrimary INTEGER NOT NULL DEFAULT 0,
      manualBasePage INTEGER NOT NULL DEFAULT 0,
      manualCurrentPage INTEGER NOT NULL DEFAULT 0,
      manualTotalPages INTEGER,
      notePath TEXT,
      notesMarkdown TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const readingStatusItemColumns: Array<[string, string]> = [
    ["description", "TEXT"],
    ["isbn", "TEXT"],
    ["publisher", "TEXT"],
    ["publishDate", "TEXT"],
    ["subject", "TEXT"],
    ["isPrimary", "INTEGER NOT NULL DEFAULT 0"],
    ["manualBasePage", "INTEGER NOT NULL DEFAULT 0"],
    ["notePath", "TEXT"],
    ["notesMarkdown", "TEXT"],
    ["rating", "INTEGER NOT NULL DEFAULT 0"],
  ];
  for (const [column, definition] of readingStatusItemColumns) {
    try {
      db.exec(`ALTER TABLE reading_status_items ADD COLUMN ${column} ${definition}`);
    } catch {
      // Column already exists
    }
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS reading_status_progress_events (
      id TEXT PRIMARY KEY,
      statusItemId TEXT NOT NULL,
      pages INTEGER NOT NULL DEFAULT 0,
      note TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (statusItemId) REFERENCES reading_status_items(id) ON DELETE CASCADE
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_reading_status_items_status ON reading_status_items(status, orderIndex)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_reading_status_items_book ON reading_status_items(bookId)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_reading_status_events_item ON reading_status_progress_events(statusItemId, createdAt)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS atlas_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS local_books (
      id TEXT PRIMARY KEY,
      canonicalTitle TEXT NOT NULL,
      sortTitle TEXT,
      description TEXT,
      isbn TEXT,
      publisher TEXT,
      publishDate TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS authors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      sortName TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS document_authors (
      documentId INTEGER NOT NULL,
      authorId INTEGER NOT NULL,
      role TEXT DEFAULT 'author',
      PRIMARY KEY (documentId, authorId, role),
      FOREIGN KEY (documentId) REFERENCES documents(id) ON DELETE CASCADE,
      FOREIGN KEY (authorId) REFERENCES authors(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#6b7280',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS document_tags (
      documentId INTEGER NOT NULL,
      tagId INTEGER NOT NULL,
      PRIMARY KEY (documentId, tagId),
      FOREIGN KEY (documentId) REFERENCES documents(id) ON DELETE CASCADE,
      FOREIGN KEY (tagId) REFERENCES tags(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS processing_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      documentId INTEGER NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      priority INTEGER NOT NULL DEFAULT 0,
      attempts INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(documentId, type),
      FOREIGN KEY (documentId) REFERENCES documents(id) ON DELETE CASCADE
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_document_authors_doc ON document_authors(documentId)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_document_authors_author ON document_authors(authorId)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_document_tags_doc ON document_tags(documentId)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_document_tags_tag ON document_tags(tagId)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_processing_jobs_status ON processing_jobs(status, priority DESC, createdAt)`);

  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
      documentId UNINDEXED,
      title,
      author,
      folderPath,
      fileType,
      tokenize = 'unicode61 remove_diacritics 2'
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS book_word_index (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fileHash TEXT NOT NULL,
      word TEXT NOT NULL,
      count INTEGER NOT NULL,
      UNIQUE(fileHash, word)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS watch_folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL UNIQUE,
      label TEXT,
      type TEXT NOT NULL DEFAULT 'watch',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  try {
    db.exec(`ALTER TABLE watch_folders ADD COLUMN type TEXT NOT NULL DEFAULT 'watch'`);
  } catch {
    // Column already exists
  }

  db.exec(`CREATE INDEX IF NOT EXISTS idx_word_index_fileHash ON book_word_index(fileHash)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_word_index_word ON book_word_index(word)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS habits (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      unit TEXT,
      valueMode TEXT DEFAULT 'toggle'
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS habit_completions (
      habitId TEXT NOT NULL,
      dateKey TEXT NOT NULL,
      value TEXT,
      PRIMARY KEY (habitId, dateKey),
      FOREIGN KEY (habitId) REFERENCES habits(id) ON DELETE CASCADE
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_habit_completions_habit ON habit_completions(habitId)`);

  const updateStmt = db.prepare(`
    UPDATE documents
    SET thumbnailPath = REPLACE(thumbnailPath, '.jpg', '-1.jpg')
    WHERE thumbnailPath IS NOT NULL AND thumbnailPath NOT LIKE '%-1.jpg'
  `);
  updateStmt.run();

  db.exec(`
    UPDATE documents
    SET fileType = CASE
      WHEN LOWER(filePath) LIKE '%.epub' THEN 'epub'
      WHEN LOWER(filePath) LIKE '%.pdf' THEN 'pdf'
      ELSE fileType
    END
    WHERE filePath IS NOT NULL
  `);

  db.exec(`DELETE FROM documents WHERE fileType = 'pdf' AND LOWER(filePath) LIKE '%.docx'`);
  db.exec(`DELETE FROM documents WHERE fileType = 'pdf' AND LOWER(filePath) LIKE '%.txt'`);
  db.exec(`DELETE FROM documents WHERE fileType = 'pdf' AND LOWER(filePath) LIKE '%.html'`);
  db.exec(`DELETE FROM documents WHERE fileType = 'pdf' AND LOWER(filePath) LIKE '%.htm'`);

  hydrateDocumentFileMetadata();

  rebuildDocumentSearchIndex();
}

export function createCategory(name: string, color?: string): BookCategory | null {
  const finalColor = color || DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)];
  
  try {
    const result = db.prepare(
      `INSERT INTO categories (name, color) VALUES (?, ?)`
    ).run(name.trim(), finalColor);
    
    return {
      id: result.lastInsertRowid as number,
      name: name.trim(),
      color: finalColor,
      bookCount: 0,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("[DB] Error creating category:", error);
    return null;
  }
}

export function updateCategory(id: number, name: string, color: string): boolean {
  try {
    db.prepare(`UPDATE categories SET name = ?, color = ? WHERE id = ?`).run(name.trim(), color, id);
    return true;
  } catch (error) {
    console.error("[DB] Error updating category:", error);
    return false;
  }
}

export function deleteCategory(id: number): boolean {
  try {
    db.prepare(`DELETE FROM document_categories WHERE categoryId = ?`).run(id);
    db.prepare(`DELETE FROM categories WHERE id = ?`).run(id);
    return true;
  } catch (error) {
    console.error("[DB] Error deleting category:", error);
    return false;
  }
}

export function getAllCategories(): BookCategory[] {
  const categories = db.prepare<[], { id: number; name: string; color: string; createdAt: string; bookCount: number }>(
    `SELECT c.id, c.name, c.color, c.createdAt,
     (SELECT COUNT(*) FROM document_categories dc WHERE dc.categoryId = c.id) as bookCount
     FROM categories c ORDER BY c.name`
  ).all();
  
  return categories;
}

export function getCategoryById(id: number): BookCategory | null {
  const result = db.prepare<[number], { id: number; name: string; color: string; createdAt: string; bookCount: number }>(
    `SELECT c.id, c.name, c.color, c.createdAt,
     (SELECT COUNT(*) FROM document_categories dc WHERE dc.categoryId = c.id) as bookCount
     FROM categories c WHERE c.id = ?`
  ).get(id);
  
  return result || null;
}

export function getCategoriesForDocument(documentId: number): BookCategory[] {
  return db.prepare<[number], BookCategory>(
    `SELECT c.id, c.name, c.color, c.createdAt,
     (SELECT COUNT(*) FROM document_categories dc WHERE dc.categoryId = c.id) as bookCount
     FROM categories c
     INNER JOIN document_categories dc ON c.id = dc.categoryId
     WHERE dc.documentId = ?
     ORDER BY c.name`
  ).all(documentId);
}

export function getCategoriesForDocumentByHash(fileHash: string): BookCategory[] {
  return db.prepare<[string], BookCategory>(
    `SELECT c.id, c.name, c.color, c.createdAt,
     (SELECT COUNT(*) FROM document_categories dc WHERE dc.categoryId = c.id) as bookCount
     FROM categories c
     INNER JOIN document_categories dc ON c.id = dc.categoryId
     INNER JOIN documents d ON dc.documentId = d.id
     WHERE d.fileHash = ?
     ORDER BY c.name`
  ).all(fileHash);
}

export function setDocumentCategories(documentId: number, categoryIds: number[]): boolean {
  try {
    db.prepare(`DELETE FROM document_categories WHERE documentId = ?`).run(documentId);
    
    for (const catId of categoryIds) {
      db.prepare(
        `INSERT OR IGNORE INTO document_categories (documentId, categoryId) VALUES (?, ?)`
      ).run(documentId, catId);
    }
    
    return true;
  } catch (error) {
    console.error("[DB] Error setting document categories:", error);
    return false;
  }
}

export function addCategoryToDocument(documentId: number, categoryId: number): boolean {
  try {
    db.prepare(
      `INSERT OR IGNORE INTO document_categories (documentId, categoryId) VALUES (?, ?)`
    ).run(documentId, categoryId);
    return true;
  } catch (error) {
    console.error("[DB] Error adding category to document:", error);
    return false;
  }
}

export function removeCategoryFromDocument(documentId: number, categoryId: number): boolean {
  try {
    db.prepare(
      `DELETE FROM document_categories WHERE documentId = ? AND categoryId = ?`
    ).run(documentId, categoryId);
    return true;
  } catch (error) {
    console.error("[DB] Error removing category from document:", error);
    return false;
  }
}

export function getDocumentsByCategory(categoryId: number): DocumentRecord[] {
  return db.prepare<[number], DocumentRecord>(
    `SELECT d.* FROM documents d
     INNER JOIN document_categories dc ON d.id = dc.documentId
     WHERE dc.categoryId = ?
     ORDER BY d.title`
  ).all(categoryId);
}

export function getCategoryColors(): string[] {
  return [...DEFAULT_COLORS];
}

export function importCategoriesFromFolders(): number {
  const docs = db.prepare<[], { id: number; filePath: string }>(
    `SELECT id, filePath FROM documents WHERE filePath IS NOT NULL`
  ).all();
  
  let imported = 0;
  
  for (const doc of docs) {
    const relativePath = path.relative(
      path.join(app.getPath("userData"), "library"),
      doc.filePath
    );
    const pathParts = relativePath.split(path.sep);
    
    if (pathParts.length > 1) {
      const folderName = pathParts[0];
      
      let category = db.prepare<[string], { id: number }>(
        `SELECT id FROM categories WHERE name = ?`
      ).get(folderName);
      
      if (!category) {
        const result = db.prepare(`INSERT INTO categories (name, color) VALUES (?, ?)`).run(
          folderName,
          DEFAULT_COLORS[imported % DEFAULT_COLORS.length]
        );
        category = { id: result.lastInsertRowid as number };
      }
      
      const existing = db.prepare<[number, number], { documentId: number }>(
        `SELECT documentId FROM document_categories WHERE documentId = ? AND categoryId = ?`
      ).get(doc.id, category.id);
      
      if (!existing) {
        db.prepare(
          `INSERT INTO document_categories (documentId, categoryId) VALUES (?, ?)`
        ).run(doc.id, category.id);
        imported++;
      }
    }
  }
  
  return imported;
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
        annotations = ?,
        readingStatus = CASE
          WHEN readingStatus IS NULL AND COALESCE(numPages, 0) > 1 AND ? >= numPages THEN 'read'
          WHEN readingStatus IS NULL AND ? > 1 THEN 'reading'
          ELSE readingStatus
        END,
        completedAt = CASE
          WHEN readingStatus IS NULL AND COALESCE(numPages, 0) > 1 AND ? >= numPages THEN COALESCE(completedAt, CURRENT_TIMESTAMP)
          ELSE completedAt
        END
    WHERE fileHash = ?
    `);

  statement.run(
    state.currentPage,
    state.currentZoom,
    state.currentScroll,
    state.annotations,
    state.currentPage,
    state.currentPage,
    state.currentPage,
    fileHash,
  );
}

function assertReadingStatus(status: ReadingStatus): void {
  if (status !== "want_to_read" && status !== "reading" && status !== "paused" && status !== "read") {
    throw new Error("Invalid reading status");
  }
}

export function updateReadingStatus(fileHash: string, status: ReadingStatus): boolean {
  assertReadingStatus(status);

  const result = db.prepare(`
    UPDATE documents
    SET readingStatus = ?,
        completedAt = CASE
          WHEN ? = 'read' THEN COALESCE(completedAt, CURRENT_TIMESTAMP)
          ELSE NULL
        END,
        updatedAt = CURRENT_TIMESTAMP
    WHERE fileHash = ?
  `).run(status, status, fileHash);

  return result.changes > 0;
}

function toReadingMapSection(row: ReadingMapSectionRow): ReadingMapSection {
  return {
    id: row.id,
    mapId: row.mapId,
    title: row.title,
    description: row.description,
    order: row.orderIndex,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function inferDocumentReadingStatus(doc: DocumentRecord): ReadingStatus {
  if (doc.readingStatus) {
    return doc.readingStatus;
  }

  const currentPage = Math.max(0, Number(doc.currentPage) || 0);
  const numPages = Math.max(0, Number(doc.numPages) || 0);
  if (numPages > 1 && currentPage >= numPages) return "read";
  if (currentPage > 1) return "reading";
  return "want_to_read";
}

function toReadingMapItem(row: ReadingMapItemRow): ReadingMapItem {
  const book = row.bookId ? getDocumentByHash(row.bookId) : null;
  const storedStatus = row.status && (
    row.status === "want_to_read" ||
    row.status === "reading" ||
    row.status === "paused" ||
    row.status === "read"
  )
    ? row.status
    : "want_to_read";
  const status = book ? inferDocumentReadingStatus(book) : storedStatus;

  return {
    id: row.id,
    sectionId: row.sectionId,
    bookId: row.bookId,
    title: row.title,
    author: row.author,
    coverPath: row.coverPath,
    status,
    order: row.orderIndex,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    book: book || null,
    missingDocument: Boolean(row.bookId && !book),
  };
}

function getReadingMapById(mapId: string): ReadingMap | undefined {
  return db.prepare<[string], ReadingMap>(
    `SELECT * FROM reading_maps WHERE id = ?`,
  ).get(mapId);
}

function insertDefaultSections(mapId: string): void {
  const insert = db.prepare(`
    INSERT INTO reading_map_sections (id, mapId, title, description, orderIndex)
    VALUES (?, ?, ?, ?, ?)
  `);

  DEFAULT_READING_MAP_SECTIONS.forEach((section, index) => {
    insert.run(
      `${mapId}-section-${index + 1}`,
      mapId,
      section.title,
      section.description,
      index,
    );
  });
}

function ensureDefaultReadingMap(): ReadingMap {
  let map = db.prepare<[], ReadingMap>(
    `SELECT * FROM reading_maps ORDER BY datetime(createdAt) ASC LIMIT 1`,
  ).get();

  if (!map) {
    db.prepare(`
      INSERT INTO reading_maps (id, title, description)
      VALUES (?, ?, ?)
    `).run(
      DEFAULT_READING_MAP_ID,
      "Meu Mapa de Leitura",
      "Uma trilha inicial para organizar leituras atuais e futuras.",
    );
    insertDefaultSections(DEFAULT_READING_MAP_ID);
    map = getReadingMapById(DEFAULT_READING_MAP_ID);
  }

  if (!map) {
    throw new Error("Could not create reading map");
  }

  const sectionCount = db.prepare<[string], { count: number }>(
    `SELECT COUNT(*) as count FROM reading_map_sections WHERE mapId = ?`,
  ).get(map.id)?.count ?? 0;

  if (sectionCount === 0) {
    insertDefaultSections(map.id);
  }

  return map;
}

export function listReadingMaps(): ReadingMap[] {
  ensureDefaultReadingMap();
  return db.prepare<[], ReadingMap>(
    `SELECT * FROM reading_maps ORDER BY datetime(updatedAt) DESC, datetime(createdAt) ASC`,
  ).all();
}

export function getReadingMapPayload(mapId?: string | null): ReadingMapPayload {
  const maps = listReadingMaps();
  const activeMap =
    (mapId ? maps.find((map) => map.id === mapId) : undefined) ||
    maps[0] ||
    ensureDefaultReadingMap();

  const sectionRows = db.prepare<[string], ReadingMapSectionRow>(
    `SELECT * FROM reading_map_sections WHERE mapId = ? ORDER BY orderIndex ASC, datetime(createdAt) ASC`,
  ).all(activeMap.id);
  const itemRows = db.prepare<[string], ReadingMapItemRow>(
    `SELECT i.* FROM reading_map_items i
     INNER JOIN reading_map_sections s ON s.id = i.sectionId
     WHERE s.mapId = ?
     ORDER BY i.orderIndex ASC, datetime(i.createdAt) ASC`,
  ).all(activeMap.id);
  const itemsBySection = new Map<string, ReadingMapItem[]>();

  for (const itemRow of itemRows) {
    const items = itemsBySection.get(itemRow.sectionId) || [];
    items.push(toReadingMapItem(itemRow));
    itemsBySection.set(itemRow.sectionId, items);
  }

  const sections: ReadingMapSectionWithItems[] = sectionRows.map((row) => ({
    ...toReadingMapSection(row),
    items: itemsBySection.get(row.id) || [],
  }));

  return {
    maps,
    activeMap,
    sections,
  };
}

export function createReadingMap(title: string, description?: string | null): ReadingMapPayload {
  const cleanTitle = title.trim();
  if (!cleanTitle) throw new Error("Informe o nome do mapa");

  const id = `map-${randomUUID()}`;
  db.prepare(`
    INSERT INTO reading_maps (id, title, description)
    VALUES (?, ?, ?)
  `).run(id, cleanTitle, description?.trim() || null);
  insertDefaultSections(id);

  return getReadingMapPayload(id);
}

function touchReadingMapBySection(sectionId: string): void {
  db.prepare(`
    UPDATE reading_maps
    SET updatedAt = CURRENT_TIMESTAMP
    WHERE id = (SELECT mapId FROM reading_map_sections WHERE id = ?)
  `).run(sectionId);
}

export function createReadingMapSection(
  mapId: string,
  title: string,
  description = "",
): ReadingMapPayload {
  const cleanTitle = title.trim();
  if (!cleanTitle) throw new Error("Informe o nome da etapa");
  if (!getReadingMapById(mapId)) throw new Error("Mapa nao encontrado");

  const nextOrder = (db.prepare<[string], { value: number }>(
    `SELECT COALESCE(MAX(orderIndex), -1) + 1 as value FROM reading_map_sections WHERE mapId = ?`,
  ).get(mapId)?.value ?? 0);
  db.prepare(`
    INSERT INTO reading_map_sections (id, mapId, title, description, orderIndex)
    VALUES (?, ?, ?, ?, ?)
  `).run(`section-${randomUUID()}`, mapId, cleanTitle, description.trim(), nextOrder);
  db.prepare(`UPDATE reading_maps SET updatedAt = CURRENT_TIMESTAMP WHERE id = ?`).run(mapId);

  return getReadingMapPayload(mapId);
}

export function updateReadingMapSection(
  sectionId: string,
  updates: { title?: string; description?: string },
): ReadingMapPayload {
  const section = db.prepare<[string], ReadingMapSectionRow>(
    `SELECT * FROM reading_map_sections WHERE id = ?`,
  ).get(sectionId);
  if (!section) throw new Error("Etapa nao encontrada");

  const nextTitle = updates.title !== undefined ? updates.title.trim() : section.title;
  const nextDescription = updates.description !== undefined ? updates.description.trim() : section.description;
  if (!nextTitle) throw new Error("Informe o nome da etapa");

  db.prepare(`
    UPDATE reading_map_sections
    SET title = ?, description = ?, updatedAt = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(nextTitle, nextDescription, sectionId);
  touchReadingMapBySection(sectionId);

  return getReadingMapPayload(section.mapId);
}

function nextItemOrder(sectionId: string): number {
  return db.prepare<[string], { value: number }>(
    `SELECT COALESCE(MAX(orderIndex), -1) + 1 as value FROM reading_map_items WHERE sectionId = ?`,
  ).get(sectionId)?.value ?? 0;
}

function getSectionMapId(sectionId: string): string {
  const section = db.prepare<[string], { mapId: string }>(
    `SELECT mapId FROM reading_map_sections WHERE id = ?`,
  ).get(sectionId);
  if (!section) throw new Error("Etapa nao encontrada");
  return section.mapId;
}

export function addLibraryBookToReadingMapSection(
  sectionId: string,
  fileHash: string,
): ReadingMapPayload {
  const mapId = getSectionMapId(sectionId);
  const doc = getDocumentByHash(fileHash);
  if (!doc) throw new Error("Livro nao encontrado");

  db.prepare(`
    INSERT INTO reading_map_items (id, sectionId, bookId, title, author, coverPath, status, orderIndex)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    `item-${randomUUID()}`,
    sectionId,
    fileHash,
    doc.title,
    doc.author || null,
    doc.thumbnailPath || null,
    inferDocumentReadingStatus(doc),
    nextItemOrder(sectionId),
  );
  touchReadingMapBySection(sectionId);

  return getReadingMapPayload(mapId);
}

export function addManualBookToReadingMapSection(
  sectionId: string,
  data: { title: string; author?: string | null; status?: ReadingStatus },
): ReadingMapPayload {
  const mapId = getSectionMapId(sectionId);
  const title = data.title.trim();
  if (!title) throw new Error("Informe o titulo do livro");
  const status = data.status || "want_to_read";
  assertReadingStatus(status);

  db.prepare(`
    INSERT INTO reading_map_items (id, sectionId, bookId, title, author, coverPath, status, orderIndex)
    VALUES (?, ?, NULL, ?, ?, NULL, ?, ?)
  `).run(
    `item-${randomUUID()}`,
    sectionId,
    title,
    data.author?.trim() || null,
    status,
    nextItemOrder(sectionId),
  );
  touchReadingMapBySection(sectionId);

  return getReadingMapPayload(mapId);
}

export function updateReadingMapItemStatus(
  itemId: string,
  status: ReadingStatus,
): ReadingMapPayload {
  assertReadingStatus(status);
  const item = db.prepare<[string], ReadingMapItemRow>(
    `SELECT * FROM reading_map_items WHERE id = ?`,
  ).get(itemId);
  if (!item) throw new Error("Item nao encontrado");

  db.prepare(`
    UPDATE reading_map_items
    SET status = ?, updatedAt = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(status, itemId);
  if (item.bookId) {
    updateReadingStatus(item.bookId, status);
  }
  touchReadingMapBySection(item.sectionId);

  return getReadingMapPayload(getSectionMapId(item.sectionId));
}

function normalizeReadingMapItemOrder(sectionId: string): void {
  const items = db.prepare<[string], { id: string }>(
    `SELECT id FROM reading_map_items WHERE sectionId = ? ORDER BY orderIndex ASC, datetime(createdAt) ASC`,
  ).all(sectionId);
  const update = db.prepare(`UPDATE reading_map_items SET orderIndex = ? WHERE id = ?`);
  items.forEach((item, index) => update.run(index, item.id));
}

export function reorderReadingMapItem(
  itemId: string,
  direction: "up" | "down",
): ReadingMapPayload {
  const item = db.prepare<[string], ReadingMapItemRow>(
    `SELECT * FROM reading_map_items WHERE id = ?`,
  ).get(itemId);
  if (!item) throw new Error("Item nao encontrado");

  const items = db.prepare<[string], ReadingMapItemRow>(
    `SELECT * FROM reading_map_items WHERE sectionId = ? ORDER BY orderIndex ASC, datetime(createdAt) ASC`,
  ).all(item.sectionId);
  const index = items.findIndex((candidate) => candidate.id === itemId);
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || targetIndex < 0 || targetIndex >= items.length) {
    return getReadingMapPayload(getSectionMapId(item.sectionId));
  }

  const update = db.prepare(`UPDATE reading_map_items SET orderIndex = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`);
  update.run(items[targetIndex].orderIndex, item.id);
  update.run(item.orderIndex, items[targetIndex].id);
  normalizeReadingMapItemOrder(item.sectionId);
  touchReadingMapBySection(item.sectionId);

  return getReadingMapPayload(getSectionMapId(item.sectionId));
}

export function moveReadingMapItem(
  itemId: string,
  targetSectionId: string,
): ReadingMapPayload {
  const item = db.prepare<[string], ReadingMapItemRow>(
    `SELECT * FROM reading_map_items WHERE id = ?`,
  ).get(itemId);
  if (!item) throw new Error("Item nao encontrado");
  const mapId = getSectionMapId(targetSectionId);

  db.prepare(`
    UPDATE reading_map_items
    SET sectionId = ?, orderIndex = ?, updatedAt = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(targetSectionId, nextItemOrder(targetSectionId), itemId);
  normalizeReadingMapItemOrder(item.sectionId);
  normalizeReadingMapItemOrder(targetSectionId);
  touchReadingMapBySection(targetSectionId);

  return getReadingMapPayload(mapId);
}

export function positionReadingMapItem(
  itemId: string,
  targetSectionId: string,
  targetIndex: number,
): ReadingMapPayload {
  const item = db.prepare<[string], ReadingMapItemRow>(
    `SELECT * FROM reading_map_items WHERE id = ?`,
  ).get(itemId);
  if (!item) throw new Error("Item nao encontrado");

  const mapId = getSectionMapId(targetSectionId);
  const targetItems = db.prepare<[string, string], { id: string }>(
    `SELECT id FROM reading_map_items
     WHERE sectionId = ? AND id <> ?
     ORDER BY orderIndex ASC, datetime(createdAt) ASC`,
  ).all(targetSectionId, itemId);
  const boundedIndex = Math.max(0, Math.min(Math.floor(targetIndex), targetItems.length));
  const orderedIds = targetItems.map((candidate) => candidate.id);
  orderedIds.splice(boundedIndex, 0, itemId);

  const updateItem = db.prepare(`
    UPDATE reading_map_items
    SET sectionId = ?, orderIndex = ?, updatedAt = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  const transaction = db.transaction(() => {
    orderedIds.forEach((id, index) => {
      updateItem.run(targetSectionId, index, id);
    });
    if (item.sectionId !== targetSectionId) {
      normalizeReadingMapItemOrder(item.sectionId);
    }
    touchReadingMapBySection(targetSectionId);
  });
  transaction();

  return getReadingMapPayload(mapId);
}

export function deleteReadingMapItem(itemId: string): ReadingMapPayload {
  const item = db.prepare<[string], ReadingMapItemRow>(
    `SELECT * FROM reading_map_items WHERE id = ?`,
  ).get(itemId);
  if (!item) throw new Error("Item nao encontrado");
  const mapId = getSectionMapId(item.sectionId);

  db.prepare(`DELETE FROM reading_map_items WHERE id = ?`).run(itemId);
  normalizeReadingMapItemOrder(item.sectionId);
  touchReadingMapBySection(item.sectionId);

  return getReadingMapPayload(mapId);
}

function normalizeReadingStatus(status: ReadingStatus): ReadingStatus {
  assertReadingStatus(status);
  return status;
}

function getAtlasSetting(key: string): string | null {
  return db.prepare<[string], { value: string | null }>(
    `SELECT value FROM atlas_settings WHERE key = ?`,
  ).get(key)?.value ?? null;
}

function setAtlasSetting(key: string, value: string | null): void {
  db.prepare(`
    INSERT INTO atlas_settings (key, value, updatedAt)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = CURRENT_TIMESTAMP
  `).run(key, value);
}

export function getAtlasNotesVaultPath(): string | null {
  return getAtlasSetting(ATLAS_NOTES_VAULT_SETTING_KEY);
}

export function setAtlasNotesVaultPath(vaultPath: string | null): ReadingStatusPayload {
  setAtlasSetting(ATLAS_NOTES_VAULT_SETTING_KEY, vaultPath?.trim() || null);
  return getReadingStatusPayload();
}

function getReadingStatusLocalProgressPages(itemId: string): number {
  return db.prepare<[string], { pages: number }>(
    `SELECT COALESCE(SUM(pages), 0) as pages
     FROM reading_status_progress_events
     WHERE statusItemId = ?`,
  ).get(itemId)?.pages ?? 0;
}

function toReadingStatusItem(row: ReadingStatusItemRow): ReadingStatusItem {
  const book = row.bookId ? getDocumentByHash(row.bookId) : null;
  const status = row.status && (
    row.status === "want_to_read" ||
    row.status === "reading" ||
    row.status === "paused" ||
    row.status === "read"
  )
    ? row.status
    : "want_to_read";

  return {
    id: row.id,
    bookId: row.bookId,
    title: row.title,
    author: row.author,
    coverPath: row.coverPath,
    description: row.description ?? book?.description ?? null,
    isbn: row.isbn ?? book?.isbn ?? null,
    publisher: row.publisher ?? book?.publisher ?? null,
    publishDate: row.publishDate ?? book?.publishDate ?? null,
    subject: row.subject ?? book?.subject ?? null,
    status,
    order: row.orderIndex,
    isPrimary: Boolean(row.isPrimary),
    manualBasePage: Math.max(0, Number(row.manualBasePage) || 0),
    manualCurrentPage: Math.max(0, Number(row.manualCurrentPage) || 0),
    manualTotalPages: row.manualTotalPages ?? null,
    localProgressPages: getReadingStatusLocalProgressPages(row.id),
    notePath: row.notePath,
    notesMarkdown: row.notesMarkdown,
    rating: Math.max(0, Math.min(10, Number(row.rating) || 0)),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    book: book || null,
    missingDocument: Boolean(row.bookId && !book),
  };
}

function nextReadingStatusItemOrder(status: ReadingStatus): number {
  return db.prepare<[string], { value: number }>(
    `SELECT COALESCE(MAX(orderIndex), -1) + 1 as value
     FROM reading_status_items
     WHERE status = ?`,
  ).get(status)?.value ?? 0;
}

function normalizeReadingStatusItemOrder(status: ReadingStatus): void {
  const items = db.prepare<[string], { id: string }>(
    `SELECT id FROM reading_status_items
     WHERE status = ?
     ORDER BY orderIndex ASC, datetime(createdAt) ASC`,
  ).all(status);
  const update = db.prepare(`UPDATE reading_status_items SET orderIndex = ? WHERE id = ?`);
  items.forEach((item, index) => update.run(index, item.id));
}

export function getReadingStatusPayload(): ReadingStatusPayload {
  const rows = db.prepare<[], ReadingStatusItemRow>(
    `SELECT * FROM reading_status_items
     ORDER BY
       CASE status
         WHEN 'want_to_read' THEN 0
         WHEN 'reading' THEN 1
         WHEN 'paused' THEN 2
         WHEN 'read' THEN 3
         ELSE 4
       END,
       isPrimary DESC,
       orderIndex ASC,
       datetime(createdAt) ASC`,
  ).all();

  return {
    items: rows.map(toReadingStatusItem),
    vaultPath: getAtlasNotesVaultPath(),
  };
}

export function addLibraryBookToReadingStatus(
  status: ReadingStatus,
  fileHash: string,
): ReadingStatusPayload {
  const cleanStatus = normalizeReadingStatus(status);
  const doc = getDocumentByHash(fileHash);
  if (!doc) throw new Error("Livro nao encontrado");

  const existing = db.prepare<[string], ReadingStatusItemRow>(
    `SELECT * FROM reading_status_items WHERE bookId = ? ORDER BY datetime(createdAt) ASC LIMIT 1`,
  ).get(fileHash);

  if (existing) {
    db.prepare(`
      UPDATE reading_status_items
      SET status = ?,
          title = ?,
          author = ?,
          coverPath = ?,
          description = ?,
          isbn = ?,
          publisher = ?,
          publishDate = ?,
          subject = ?,
          manualTotalPages = COALESCE(manualTotalPages, ?),
          orderIndex = ?,
          updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      cleanStatus,
      doc.title,
      doc.author || null,
      doc.thumbnailPath || null,
      doc.description || null,
      doc.isbn || null,
      doc.publisher || null,
      doc.publishDate || null,
      doc.subject || null,
      doc.numPages || null,
      nextReadingStatusItemOrder(cleanStatus),
      existing.id,
    );
    if (existing.status !== cleanStatus) {
      normalizeReadingStatusItemOrder(existing.status);
    }
  } else {
    db.prepare(`
      INSERT INTO reading_status_items (
        id, bookId, title, author, coverPath, description, isbn, publisher, publishDate, subject,
        status, orderIndex, isPrimary, manualBasePage, manualCurrentPage, manualTotalPages
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?)
    `).run(
      `status-item-${randomUUID()}`,
      fileHash,
      doc.title,
      doc.author || null,
      doc.thumbnailPath || null,
      doc.description || null,
      doc.isbn || null,
      doc.publisher || null,
      doc.publishDate || null,
      doc.subject || null,
      cleanStatus,
      nextReadingStatusItemOrder(cleanStatus),
      doc.numPages || null,
    );
  }

  updateReadingStatus(fileHash, cleanStatus);

  return getReadingStatusPayload();
}

export function addManualBookToReadingStatus(
  data: { title: string; author?: string | null; status: ReadingStatus },
): ReadingStatusPayload {
  const title = data.title.trim();
  if (!title) throw new Error("Informe o titulo do livro");
  const status = normalizeReadingStatus(data.status || "want_to_read");

  db.prepare(`
    INSERT INTO reading_status_items (
      id, bookId, title, author, coverPath, status, orderIndex, isPrimary, manualBasePage, manualCurrentPage, manualTotalPages
    )
    VALUES (?, NULL, ?, ?, NULL, ?, ?, 0, 0, 0, NULL)
  `).run(
    `status-item-${randomUUID()}`,
    title,
    data.author?.trim() || null,
    status,
    nextReadingStatusItemOrder(status),
  );

  return getReadingStatusPayload();
}

export function updateReadingStatusItemStatus(
  itemId: string,
  status: ReadingStatus,
): ReadingStatusPayload {
  const cleanStatus = normalizeReadingStatus(status);
  const item = db.prepare<[string], ReadingStatusItemRow>(
    `SELECT * FROM reading_status_items WHERE id = ?`,
  ).get(itemId);
  if (!item) throw new Error("Item nao encontrado");

  db.prepare(`
    UPDATE reading_status_items
    SET status = ?, orderIndex = ?, isPrimary = CASE WHEN ? = 'reading' THEN isPrimary ELSE 0 END, updatedAt = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(cleanStatus, nextReadingStatusItemOrder(cleanStatus), cleanStatus, itemId);

  normalizeReadingStatusItemOrder(item.status);
  normalizeReadingStatusItemOrder(cleanStatus);
  if (item.bookId) updateReadingStatus(item.bookId, cleanStatus);

  return getReadingStatusPayload();
}

export function positionReadingStatusItem(
  itemId: string,
  status: ReadingStatus,
  targetIndex: number,
): ReadingStatusPayload {
  const cleanStatus = normalizeReadingStatus(status);
  const item = db.prepare<[string], ReadingStatusItemRow>(
    `SELECT * FROM reading_status_items WHERE id = ?`,
  ).get(itemId);
  if (!item) throw new Error("Item nao encontrado");

  const targetItems = db.prepare<[string, string], { id: string }>(
    `SELECT id FROM reading_status_items
     WHERE status = ? AND id <> ?
     ORDER BY orderIndex ASC, datetime(createdAt) ASC`,
  ).all(cleanStatus, itemId);
  const boundedIndex = Math.max(0, Math.min(Math.floor(targetIndex), targetItems.length));
  const orderedIds = targetItems.map((candidate) => candidate.id);
  orderedIds.splice(boundedIndex, 0, itemId);

  const update = db.prepare(`
    UPDATE reading_status_items
    SET status = ?, orderIndex = ?, isPrimary = CASE WHEN ? = 'reading' THEN isPrimary ELSE 0 END, updatedAt = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  const transaction = db.transaction(() => {
    orderedIds.forEach((id, index) => update.run(cleanStatus, index, cleanStatus, id));
    if (item.status !== cleanStatus) normalizeReadingStatusItemOrder(item.status);
    if (item.bookId) updateReadingStatus(item.bookId, cleanStatus);
  });
  transaction();

  return getReadingStatusPayload();
}

export function updateReadingStatusItemProgress(
  itemId: string,
  updates: { manualBasePage?: number; manualCurrentPage?: number; manualTotalPages?: number | null },
): ReadingStatusPayload {
  const item = db.prepare<[string], ReadingStatusItemRow>(
    `SELECT * FROM reading_status_items WHERE id = ?`,
  ).get(itemId);
  if (!item) throw new Error("Item nao encontrado");

  const nextBasePage = updates.manualBasePage === undefined
    ? item.manualBasePage
    : Math.max(0, Math.floor(Number(updates.manualBasePage) || 0));
  const nextCurrentPage = updates.manualCurrentPage === undefined
    ? item.manualCurrentPage
    : Math.max(0, Math.floor(Number(updates.manualCurrentPage) || 0));
  const nextTotalPages = updates.manualTotalPages === undefined
    ? item.manualTotalPages
    : updates.manualTotalPages === null
      ? null
      : Math.max(1, Math.floor(Number(updates.manualTotalPages) || 1));

  db.prepare(`
    UPDATE reading_status_items
    SET manualBasePage = ?, manualCurrentPage = ?, manualTotalPages = ?, updatedAt = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(nextBasePage, nextCurrentPage, nextTotalPages, itemId);

  if (item.bookId && nextTotalPages) {
    updateDocumentNumPages(item.bookId, nextTotalPages);
  }

  return getReadingStatusPayload();
}

export function setPrimaryReadingStatusItem(itemId: string): ReadingStatusPayload {
  const item = db.prepare<[string], ReadingStatusItemRow>(
    `SELECT * FROM reading_status_items WHERE id = ?`,
  ).get(itemId);
  if (!item) throw new Error("Item nao encontrado");

  const transaction = db.transaction(() => {
    db.prepare(`UPDATE reading_status_items SET isPrimary = 0 WHERE status = 'reading'`).run();
    db.prepare(`
      UPDATE reading_status_items
      SET status = 'reading',
          isPrimary = 1,
          orderIndex = CASE WHEN status = 'reading' THEN orderIndex ELSE ? END,
          updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(nextReadingStatusItemOrder("reading"), itemId);
    if (item.status !== "reading") normalizeReadingStatusItemOrder(item.status);
    normalizeReadingStatusItemOrder("reading");
    if (item.bookId) updateReadingStatus(item.bookId, "reading");
  });
  transaction();

  return getReadingStatusPayload();
}

export function updateReadingStatusItemCover(itemId: string, coverPath: string | null): ReadingStatusPayload {
  const item = db.prepare<[string], ReadingStatusItemRow>(
    `SELECT * FROM reading_status_items WHERE id = ?`,
  ).get(itemId);
  if (!item) throw new Error("Item nao encontrado");

  let savedPath: string | null = null;
  if (coverPath && fs.existsSync(coverPath)) {
    const thumbnailsDir = path.join(app.getPath("userData"), "thumbnails");
    if (!fs.existsSync(thumbnailsDir)) fs.mkdirSync(thumbnailsDir, { recursive: true });
    const ext = path.extname(coverPath).toLowerCase() || ".jpg";
    const destName = `${itemId}-cover${ext}`;
    const destPath = path.join(thumbnailsDir, destName);
    fs.copyFileSync(coverPath, destPath);
    savedPath = destPath;
  }

  db.prepare(`
    UPDATE reading_status_items
    SET coverPath = ?, updatedAt = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(savedPath, itemId);

  return getReadingStatusPayload();
}

export function updateReadingStatusItemMetadata(
  itemId: string,
  updates: {
    title?: string;
    author?: string | null;
    description?: string | null;
    isbn?: string | null;
    publisher?: string | null;
    publishDate?: string | null;
    subject?: string | null;
    manualTotalPages?: number | null;
    coverPath?: string | null;
    rating?: number;
  },
): ReadingStatusPayload {
  const item = db.prepare<[string], ReadingStatusItemRow>(
    `SELECT * FROM reading_status_items WHERE id = ?`,
  ).get(itemId);
  if (!item) throw new Error("Item nao encontrado");

  const nextTitle = updates.title === undefined ? item.title : updates.title.trim();
  if (!nextTitle) throw new Error("Informe o titulo do livro");
  const nextTotalPages = updates.manualTotalPages === undefined
    ? item.manualTotalPages
    : updates.manualTotalPages === null
      ? null
      : Math.max(1, Math.floor(Number(updates.manualTotalPages) || 1));

  const nextRating = updates.rating === undefined
    ? item.rating
    : Math.max(0, Math.min(10, Number(updates.rating) || 0));

  db.prepare(`
    UPDATE reading_status_items
    SET title = ?,
        author = ?,
        description = ?,
        isbn = ?,
        publisher = ?,
        publishDate = ?,
        subject = ?,
        manualTotalPages = ?,
        coverPath = ?,
        rating = ?,
        updatedAt = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    nextTitle,
    updates.author === undefined ? item.author : updates.author?.trim() || null,
    updates.description === undefined ? item.description : updates.description?.trim() || null,
    updates.isbn === undefined ? item.isbn : updates.isbn?.trim() || null,
    updates.publisher === undefined ? item.publisher : updates.publisher?.trim() || null,
    updates.publishDate === undefined ? item.publishDate : updates.publishDate?.trim() || null,
    updates.subject === undefined ? item.subject : updates.subject?.trim() || null,
    nextTotalPages,
    updates.coverPath === undefined ? item.coverPath : updates.coverPath?.trim() || null,
    nextRating,
    itemId,
  );

  if (item.bookId && nextTotalPages) {
    updateDocumentNumPages(item.bookId, nextTotalPages);
  }

  return getReadingStatusPayload();
}

export function getReadingStatusItem(itemId: string): ReadingStatusItem {
  const row = db.prepare<[string], ReadingStatusItemRow>(
    `SELECT * FROM reading_status_items WHERE id = ?`,
  ).get(itemId);
  if (!row) throw new Error("Item nao encontrado");
  return toReadingStatusItem(row);
}

export function updateReadingStatusItemNotes(
  itemId: string,
  notesMarkdown: string,
  notePath?: string | null,
): ReadingStatusItem {
  const item = db.prepare<[string], ReadingStatusItemRow>(
    `SELECT * FROM reading_status_items WHERE id = ?`,
  ).get(itemId);
  if (!item) throw new Error("Item nao encontrado");

  db.prepare(`
    UPDATE reading_status_items
    SET notesMarkdown = ?, notePath = COALESCE(?, notePath), updatedAt = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(notesMarkdown, notePath || null, itemId);

  return getReadingStatusItem(itemId);
}

export function addReadingStatusProgressEvent(
  itemId: string,
  pages: number,
  note?: string | null,
): ReadingStatusPayload {
  const item = db.prepare<[string], ReadingStatusItemRow>(
    `SELECT * FROM reading_status_items WHERE id = ?`,
  ).get(itemId);
  if (!item) throw new Error("Item nao encontrado");

  const cleanPages = Math.max(0, Math.floor(Number(pages) || 0));
  if (cleanPages <= 0) throw new Error("Informe paginas lidas");

  db.prepare(`
    INSERT INTO reading_status_progress_events (id, statusItemId, pages, note)
    VALUES (?, ?, ?, ?)
  `).run(`status-progress-${randomUUID()}`, itemId, cleanPages, note?.trim() || null);
  db.prepare(`UPDATE reading_status_items SET updatedAt = CURRENT_TIMESTAMP WHERE id = ?`).run(itemId);

  return getReadingStatusPayload();
}

export function deleteReadingStatusItem(itemId: string): ReadingStatusPayload {
  const item = db.prepare<[string], ReadingStatusItemRow>(
    `SELECT * FROM reading_status_items WHERE id = ?`,
  ).get(itemId);
  if (!item) throw new Error("Item nao encontrado");

  db.prepare(`DELETE FROM reading_status_items WHERE id = ?`).run(itemId);
  normalizeReadingStatusItemOrder(item.status);

  return getReadingStatusPayload();
}

export function addDocument(
  title: string,
  filePath: string,
  fileHash: string,
  thumbnailPath: string | undefined,
  numPages: number = 1,
  fileType: BookFileType = "pdf",
  isSynced: number = 0,
) {
  const statement = db.prepare(`
        INSERT INTO documents (title, filePath, fileHash, fileName, folderPath, fileMtime, thumbnailPath, numPages, fileType, isSynced)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
  const result = statement.run(
    title,
    filePath,
    fileHash,
    getFileName(filePath),
    getFolderPath(filePath),
    getFileMtime(filePath),
    thumbnailPath || null,
    numPages,
    fileType,
    isSynced,
  );
  refreshDocumentSearchIndexById(result.lastInsertRowid as number);
  return result;
}
export function getAllDocuments(): DocumentRecord[] {
  return db.prepare<[], DocumentRecord>(`select * from documents`).all();
}

export function listDocuments(query: LibraryListQuery = {}): LibraryListResult {
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
    const fileTypes = String(query.fileType).split(",").map(t => t.trim().toLowerCase()).filter(Boolean);
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
      : path.join(app.getPath("userData"), "library", query.folderPath);
    const normalizedFolder = normalizeStoredPath(absoluteFolder);
    const normalizedFilePath = "REPLACE(d.filePath, '\\', '/')";

    if (query.includeSubfolders === false) {
      where.push(
        `(d.folderPath = ? OR (${normalizedFilePath} LIKE ? AND ${normalizedFilePath} NOT LIKE ?))`,
      );
      values.push(
        normalizedFolder,
        `${normalizedFolder}/%`,
        `${normalizedFolder}/%/%`,
      );
    } else {
      where.push(`(d.folderPath = ? OR d.folderPath LIKE ? OR ${normalizedFilePath} LIKE ?)`);
      values.push(normalizedFolder, `${normalizedFolder}/%`, `${normalizedFolder}/%`);
    }
  }

  const ftsQuery = query.search ? tokenizeSearch(query.search) : "";
  if (ftsQuery) {
    join = "INNER JOIN documents_fts fts ON fts.documentId = d.id";
    where.push("documents_fts MATCH ?");
    values.push(ftsQuery);
  }

  const orderBy: Record<LibrarySortOption, string> = {
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

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const baseSql = `FROM documents d ${join} ${whereSql}`;
  const total = db.prepare<unknown[], { total: number }>(
    `SELECT COUNT(*) as total ${baseSql}`
  ).get(...values)?.total ?? 0;

  const items = db.prepare<unknown[], DocumentRecord>(
    `SELECT d.* ${baseSql}
     ORDER BY ${orderBy[query.sort || "title"]}
     LIMIT ? OFFSET ?`
  ).all(...values, limit, offset);

  return {
    items,
    total,
    limit,
    offset,
    hasMore: offset + items.length < total,
  };
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

export function getDocumentByFilePath(
  filePath: string,
): DocumentRecord | undefined {
  return db
    .prepare<
      [string],
      DocumentRecord
    >(`select * from documents where filePath = ?`)
    .get(filePath);
}

export function getLastDocument(): DocumentRecord | undefined {
  return db
    .prepare<
      [],
      DocumentRecord
    >(`SELECT * FROM documents ORDER BY lastOpenedAt DESC LIMIT 1`)
    .get();
}

export function updateDocumentBookId(fileHash: string, bookId: string | null): void {
  db.prepare(
    `UPDATE documents SET bookId = ? WHERE fileHash = ?`
  ).run(bookId, fileHash);
}

export function getDocumentsByBookId(bookId: string): DocumentRecord[] {
  return db.prepare<[string], DocumentRecord>(
    `SELECT * FROM documents WHERE bookId = ?`
  ).all(bookId);
}

type SharedMetadata = Pick<
  DocumentRecord,
  | "title"
  | "author"
  | "description"
  | "isbn"
  | "publisher"
  | "publishDate"
  | "language"
  | "identifier"
  | "asin"
  | "subject"
  | "series"
  | "seriesIndex"
  | "authorSort"
  | "titleSort"
>;

const SHARED_METADATA_FIELDS: (keyof SharedMetadata)[] = [
  "title",
  "author",
  "description",
  "isbn",
  "publisher",
  "publishDate",
  "language",
  "identifier",
  "asin",
  "subject",
  "series",
  "seriesIndex",
  "authorSort",
  "titleSort",
];

function hasMeaningfulValue(value: unknown): boolean {
  return typeof value === "string" ? value.trim().length > 0 : value !== null && value !== undefined;
}

export function mergeDocuments(fileHashes: string[], bookId: string): {
  success: boolean;
  bookId: string;
  mergedCount: number;
  documents: DocumentRecord[];
  error?: string;
} {
  const uniqueHashes = Array.from(new Set(fileHashes.filter(Boolean)));
  if (uniqueHashes.length < 2) {
    return { success: false, bookId, mergedCount: 0, documents: [], error: "Selecione pelo menos dois livros" };
  }

  const selectedDocs = uniqueHashes
    .map((fileHash) => getDocumentByHash(fileHash))
    .filter((doc): doc is DocumentRecord => Boolean(doc));

  if (selectedDocs.length < 2) {
    return { success: false, bookId, mergedCount: 0, documents: [], error: "Livros nao encontrados" };
  }

  const existingBookIds = Array.from(
    new Set(selectedDocs.map((doc) => doc.bookId).filter((value): value is string => Boolean(value))),
  );
  const groupedDocs = existingBookIds.flatMap((existingBookId) => getDocumentsByBookId(existingBookId));
  const allDocsByHash = new Map<string, DocumentRecord>();
  for (const doc of [...selectedDocs, ...groupedDocs]) {
    allDocsByHash.set(doc.fileHash, doc);
  }

  const allDocs = Array.from(allDocsByHash.values());
  const canonical = selectedDocs[0];
  const sharedMetadata = SHARED_METADATA_FIELDS.reduce((metadata, field) => {
    const canonicalValue = canonical[field];
    const fallbackValue = allDocs.find((doc) => hasMeaningfulValue(doc[field]))?.[field] ?? null;
    return {
      ...metadata,
      [field]: hasMeaningfulValue(canonicalValue) ? canonicalValue : fallbackValue,
    };
  }, {} as SharedMetadata);
  const sharedThumbnailPath =
    canonical.thumbnailPath ||
    allDocs.find((doc) => hasMeaningfulValue(doc.thumbnailPath))?.thumbnailPath ||
    null;

  const updateSql = `
    UPDATE documents
    SET bookId = ?,
        title = ?,
        author = ?,
        description = ?,
        isbn = ?,
        publisher = ?,
        publishDate = ?,
        language = ?,
        identifier = ?,
        asin = ?,
        subject = ?,
        series = ?,
        seriesIndex = ?,
        authorSort = ?,
        titleSort = ?,
        thumbnailPath = COALESCE(?, thumbnailPath),
        updatedAt = CURRENT_TIMESTAMP
    WHERE fileHash = ?
  `;
  const update = db.prepare(updateSql);

  const updateMany = db.transaction((docs: DocumentRecord[]) => {
    for (const doc of docs) {
      update.run(
        bookId,
        sharedMetadata.title,
        sharedMetadata.author,
        sharedMetadata.description,
        sharedMetadata.isbn,
        sharedMetadata.publisher,
        sharedMetadata.publishDate,
        sharedMetadata.language,
        sharedMetadata.identifier,
        sharedMetadata.asin,
        sharedMetadata.subject,
        sharedMetadata.series,
        sharedMetadata.seriesIndex,
        sharedMetadata.authorSort,
        sharedMetadata.titleSort,
        sharedThumbnailPath,
        doc.fileHash,
      );
      refreshDocumentSearchIndex(doc.fileHash);
    }
  });

  updateMany(allDocs);

  return {
    success: true,
    bookId,
    mergedCount: allDocs.length,
    documents: allDocs.map((doc) => getDocumentByHash(doc.fileHash)).filter((doc): doc is DocumentRecord => Boolean(doc)),
  };
}

export function getDocumentByTitle(title: string): DocumentRecord | undefined {
  return db.prepare<[string], DocumentRecord>(
    `SELECT * FROM documents WHERE title = ? LIMIT 1`
  ).get(title);
}

export function getDocumentByPath(filePath: string): DocumentRecord | undefined {
  return db.prepare<[string], DocumentRecord>(
    `SELECT * FROM documents WHERE filePath = ? LIMIT 1`
  ).get(filePath);
}

export function updateDocumentPath(fileHash: string, newPath: string) {
  db.prepare(
    `
    UPDATE documents
    SET filePath = ?,
        fileName = ?,
        folderPath = ?,
        fileMtime = ?,
        updatedAt = CURRENT_TIMESTAMP
    WHERE fileHash = ?
  `,
  ).run(newPath, getFileName(newPath), getFolderPath(newPath), getFileMtime(newPath), fileHash);
  refreshDocumentSearchIndex(fileHash);
}

export function updateDocumentFileType(
  fileHash: string,
  fileType: BookFileType
) {
  db.prepare(
    `
    UPDATE documents
    SET fileType = ?,
        updatedAt = CURRENT_TIMESTAMP
    WHERE fileHash = ?
  `,
  ).run(fileType, fileHash);
  refreshDocumentSearchIndex(fileHash);
}

export function updateDocumentNumPages(fileHash: string, numPages: number) {
  db.prepare(
    `
    UPDATE documents
    SET numPages = ?
    WHERE fileHash = ?
  `,
  ).run(numPages, fileHash);
}

export function updateDocumentSyncStatus(fileHash: string, isSynced: boolean, category?: string) {
  db.prepare(
    `
    UPDATE documents
    SET isSynced = ?, category = ?, updatedAt = CURRENT_TIMESTAMP
    WHERE fileHash = ?
  `,
  ).run(isSynced ? 1 : 0, category || null, fileHash);
}

export function updateThumbnailPath(fileHash: string, thumbnailPath: string) {
  db.prepare(
    `
    UPDATE documents
    SET thumbnailPath = ?, updatedAt = CURRENT_TIMESTAMP
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

export function toggleFavorite(fileHash: string): boolean {
  const doc = getDocumentByHash(fileHash);
  if (!doc) return false;
  
  const newValue = doc.isFavorite === 1 ? 0 : 1;
  db.prepare(`UPDATE documents SET isFavorite = ?, updatedAt = CURRENT_TIMESTAMP WHERE fileHash = ?`).run(newValue, fileHash);
  return newValue === 1;
}

export function updateRating(fileHash: string, rating: number): void {
  db.prepare(`UPDATE documents SET rating = ?, updatedAt = CURRENT_TIMESTAMP WHERE fileHash = ?`).run(rating, fileHash);
}

export function updateNotes(fileHash: string, notes: string): void {
  db.prepare(`UPDATE documents SET notes = ?, updatedAt = CURRENT_TIMESTAMP WHERE fileHash = ?`).run(notes, fileHash);
}

export function updateMetadata(
  fileHash: string,
  metadata: {
    title?: string;
    author?: string;
    description?: string;
    isbn?: string;
    publisher?: string;
    publishDate?: string;
    language?: string;
    identifier?: string;
    asin?: string;
    subject?: string;
    series?: string;
    seriesIndex?: string;
    authorSort?: string;
    titleSort?: string;
  }
): void {
  const sets: string[] = [];
  const values: any[] = [];
  
  if (metadata.title !== undefined) {
    sets.push("title = ?");
    values.push(metadata.title);
  }

  if (metadata.author !== undefined) {
    sets.push("author = ?");
    values.push(metadata.author);
  }
  if (metadata.description !== undefined) {
    sets.push("description = ?");
    values.push(metadata.description);
  }
  if (metadata.isbn !== undefined) {
    sets.push("isbn = ?");
    values.push(metadata.isbn);
  }
  if (metadata.publisher !== undefined) {
    sets.push("publisher = ?");
    values.push(metadata.publisher);
  }
  if (metadata.publishDate !== undefined) {
    sets.push("publishDate = ?");
    values.push(metadata.publishDate);
  }
  if (metadata.language !== undefined) {
    sets.push("language = ?");
    values.push(metadata.language);
  }
  if (metadata.identifier !== undefined) {
    sets.push("identifier = ?");
    values.push(metadata.identifier);
  }
  if (metadata.asin !== undefined) {
    sets.push("asin = ?");
    values.push(metadata.asin);
  }
  if (metadata.subject !== undefined) {
    sets.push("subject = ?");
    values.push(metadata.subject);
  }
  if (metadata.series !== undefined) {
    sets.push("series = ?");
    values.push(metadata.series);
  }
  if (metadata.seriesIndex !== undefined) {
    sets.push("seriesIndex = ?");
    values.push(metadata.seriesIndex);
  }
  if (metadata.authorSort !== undefined) {
    sets.push("authorSort = ?");
    values.push(metadata.authorSort);
  }
  if (metadata.titleSort !== undefined) {
    sets.push("titleSort = ?");
    values.push(metadata.titleSort);
  }
  
  if (sets.length > 0) {
    sets.push("updatedAt = CURRENT_TIMESTAMP");
    values.push(fileHash);
    db.prepare(`UPDATE documents SET ${sets.join(", ")} WHERE fileHash = ?`).run(...values);
    refreshDocumentSearchIndex(fileHash);
  }
}

export function updateProcessingStatus(
  fileHash: string,
  status: "pending" | "processing" | "completed" | "failed"
): void {
  db.prepare(`UPDATE documents SET processingStatus = ?, updatedAt = CURRENT_TIMESTAMP WHERE fileHash = ?`).run(status, fileHash);
}

export function getDocumentsPendingProcessing(): DocumentRecord[] {
  return db.prepare<[], DocumentRecord>(
    `SELECT * FROM documents WHERE processingStatus = 'pending' OR processingStatus = 'failed'`
  ).all();
}

export function updateFileSize(fileHash: string, fileSize: number): void {
  db.prepare(`UPDATE documents SET fileSize = ?, updatedAt = CURRENT_TIMESTAMP WHERE fileHash = ?`).run(fileSize, fileHash);
}

export function updateDocumentFileIdentity(
  oldFileHash: string,
  newFileHash: string,
  filePath: string,
  fileSize: number,
): void {
  db.prepare(
    `
    UPDATE documents
    SET fileHash = ?,
        filePath = ?,
        fileName = ?,
        folderPath = ?,
        fileMtime = ?,
        fileSize = ?,
        updatedAt = CURRENT_TIMESTAMP
    WHERE fileHash = ?
  `,
  ).run(newFileHash, filePath, getFileName(filePath), getFolderPath(filePath), getFileMtime(filePath), fileSize, oldFileHash);
  refreshDocumentSearchIndex(newFileHash);
}

export function updateTitle(fileHash: string, newTitle: string): void {
  db.prepare(`UPDATE documents SET title = ?, updatedAt = CURRENT_TIMESTAMP WHERE fileHash = ?`).run(newTitle, fileHash);
  refreshDocumentSearchIndex(fileHash);
}

export function updateAuthor(fileHash: string, author: string | null): void {
  db.prepare(`UPDATE documents SET author = ?, updatedAt = CURRENT_TIMESTAMP WHERE fileHash = ?`).run(author, fileHash);
  refreshDocumentSearchIndex(fileHash);
}

export function deleteDocument(fileHash: string): { success: boolean; error?: string } {
  try {
    const doc = getDocumentByHash(fileHash);
    if (!doc) return { success: false, error: "Document not found" };
    
    db.prepare(`DELETE FROM documents_fts WHERE documentId = ?`).run(doc.id);
    db.prepare(`DELETE FROM documents WHERE fileHash = ?`).run(fileHash);
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export function getDocumentById(id: number): DocumentRecord | undefined {
  return db.prepare<[number], DocumentRecord>(
    `SELECT * FROM documents WHERE id = ?`
  ).get(id);
}

export function getFavoriteDocuments(): DocumentRecord[] {
  return db.prepare<[], DocumentRecord>(
    `SELECT * FROM documents WHERE isFavorite = 1`
  ).all();
}

export function getAllDocumentsWithCategories(): (DocumentRecord & { categories: BookCategory[] })[] {
  const docs = getAllDocuments();
  return docs.map(doc => ({
    ...doc,
    categories: getCategoriesForDocument(doc.id),
  }));
}

export function getDocumentsForBackup(): {
  id: number;
  fileHash: string;
  title: string;
  filePath: string | null;
  fileSize: number;
  numPages: number;
  currentPage: number;
  currentZoom: number | null;
  currentScroll: number | null;
  annotations: string | null;
  thumbnailPath: string | null;
  createdAt: string;
  lastOpenedAt: string;
  isSynced: number;
  isFavorite: number;
  rating: number;
  notes: string | null;
  author: string | null;
  description: string | null;
  isbn: string | null;
  publisher: string | null;
  publishDate: string | null;
  language: string | null;
  identifier: string | null;
  asin: string | null;
  subject: string | null;
  series: string | null;
  seriesIndex: string | null;
  authorSort: string | null;
  titleSort: string | null;
  category: string | null;
  processingStatus: string;
  bookId: string | null;
  categoryIds: number[];
}[] {
  const docs = getAllDocuments();
  return docs.map(doc => {
    const cats = getCategoriesForDocument(doc.id);
    return {
      ...doc,
      categoryIds: cats.map(c => c.id),
    };
  });
}

export interface HabitRecord {
  id: string;
  name: string;
  createdAt: string;
  unit: string | null;
  valueMode: string;
}

export interface HabitCompletionRecord {
  habitId: string;
  dateKey: string;
  value: string | null;
}

export function getAllHabits(): HabitRecord[] {
  return db.prepare<[], HabitRecord>(`SELECT * FROM habits ORDER BY createdAt`).all();
}

export function getHabitById(id: string): HabitRecord | undefined {
  return db.prepare<[string], HabitRecord>(`SELECT * FROM habits WHERE id = ?`).get(id);
}

export function addHabit(habit: Omit<HabitRecord, "createdAt">): void {
  db.prepare(
    `INSERT INTO habits (id, name, unit, valueMode) VALUES (?, ?, ?, ?)`
  ).run(habit.id, habit.name, habit.unit, habit.valueMode);
}

export function updateHabit(id: string, updates: Partial<Omit<HabitRecord, "id" | "createdAt">>): void {
  const sets: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) {
    sets.push("name = ?");
    values.push(updates.name);
  }
  if (updates.unit !== undefined) {
    sets.push("unit = ?");
    values.push(updates.unit);
  }
  if (updates.valueMode !== undefined) {
    sets.push("valueMode = ?");
    values.push(updates.valueMode);
  }

  if (sets.length > 0) {
    values.push(id);
    db.prepare(`UPDATE habits SET ${sets.join(", ")} WHERE id = ?`).run(...values);
  }
}

export function deleteHabit(id: string): void {
  db.prepare(`DELETE FROM habit_completions WHERE habitId = ?`).run(id);
  db.prepare(`DELETE FROM habits WHERE id = ?`).run(id);
}

export function getHabitCompletions(habitId: string): HabitCompletionRecord[] {
  return db.prepare<[string], HabitCompletionRecord>(
    `SELECT * FROM habit_completions WHERE habitId = ?`
  ).all(habitId);
}

export function getAllHabitCompletions(): HabitCompletionRecord[] {
  return db.prepare<[], HabitCompletionRecord>(`SELECT * FROM habit_completions`).all();
}

export function setHabitCompletion(habitId: string, dateKey: string, value: string | null): void {
  if (value === null) {
    db.prepare(`DELETE FROM habit_completions WHERE habitId = ? AND dateKey = ?`).run(habitId, dateKey);
  } else {
    db.prepare(
      `INSERT OR REPLACE INTO habit_completions (habitId, dateKey, value) VALUES (?, ?, ?)`
    ).run(habitId, dateKey, value);
  }
}

export function deleteHabitCompletion(habitId: string, dateKey: string): void {
  db.prepare(`DELETE FROM habit_completions WHERE habitId = ? AND dateKey = ?`).run(habitId, dateKey);
}

export interface DocumentCategoryRecord {
  documentId: number;
  categoryId: number;
}

export function getAllDocumentCategories(): DocumentCategoryRecord[] {
  return db.prepare<[], DocumentCategoryRecord>(`SELECT documentId, categoryId FROM document_categories`).all();
}

export interface WordIndexEntry {
  word: string;
  count: number;
}

export function saveWordIndex(fileHash: string, words: WordIndexEntry[]): void {
  db.prepare(`DELETE FROM book_word_index WHERE fileHash = ?`).run(fileHash);
  
  const insertStmt = db.prepare(`INSERT INTO book_word_index (fileHash, word, count) VALUES (?, ?, ?)`);
  const insertMany = db.transaction((entries: WordIndexEntry[]) => {
    for (const entry of entries) {
      insertStmt.run(fileHash, entry.word, entry.count);
    }
  });
  
  insertMany(words);
}

export function getWordIndex(fileHash: string): WordIndexEntry[] {
  return db.prepare<[string], WordIndexEntry>(
    `SELECT word, count FROM book_word_index WHERE fileHash = ? ORDER BY count DESC`
  ).all(fileHash);
}

export function getWordCount(fileHash: string, word: string): number {
  const result = db.prepare<[string, string], { count: number }>(
    `SELECT count FROM book_word_index WHERE fileHash = ? AND word = ?`
  ).get(fileHash, word.toLowerCase());
  return result?.count || 0;
}

export function getBookStats(fileHash: string): { totalWords: number; uniqueWords: number } | null {
  const result = db.prepare<[string], { totalWords: number; uniqueWords: number }>(
    `SELECT COALESCE(SUM(count), 0) as totalWords, COUNT(*) as uniqueWords FROM book_word_index WHERE fileHash = ?`
  ).get(fileHash);
  return result || null;
}

export function hasWordIndex(fileHash: string): boolean {
  const result = db.prepare<[string], { exists: number }>(
    `SELECT 1 as exists FROM book_word_index WHERE fileHash = ? LIMIT 1`
  ).get(fileHash);
  return result !== undefined;
}

export function deleteWordIndex(fileHash: string): void {
  db.prepare(`DELETE FROM book_word_index WHERE fileHash = ?`).run(fileHash);
}

export interface WatchFolderRecord {
  id: number;
  path: string;
  label: string | null;
  type: "watch" | "source";
  createdAt: string;
}

export function getWatchFolders(type: "watch" | "source" = "watch"): WatchFolderRecord[] {
  return db.prepare<[string], WatchFolderRecord>(
    `SELECT * FROM watch_folders WHERE type = ? ORDER BY label, path`
  ).all(type);
}

function addTypedWatchFolder(folderPath: string, label: string | undefined, type: "watch" | "source"): WatchFolderRecord {
  const cleanLabel = label || folderPath.split(/[/\\]/).filter(Boolean).pop() || folderPath;
  db.prepare(
    `INSERT INTO watch_folders (path, label, type)
     VALUES (?, ?, ?)
     ON CONFLICT(path) DO UPDATE SET label = excluded.label, type = excluded.type`
  ).run(folderPath, cleanLabel, type);

  const record = db.prepare<[string], WatchFolderRecord>(
    `SELECT * FROM watch_folders WHERE path = ?`
  ).get(folderPath);

  if (!record) {
    return db.prepare<[], WatchFolderRecord>(
      `SELECT * FROM watch_folders ORDER BY id DESC LIMIT 1`
    ).get()!;
  }

  return record;
}

export function addWatchFolder(folderPath: string, label?: string): WatchFolderRecord {
  return addTypedWatchFolder(folderPath, label, "watch");
}

export function getSourceFolders(): WatchFolderRecord[] {
  return getWatchFolders("source");
}

export function addSourceFolder(folderPath: string, label?: string): WatchFolderRecord {
  return addTypedWatchFolder(folderPath, label, "source");
}

export function removeWatchFolder(id: number): void {
  db.prepare(`DELETE FROM watch_folders WHERE id = ?`).run(id);
}

export function removeSourceFolder(id: number): WatchFolderRecord | undefined {
  const record = db.prepare<[number], WatchFolderRecord>(
    `SELECT * FROM watch_folders WHERE id = ? AND type = 'source'`
  ).get(id);
  if (!record) return undefined;
  removeWatchFolder(id);
  return record;
}

export function deleteDocumentsUnderPath(rootPath: string): number {
  const normalizedRoot = normalizeStoredPath(path.resolve(rootPath));
  if (!normalizedRoot) return 0;
  const docs = db.prepare<[string, string], DocumentRecord>(
    `SELECT * FROM documents
     WHERE REPLACE(filePath, '\\', '/') = ?
        OR REPLACE(filePath, '\\', '/') LIKE ?`
  ).all(normalizedRoot, `${normalizedRoot}/%`);

  for (const doc of docs) {
    deleteDocument(doc.fileHash);
  }

  return docs.length;
}

export function getWatchFolderBooks(folderPath: string): DocumentRecord[] {
  const normalizedPath = folderPath.replace(/\\/g, "/");
  return db.prepare<[string], DocumentRecord>(
    `SELECT * FROM documents WHERE isSynced = 0 AND REPLACE(folderPath, '\\', '/') = ?`
  ).all(normalizedPath);
}

export function getUnsyncedFolderPaths(): string[] {
  const rows = db.prepare<[], { folderPath: string }>(
    `SELECT DISTINCT REPLACE(folderPath, '\\', '/') as folderPath FROM documents WHERE isSynced = 0 AND folderPath IS NOT NULL`
  ).all();
  return rows.map(r => r.folderPath).filter(Boolean);
}

export function getUnsyncedBookCount(folderPath: string): number {
  const normalizedPath = folderPath.replace(/\\/g, "/");
  const result = db.prepare<[string], { count: number }>(
    `SELECT COUNT(*) as count FROM documents WHERE isSynced = 0 AND REPLACE(folderPath, '\\', '/') = ?`
  ).get(normalizedPath);
  return result?.count || 0;
}
