import Database from "better-sqlite3";
import electron from "electron";
import path from "path";
import fs from "fs";

const { app } = electron;

export interface DocumentRecord {
  id: number;
  title: string;
  filePath: string;
  fileHash: string;
  fileName: string | null;
  folderPath: string | null;
  fileMtime: number | null;
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
  isFavorite: number;
  rating: number;
  notes: string | null;
  author: string | null;
  description: string | null;
  isbn: string | null;
  publisher: string | null;
  publishDate: string | null;
  fileSize: number;
  processingStatus: "pending" | "processing" | "completed" | "failed";
  bookId: string | null;
  fileType: "pdf" | "epub";
  importedAt: string | null;
  updatedAt: string | null;
}

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

const DEFAULT_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280", "#14b8a6",
];

let db: Database.Database;

export type LibrarySection = "all" | "synced" | "unsynced";
export type LibrarySortOption = "title" | "recent" | "pages" | "size";
export type LibraryFileTypeFilter = "all" | "pdf" | "epub";

export interface LibraryListQuery {
  section?: LibrarySection;
  search?: string;
  folderPath?: string | null;
  fileType?: LibraryFileTypeFilter;
  sort?: LibrarySortOption;
  limit?: number;
  offset?: number;
}

export interface LibraryListResult {
  items: DocumentRecord[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

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
    fileSize INTEGER DEFAULT 0,
    processingStatus TEXT DEFAULT 'pending',
    bookId TEXT,
    fileName TEXT,
    folderPath TEXT,
    fileMtime INTEGER,
    importedAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
  )
  `);

  const migrationColumns = [
    "isSynced", "isFavorite", "rating", "notes", "author",
    "description", "isbn", "publisher", "publishDate", "fileSize", "processingStatus", "bookId", "fileType",
    "fileName", "folderPath", "fileMtime", "importedAt", "updatedAt"
  ];

  for (const col of migrationColumns) {
    const sql = `ALTER TABLE documents ADD COLUMN ${col} ${
      col === "isSynced" || col === "isFavorite" ? "INTEGER DEFAULT 0" :
      col === "rating" ? "REAL DEFAULT 0" :
      col === "fileSize" ? "INTEGER DEFAULT 0" :
      col === "fileType" ? "TEXT DEFAULT 'pdf'" :
      col === "fileMtime" ? "INTEGER" :
      col === "importedAt" || col === "updatedAt" ? "TEXT" :
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
  thumbnailPath: string | undefined,
  numPages: number = 1,
  fileType: "pdf" | "epub" = "pdf",
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
    where.push("LOWER(COALESCE(d.fileType, '')) = ?");
    values.push(query.fileType);
  }

  if (query.folderPath) {
    const absoluteFolder = path.isAbsolute(query.folderPath)
      ? query.folderPath
      : path.join(app.getPath("userData"), "library", query.folderPath);
    const normalizedFolder = normalizeStoredPath(absoluteFolder);
    where.push("(d.folderPath = ? OR d.folderPath LIKE ? OR REPLACE(d.filePath, '\\', '/') LIKE ?)");
    values.push(normalizedFolder, `${normalizedFolder}/%`, `${normalizedFolder}/%`);
  }

  const ftsQuery = query.search ? tokenizeSearch(query.search) : "";
  if (ftsQuery) {
    join = "INNER JOIN documents_fts fts ON fts.documentId = d.id";
    where.push("documents_fts MATCH ?");
    values.push(ftsQuery);
  }

  const orderBy: Record<LibrarySortOption, string> = {
    title: "LOWER(d.title) ASC, d.id ASC",
    recent: "datetime(d.lastOpenedAt) DESC, d.id DESC",
    pages: "d.numPages DESC, LOWER(d.title) ASC",
    size: "d.fileSize DESC, LOWER(d.title) ASC",
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

export function updateDocumentBookId(fileHash: string, bookId: string): void {
  db.prepare(
    `UPDATE documents SET bookId = ? WHERE fileHash = ?`
  ).run(bookId, fileHash);
}

export function getDocumentsByBookId(bookId: string): DocumentRecord[] {
  return db.prepare<[string], DocumentRecord>(
    `SELECT * FROM documents WHERE bookId = ?`
  ).all(bookId);
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
  fileType: "pdf" | "epub"
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
