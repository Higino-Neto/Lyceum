import Database from "better-sqlite3";
import { app } from "electron";
import path from "path";

export interface DocumentRecord {
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

export function initDatabase() {
  const dbPath = path.join(app.getPath("userData"), "app.db");
  db = new Database(dbPath);

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
    bookId TEXT
  )
  `);

  const migrationColumns = [
    "isSynced", "isFavorite", "rating", "notes", "author",
    "description", "isbn", "publisher", "publishDate", "fileSize", "processingStatus", "bookId"
  ];

  for (const col of migrationColumns) {
    const sql = `ALTER TABLE documents ADD COLUMN ${col} ${
      col === "isSynced" || col === "isFavorite" ? "INTEGER DEFAULT 0" :
      col === "rating" ? "REAL DEFAULT 0" :
      col === "fileSize" ? "INTEGER DEFAULT 0" :
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
    SET filePath = ?
    WHERE fileHash = ?
  `,
  ).run(newPath, fileHash);
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

export function toggleFavorite(fileHash: string): boolean {
  const doc = getDocumentByHash(fileHash);
  if (!doc) return false;
  
  const newValue = doc.isFavorite === 1 ? 0 : 1;
  db.prepare(`UPDATE documents SET isFavorite = ? WHERE fileHash = ?`).run(newValue, fileHash);
  return newValue === 1;
}

export function updateRating(fileHash: string, rating: number): void {
  db.prepare(`UPDATE documents SET rating = ? WHERE fileHash = ?`).run(rating, fileHash);
}

export function updateNotes(fileHash: string, notes: string): void {
  db.prepare(`UPDATE documents SET notes = ? WHERE fileHash = ?`).run(notes, fileHash);
}

export function updateMetadata(
  fileHash: string,
  metadata: {
    author?: string;
    description?: string;
    isbn?: string;
    publisher?: string;
    publishDate?: string;
  }
): void {
  const sets: string[] = [];
  const values: any[] = [];
  
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
    values.push(fileHash);
    db.prepare(`UPDATE documents SET ${sets.join(", ")} WHERE fileHash = ?`).run(...values);
  }
}

export function updateProcessingStatus(
  fileHash: string,
  status: "pending" | "processing" | "completed" | "failed"
): void {
  db.prepare(`UPDATE documents SET processingStatus = ? WHERE fileHash = ?`).run(status, fileHash);
}

export function getDocumentsPendingProcessing(): DocumentRecord[] {
  return db.prepare<[], DocumentRecord>(
    `SELECT * FROM documents WHERE processingStatus = 'pending' OR processingStatus = 'failed'`
  ).all();
}

export function updateFileSize(fileHash: string, fileSize: number): void {
  db.prepare(`UPDATE documents SET fileSize = ? WHERE fileHash = ?`).run(fileSize, fileHash);
}

export function updateTitle(fileHash: string, newTitle: string): void {
  db.prepare(`UPDATE documents SET title = ? WHERE fileHash = ?`).run(newTitle, fileHash);
}

export function updateAuthor(fileHash: string, author: string | null): void {
  db.prepare(`UPDATE documents SET author = ? WHERE fileHash = ?`).run(author, fileHash);
}

export function deleteDocument(fileHash: string): { success: boolean; error?: string } {
  try {
    const doc = getDocumentByHash(fileHash);
    if (!doc) return { success: false, error: "Document not found" };
    
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
