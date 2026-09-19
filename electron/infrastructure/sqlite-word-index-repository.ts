import type Database from "better-sqlite3";

export interface WordIndexEntry {
  word: string;
  count: number;
}

export interface WordIndexRepository {
  save(fileHash: string, words: WordIndexEntry[]): void;
  list(fileHash: string): WordIndexEntry[];
  count(fileHash: string, word: string): number;
  stats(fileHash: string): { totalWords: number; uniqueWords: number } | null;
  has(fileHash: string): boolean;
  remove(fileHash: string): void;
}

/** Vocabulary persistence, independent of Electron and the database facade. */
export function createSqliteWordIndexRepository(db: Database.Database): WordIndexRepository {
  const remove = (fileHash: string): void => {
    db.prepare("DELETE FROM book_word_index WHERE fileHash = ?").run(fileHash);
  };

  return {
    save(fileHash, words) {
      const insert = db.prepare(
        "INSERT INTO book_word_index (fileHash, word, count) VALUES (?, ?, ?)",
      );
      const insertMany = db.transaction((entries: WordIndexEntry[]) => {
        remove(fileHash);
        for (const entry of entries) insert.run(fileHash, entry.word, entry.count);
      });
      insertMany(words);
    },
    list: (fileHash) => db.prepare<[string], WordIndexEntry>(
      "SELECT word, count FROM book_word_index WHERE fileHash = ? ORDER BY count DESC",
    ).all(fileHash),
    count: (fileHash, word) => db.prepare<[string, string], { count: number }>(
      "SELECT count FROM book_word_index WHERE fileHash = ? AND word = ?",
    ).get(fileHash, word.toLowerCase())?.count || 0,
    stats: (fileHash) => db.prepare<[string], { totalWords: number; uniqueWords: number }>(
      "SELECT COALESCE(SUM(count), 0) as totalWords, COUNT(*) as uniqueWords FROM book_word_index WHERE fileHash = ?",
    ).get(fileHash) || null,
    has: (fileHash) => db.prepare<[string], { present: number }>(
      "SELECT 1 as present FROM book_word_index WHERE fileHash = ? LIMIT 1",
    ).get(fileHash) !== undefined,
    remove,
  };
}
