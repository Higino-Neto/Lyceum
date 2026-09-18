import type Database from "better-sqlite3";

/** Minimal schema required before the versioned migrations can run. */
export function ensureBootstrapSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#6b7280',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS document_categories (
      documentId INTEGER NOT NULL,
      categoryId INTEGER NOT NULL,
      PRIMARY KEY (documentId, categoryId),
      FOREIGN KEY (documentId) REFERENCES documents(id) ON DELETE CASCADE,
      FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE CASCADE
    );
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
      category TEXT,
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
    );
  `);
}

/** Feature tables and query indexes created after the bootstrap migration. */
export function ensureApplicationSchema(db: Database.Database): void {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_document_categories_doc ON document_categories(documentId);
    CREATE INDEX IF NOT EXISTS idx_document_categories_cat ON document_categories(categoryId);
    CREATE INDEX IF NOT EXISTS idx_documents_file_hash ON documents(fileHash);
    CREATE INDEX IF NOT EXISTS idx_documents_file_path ON documents(filePath);
    CREATE INDEX IF NOT EXISTS idx_documents_folder_path ON documents(folderPath);
    CREATE INDEX IF NOT EXISTS idx_documents_file_type ON documents(fileType);
    CREATE INDEX IF NOT EXISTS idx_documents_is_synced ON documents(isSynced);
    CREATE INDEX IF NOT EXISTS idx_documents_last_opened ON documents(lastOpenedAt DESC);
    CREATE INDEX IF NOT EXISTS idx_documents_title ON documents(title COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS idx_documents_author ON documents(author COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS idx_documents_processing ON documents(processingStatus);
    CREATE INDEX IF NOT EXISTS idx_documents_reading_status ON documents(readingStatus);

    CREATE TABLE IF NOT EXISTS reading_maps (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS reading_map_sections (
      id TEXT PRIMARY KEY,
      mapId TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      orderIndex INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (mapId) REFERENCES reading_maps(id) ON DELETE CASCADE
    );
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
    );
    CREATE INDEX IF NOT EXISTS idx_reading_maps_updated ON reading_maps(updatedAt DESC);
    CREATE INDEX IF NOT EXISTS idx_reading_map_sections_map ON reading_map_sections(mapId, orderIndex);
    CREATE INDEX IF NOT EXISTS idx_reading_map_items_section ON reading_map_items(sectionId, orderIndex);

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
    );
    CREATE TABLE IF NOT EXISTS reading_status_progress_events (
      id TEXT PRIMARY KEY,
      statusItemId TEXT NOT NULL,
      pages INTEGER NOT NULL DEFAULT 0,
      note TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (statusItemId) REFERENCES reading_status_items(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_reading_status_items_status ON reading_status_items(status, orderIndex);
    CREATE INDEX IF NOT EXISTS idx_reading_status_items_book ON reading_status_items(bookId);
    CREATE INDEX IF NOT EXISTS idx_reading_status_events_item ON reading_status_progress_events(statusItemId, createdAt);

    CREATE TABLE IF NOT EXISTS atlas_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    );
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
    );
    CREATE TABLE IF NOT EXISTS authors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      sortName TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS document_authors (
      documentId INTEGER NOT NULL,
      authorId INTEGER NOT NULL,
      role TEXT DEFAULT 'author',
      PRIMARY KEY (documentId, authorId, role),
      FOREIGN KEY (documentId) REFERENCES documents(id) ON DELETE CASCADE,
      FOREIGN KEY (authorId) REFERENCES authors(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#6b7280',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS document_tags (
      documentId INTEGER NOT NULL,
      tagId INTEGER NOT NULL,
      PRIMARY KEY (documentId, tagId),
      FOREIGN KEY (documentId) REFERENCES documents(id) ON DELETE CASCADE,
      FOREIGN KEY (tagId) REFERENCES tags(id) ON DELETE CASCADE
    );
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
    );
    CREATE INDEX IF NOT EXISTS idx_document_authors_doc ON document_authors(documentId);
    CREATE INDEX IF NOT EXISTS idx_document_authors_author ON document_authors(authorId);
    CREATE INDEX IF NOT EXISTS idx_document_tags_doc ON document_tags(documentId);
    CREATE INDEX IF NOT EXISTS idx_document_tags_tag ON document_tags(tagId);
    CREATE INDEX IF NOT EXISTS idx_processing_jobs_status ON processing_jobs(status, priority DESC, createdAt);

    CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
      documentId UNINDEXED,
      title,
      author,
      folderPath,
      fileType,
      tokenize = 'unicode61 remove_diacritics 2'
    );
    CREATE TABLE IF NOT EXISTS book_word_index (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fileHash TEXT NOT NULL,
      word TEXT NOT NULL,
      count INTEGER NOT NULL,
      UNIQUE(fileHash, word)
    );
    CREATE TABLE IF NOT EXISTS watch_folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL UNIQUE,
      label TEXT,
      type TEXT NOT NULL DEFAULT 'watch',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

/** Tables and indexes independent from the versioned document migrations. */
export function ensurePostMigrationSchema(db: Database.Database): void {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_word_index_fileHash ON book_word_index(fileHash);
    CREATE INDEX IF NOT EXISTS idx_word_index_word ON book_word_index(word);
    CREATE TABLE IF NOT EXISTS habits (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      unit TEXT,
      valueMode TEXT DEFAULT 'toggle'
    );
    CREATE TABLE IF NOT EXISTS habit_completions (
      habitId TEXT NOT NULL,
      dateKey TEXT NOT NULL,
      value TEXT,
      PRIMARY KEY (habitId, dateKey),
      FOREIGN KEY (habitId) REFERENCES habits(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_habit_completions_habit ON habit_completions(habitId);
  `);
}
