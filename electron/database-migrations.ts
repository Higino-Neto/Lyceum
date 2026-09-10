import type Database from "better-sqlite3";

export const CURRENT_SQLITE_SCHEMA_VERSION = 3;

type SqliteDatabase = Database.Database;

interface Migration {
  version: number;
  name: string;
  up(database: SqliteDatabase): void;
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

export function getTableColumns(database: SqliteDatabase, tableName: string): string[] {
  return (database.pragma(`table_info(${quoteIdentifier(tableName)})`) as Array<{ name: string }>)
    .map((column) => column.name);
}

function tableExists(database: SqliteDatabase, tableName: string): boolean {
  return Boolean(database.prepare(
    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
  ).get(tableName));
}

function addColumnIfMissing(
  database: SqliteDatabase,
  tableName: string,
  columnName: string,
  definition: string,
): void {
  if (!tableExists(database, tableName)) {
    throw new Error(`Cannot migrate missing SQLite table: ${tableName}`);
  }
  if (getTableColumns(database, tableName).includes(columnName)) return;
  database.exec(
    `ALTER TABLE ${quoteIdentifier(tableName)} ADD COLUMN ${quoteIdentifier(columnName)} ${definition}`,
  );
}

const documentColumns: Array<[string, string]> = [
  ["isSynced", "INTEGER DEFAULT 0"],
  ["category", "TEXT"],
  ["isFavorite", "INTEGER DEFAULT 0"],
  ["rating", "REAL DEFAULT 0"],
  ["notes", "TEXT"],
  ["author", "TEXT"],
  ["description", "TEXT"],
  ["isbn", "TEXT"],
  ["publisher", "TEXT"],
  ["publishDate", "TEXT"],
  ["language", "TEXT"],
  ["identifier", "TEXT"],
  ["asin", "TEXT"],
  ["subject", "TEXT"],
  ["series", "TEXT"],
  ["seriesIndex", "TEXT"],
  ["authorSort", "TEXT"],
  ["titleSort", "TEXT"],
  ["fileSize", "INTEGER DEFAULT 0"],
  ["processingStatus", "TEXT DEFAULT 'pending'"],
  ["bookId", "TEXT"],
  ["fileType", "TEXT DEFAULT 'pdf'"],
  ["fileName", "TEXT"],
  ["folderPath", "TEXT"],
  ["fileMtime", "INTEGER"],
  ["importedAt", "TEXT"],
  ["updatedAt", "TEXT"],
  ["readingStatus", "TEXT"],
  ["completedAt", "TEXT"],
];

const migrations: Migration[] = [
  {
    version: 1,
    name: "documents-and-categories",
    up(database) {
      for (const [column, definition] of documentColumns) {
        addColumnIfMissing(database, "documents", column, definition);
      }
      addColumnIfMissing(database, "categories", "color", "TEXT NOT NULL DEFAULT '#6b7280'");
      addColumnIfMissing(database, "categories", "createdAt", "TEXT");
    },
  },
  {
    version: 2,
    name: "reading-status-and-watch-folders",
    up(database) {
      const readingStatusColumns: Array<[string, string]> = [
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
      for (const [column, definition] of readingStatusColumns) {
        addColumnIfMissing(database, "reading_status_items", column, definition);
      }
      addColumnIfMissing(database, "watch_folders", "type", "TEXT NOT NULL DEFAULT 'watch'");
    },
  },
  {
    version: 3,
    name: "key-concepts-and-relations",
    up(database) {
      database.exec(`
        CREATE TABLE IF NOT EXISTS key_concepts (
          id TEXT PRIMARY KEY,
          bookId TEXT NOT NULL,
          title TEXT NOT NULL,
          note TEXT,
          page INTEGER NOT NULL CHECK (page >= 1),
          createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
          updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);

      database.exec(`
        CREATE TABLE IF NOT EXISTS concept_relations (
          bookId TEXT NOT NULL,
          conceptAId TEXT NOT NULL,
          conceptBId TEXT NOT NULL,
          createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (conceptAId, conceptBId),
          CHECK (conceptAId <> conceptBId),
          CHECK (conceptAId < conceptBId),
          FOREIGN KEY (conceptAId) REFERENCES key_concepts(id) ON DELETE CASCADE,
          FOREIGN KEY (conceptBId) REFERENCES key_concepts(id) ON DELETE CASCADE
        )
      `);

      database.exec(`CREATE INDEX IF NOT EXISTS idx_key_concepts_book ON key_concepts(bookId, updatedAt DESC)`);
      database.exec(`CREATE INDEX IF NOT EXISTS idx_key_concepts_book_page ON key_concepts(bookId, page, title COLLATE NOCASE)`);
      database.exec(`CREATE INDEX IF NOT EXISTS idx_key_concepts_title ON key_concepts(bookId, title COLLATE NOCASE)`);
      database.exec(`CREATE INDEX IF NOT EXISTS idx_concept_relations_book ON concept_relations(bookId)`);
      database.exec(`CREATE INDEX IF NOT EXISTS idx_concept_relations_a ON concept_relations(conceptAId)`);
      database.exec(`CREATE INDEX IF NOT EXISTS idx_concept_relations_b ON concept_relations(conceptBId)`);
    },
  },
];

export function getSqliteSchemaVersion(database: SqliteDatabase): number {
  return database.pragma("user_version", { simple: true }) as number;
}

export function runDatabaseMigrations(
  database: SqliteDatabase,
  targetVersion = CURRENT_SQLITE_SCHEMA_VERSION,
  onApplied?: (migration: Pick<Migration, "version" | "name">) => void,
): number {
  const initialVersion = getSqliteSchemaVersion(database);
  if (initialVersion > CURRENT_SQLITE_SCHEMA_VERSION) {
    throw new Error(
      `SQLite schema version ${initialVersion} is newer than supported version ${CURRENT_SQLITE_SCHEMA_VERSION}`,
    );
  }
  if (targetVersion < 0 || targetVersion > CURRENT_SQLITE_SCHEMA_VERSION) {
    throw new Error(`Invalid SQLite migration target: ${targetVersion}`);
  }
  if (targetVersion <= initialVersion) return initialVersion;

  for (const migration of migrations) {
    const currentVersion = getSqliteSchemaVersion(database);
    if (migration.version <= currentVersion || migration.version > targetVersion) continue;
    database.transaction(() => {
      migration.up(database);
      database.pragma(`user_version = ${migration.version}`);
    })();
    onApplied?.({ version: migration.version, name: migration.name });
  }

  return getSqliteSchemaVersion(database);
}
