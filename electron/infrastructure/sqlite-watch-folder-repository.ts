import type Database from "better-sqlite3";
import type { DocumentRecord } from "../../src/types/LibraryTypes";

export interface WatchFolderRecord {
  id: number;
  path: string;
  label: string | null;
  type: "watch" | "source";
  createdAt: string;
}

export interface WatchFolderRepository {
  list(type?: "watch" | "source"): WatchFolderRecord[];
  add(folderPath: string, label: string | undefined, type: "watch" | "source"): WatchFolderRecord;
  remove(id: number): void;
  removeSource(id: number): WatchFolderRecord | undefined;
  books(folderPath: string): DocumentRecord[];
  unsyncedPaths(): string[];
  unsyncedBookCount(folderPath: string): number;
}

/** Folder configuration and unsynced-document queries, independent of the database facade. */
export function createSqliteWatchFolderRepository(db: Database.Database): WatchFolderRepository {
  const remove = (id: number): void => {
    db.prepare("DELETE FROM watch_folders WHERE id = ?").run(id);
  };

  return {
    list(type = "watch") {
      return db.prepare<[string], WatchFolderRecord>(
        "SELECT * FROM watch_folders WHERE type = ? ORDER BY label, path",
      ).all(type);
    },
    add(folderPath, label, type) {
      const cleanLabel = label || folderPath.split(/[/\\]/).filter(Boolean).pop() || folderPath;
      db.prepare(
        `INSERT INTO watch_folders (path, label, type)
         VALUES (?, ?, ?)
         ON CONFLICT(path) DO UPDATE SET label = excluded.label, type = excluded.type`,
      ).run(folderPath, cleanLabel, type);

      const record = db.prepare<[string], WatchFolderRecord>(
        "SELECT * FROM watch_folders WHERE path = ?",
      ).get(folderPath);
      if (!record) {
        return db.prepare<[], WatchFolderRecord>(
          "SELECT * FROM watch_folders ORDER BY id DESC LIMIT 1",
        ).get()!;
      }
      return record;
    },
    remove,
    removeSource(id) {
      const record = db.prepare<[number], WatchFolderRecord>(
        "SELECT * FROM watch_folders WHERE id = ? AND type = 'source'",
      ).get(id);
      if (!record) return undefined;
      remove(id);
      return record;
    },
    books(folderPath) {
      const normalizedPath = folderPath.replace(/\\/g, "/");
      return db.prepare<[string], DocumentRecord>(
        "SELECT * FROM documents WHERE isSynced = 0 AND REPLACE(folderPath, '\\', '/') = ?",
      ).all(normalizedPath);
    },
    unsyncedPaths() {
      const rows = db.prepare<[], { folderPath: string }>(
        "SELECT DISTINCT REPLACE(folderPath, '\\', '/') as folderPath FROM documents WHERE isSynced = 0 AND folderPath IS NOT NULL",
      ).all();
      return rows.map((row) => row.folderPath).filter(Boolean);
    },
    unsyncedBookCount(folderPath) {
      const normalizedPath = folderPath.replace(/\\/g, "/");
      return db.prepare<[string], { count: number }>(
        "SELECT COUNT(*) as count FROM documents WHERE isSynced = 0 AND REPLACE(folderPath, '\\', '/') = ?",
      ).get(normalizedPath)?.count || 0;
    },
  };
}
