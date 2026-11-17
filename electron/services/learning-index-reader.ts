import fs from "node:fs";
import path from "node:path";
import type { LearningDocumentLexicon } from "../infrastructure/sqlite-stats-repository";

interface CachedLexicon {
  mtimeMs: number;
  value: LearningDocumentLexicon | null;
}

const HEX_HASH = /^[a-f0-9]{16,128}$/i;

function parseIndex(file: string, fileHash: string | null): LearningDocumentLexicon | null {
  const raw: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!raw || typeof raw !== "object") return null;
  const index = raw as Record<string, unknown>;
  if (typeof index.documentId !== "string" || typeof index.language !== "string" || !Array.isArray(index.lexicon)) return null;
  const lexicon = index.lexicon
    .filter((entry): entry is { key: string; count: number } =>
      Boolean(entry) && typeof (entry as { key?: unknown }).key === "string" && typeof (entry as { count?: unknown }).count === "number")
    .map((entry) => ({ key: entry.key, count: entry.count }));
  const totals = index.totals as { tokens?: unknown } | undefined;
  return {
    documentId: index.documentId,
    fileHash,
    title: typeof index.title === "string" && index.title.trim() ? index.title : index.documentId,
    language: index.language,
    tokens: typeof totals?.tokens === "number" ? totals.tokens : lexicon.reduce((sum, entry) => sum + entry.count, 0),
    lexicon,
  };
}

/**
 * Reads the lexicons of every analysed learning document from the
 * language-learning cache (imported packages and `.lyceum` sidecars). Parsed
 * indexes are memoised by mtime because they can be several megabytes.
 */
export function createLearningIndexReader(cacheRoot: string) {
  const cache = new Map<string, CachedLexicon>();

  const candidates = (): Array<{ file: string; fileHash: string | null }> => {
    const found: Array<{ file: string; fileHash: string | null }> = [];
    const packages = path.join(cacheRoot, "packages");
    if (fs.existsSync(packages)) {
      for (const entry of fs.readdirSync(packages)) {
        if (!entry.endsWith(".lyceum")) continue;
        const key = entry.slice(0, -".lyceum".length);
        found.push({ file: path.join(packages, entry, "indexes", "linguistic", "document.json"), fileHash: HEX_HASH.test(key) ? key : null });
      }
    }
    const sidecars = path.join(cacheRoot, "indexes");
    if (fs.existsSync(sidecars)) {
      for (const key of fs.readdirSync(sidecars)) {
        found.push({ file: path.join(sidecars, key, "document.json"), fileHash: HEX_HASH.test(key) ? key : null });
      }
    }
    return found;
  };

  return {
    list(): LearningDocumentLexicon[] {
      const documents = new Map<string, LearningDocumentLexicon>();
      for (const { file, fileHash } of candidates()) {
        let stat: fs.Stats;
        try {
          stat = fs.statSync(file);
        } catch {
          continue;
        }
        let cached = cache.get(file);
        if (!cached || cached.mtimeMs !== stat.mtimeMs) {
          let value: LearningDocumentLexicon | null = null;
          try {
            value = parseIndex(file, fileHash);
          } catch {
            value = null;
          }
          cached = { mtimeMs: stat.mtimeMs, value };
          cache.set(file, cached);
        }
        if (cached.value) documents.set(cached.value.documentId, cached.value);
      }
      return [...documents.values()];
    },
  };
}
