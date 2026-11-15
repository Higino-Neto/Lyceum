import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import zlib from "node:zlib";
import electron from "electron";
import { dictionaryManager } from "./dictionary-manager";

const { app } = electron;

export interface StarDictEntry {
  word: string;
  content: string;
}

export class DictionaryStorage {
  private db: Database.Database;
  private dictId: string;

  constructor(dictId: string) {
    this.dictId = dictId;
    const dbPath = path.join(
      app.getPath("userData"),
      "dictionaries",
      `${dictId}.db`
    );
    this.db = new Database(dbPath);
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS words (
        word TEXT PRIMARY KEY,
        content TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_word ON words(word);
    `);
  }

  importFromStarDict(): number {
    const dictPath = dictionaryManager.getDictionaryPath(this.dictId);
    const files: string[] = [];
    const visit = (directory: string, depth: number) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const full = path.join(directory, entry.name);
        if (entry.isDirectory() && depth < 3) visit(full, depth + 1);
        else if (entry.isFile()) files.push(full);
      }
    };
    visit(dictPath, 0);
    // Prefer files named after the dictionary id; accept any StarDict pair otherwise.
    const pick = (pattern: RegExp) =>
      files.find((file) => pattern.test(path.basename(file)) && path.basename(file).startsWith(this.dictId))
      ?? files.find((file) => pattern.test(path.basename(file)));
    const idxPath = pick(/\.idx(\.gz)?$/i);
    const dictFilePath = pick(/\.dict(\.dz)?$/i);
    if (!idxPath || !dictFilePath) {
      throw new Error(`StarDict files not found for ${this.dictId}`);
    }
    const readMaybeGzip = (file: string) => {
      const raw = fs.readFileSync(file);
      return /\.(gz|dz)$/i.test(file) ? zlib.gunzipSync(raw) : raw;
    };
    const idxContent = readMaybeGzip(idxPath);
    const dictContent = readMaybeGzip(dictFilePath);
    
    console.log(`[DictionaryStorage] Parsing ${idxContent.length} bytes of index, ${dictContent.length} bytes of dict`);
    
    const insertStmt = this.db.prepare(
      "INSERT OR IGNORE INTO words (word, content) VALUES (?, ?)"
    );
    
    let offset = 0;
    let count = 0;
    let batch: { word: string; content: string }[] = [];
    
    while (offset < idxContent.length) {
      const nullPos = idxContent.indexOf(0, offset);
      if (nullPos === -1) break;
      
      const word = idxContent.slice(offset, nullPos).toString("utf-8");
      const dataStart = nullPos + 1;
      
      if (dataStart + 8 > idxContent.length) break;
      
      const position = idxContent.readUInt32BE(dataStart);
      const size = idxContent.readUInt32BE(dataStart + 4);
      
      if (position + size > dictContent.length) break;
      
      const content = dictContent.slice(position, position + size).toString("utf-8");
      
      batch.push({ word: word.toLowerCase(), content });
      count++;
      offset = dataStart + 8;
      
      if (batch.length >= 500) {
        const insertMany = this.db.transaction((items) => {
          for (const item of items) {
            insertStmt.run(item.word, item.content);
          }
        });
        insertMany(batch);
        batch = [];
        console.log(`[DictionaryStorage] Imported ${count} entries...`);
      }
    }
    
    if (batch.length > 0) {
      const insertMany = this.db.transaction((items) => {
        for (const item of items) {
          insertStmt.run(item.word, item.content);
        }
      });
      insertMany(batch);
    }
    
    console.log(`[DictionaryStorage] Total imported: ${count} entries`);
    return count;
  }

  lookup(word: string): StarDictEntry | null {
    const result = this.db.prepare(
      "SELECT word, content FROM words WHERE word = ?"
    ).get(word.toLowerCase()) as StarDictEntry | undefined;
    return result || null;
  }

  search(word: string, limit: number = 10): StarDictEntry[] {
    return this.db.prepare(
      "SELECT word, content FROM words WHERE word LIKE ? ORDER BY word LIMIT ?"
    ).all(`${word.toLowerCase()}%`, limit) as StarDictEntry[];
  }

  close(): void {
    this.db.close();
  }

  getWordCount(): number {
    const result = this.db.prepare("SELECT COUNT(*) as count FROM words").get() as { count: number };
    return result.count;
  }
}

const storageCache = new Map<string, DictionaryStorage>();

export function getDictionaryStorage(dictId: string): DictionaryStorage {
  const cached = storageCache.get(dictId);
  if (cached && cached.getWordCount() > 0) {
    return cached;
  }
  
  if (cached) {
    cached.close();
  }
  
  const storage = new DictionaryStorage(dictId);
  
  if (storage.getWordCount() === 0) {
    storage.importFromStarDict();
  }
  
  storageCache.set(dictId, storage);
  return storage;
}

export function closeAllStorage(): void {
  for (const storage of storageCache.values()) {
    storage.close();
  }
  storageCache.clear();
}
