import fs from "node:fs";
import path from "node:path";

/**
 * Opt-in "smart search" for source folders: walks the user's home folder
 * (locally, read-only) and suggests folders that concentrate books, so files
 * forgotten in obscure places can be added to the library.
 */

const EBOOK_EXTENSIONS = new Set([
  ".epub", ".mobi", ".azw", ".azw3", ".azw4", ".kfx", ".prc", ".fb2", ".cbz", ".cbr", ".djvu",
]);
/** PDFs are everywhere (invoices, receipts): they count, but for less. */
const PDF_WEIGHT = 1 / 3;
/** Folders at or above this score are pre-selected; every folder with a book is still listed. */
const RECOMMENDED_SCORE = 5;
/** Descend into a child that holds this share of the books (more specific suggestion). */
const DOMINANT_CHILD_SHARE = 0.85;

const SKIPPED_DIRECTORIES = new Set([
  "node_modules", "appdata", "application data", "library", "snap", "flatpak", "proc", "sys",
  "windows", "program files", "program files (x86)", "programdata", "$recycle.bin",
  "site-packages", "venv", ".venv", "__pycache__", "dist", "build", "target", "vendor",
  "steamapps", "cache", "caches", "tmp", "temp",
]);

export interface SourceFolderSuggestion {
  path: string;
  /** Book files under the folder (any depth). */
  bookCount: number;
  ebookCount: number;
  pdfCount: number;
  /** Concentrates enough books to be pre-selected in the UI. */
  recommended: boolean;
}

export interface SuggestSourceFoldersOptions {
  roots: string[];
  /** Folders already in the library (managed library, source and watch folders). */
  excludedPaths: string[];
  maxDepth?: number;
  maxDirectories?: number;
  timeBudgetMs?: number;
  limit?: number;
}

interface DirectoryStats {
  path: string;
  depth: number;
  ebooks: number;
  pdfs: number;
  children: DirectoryStats[];
  subtreeEbooks: number;
  subtreePdfs: number;
}

function normalize(value: string) {
  return path.resolve(value).replace(/[\\/]+$/, "");
}

function isSameOrInside(candidate: string, parent: string) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function overlapsExcluded(candidate: string, excluded: string[]) {
  return excluded.some((entry) => isSameOrInside(candidate, entry) || isSameOrInside(entry, candidate));
}

const score = (stats: { subtreeEbooks: number; subtreePdfs: number }) =>
  stats.subtreeEbooks + stats.subtreePdfs * PDF_WEIGHT;

export async function suggestSourceFolders(options: SuggestSourceFoldersOptions): Promise<{
  suggestions: SourceFolderSuggestion[];
  scannedDirectories: number;
  truncated: boolean;
}> {
  const maxDepth = options.maxDepth ?? 6;
  const maxDirectories = options.maxDirectories ?? 40_000;
  const deadline = Date.now() + (options.timeBudgetMs ?? 12_000);
  const excluded = options.excludedPaths.filter(Boolean).map(normalize);
  let scanned = 0;
  let truncated = false;

  const roots: DirectoryStats[] = [];
  const queue: DirectoryStats[] = [];
  for (const root of options.roots) {
    try {
      if (!fs.statSync(root).isDirectory()) continue;
    } catch {
      continue;
    }
    const node: DirectoryStats = { path: normalize(root), depth: 0, ebooks: 0, pdfs: 0, children: [], subtreeEbooks: 0, subtreePdfs: 0 };
    roots.push(node);
    queue.push(node);
  }

  // Breadth-first so a time/size cut still covers the shallow, likely folders.
  for (let index = 0; index < queue.length; index += 1) {
    if (scanned >= maxDirectories || Date.now() > deadline) {
      truncated = true;
      break;
    }
    const node = queue[index];
    scanned += 1;
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(node.path, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      if (entry.isFile()) {
        const extension = path.extname(entry.name).toLowerCase();
        if (EBOOK_EXTENSIONS.has(extension)) node.ebooks += 1;
        else if (extension === ".pdf") node.pdfs += 1;
      } else if (entry.isDirectory() && node.depth < maxDepth) {
        if (SKIPPED_DIRECTORIES.has(entry.name.toLowerCase())) continue;
        const childPath = path.join(node.path, entry.name);
        if (excluded.some((entryPath) => isSameOrInside(childPath, entryPath))) continue;
        const child: DirectoryStats = { path: childPath, depth: node.depth + 1, ebooks: 0, pdfs: 0, children: [], subtreeEbooks: 0, subtreePdfs: 0 };
        node.children.push(child);
        queue.push(child);
      }
    }
  }

  const accumulate = (node: DirectoryStats) => {
    node.subtreeEbooks = node.ebooks;
    node.subtreePdfs = node.pdfs;
    for (const child of node.children) {
      accumulate(child);
      node.subtreeEbooks += child.subtreeEbooks;
      node.subtreePdfs += child.subtreePdfs;
    }
  };
  roots.forEach(accumulate);

  const suggestions: SourceFolderSuggestion[] = [];
  const pick = (node: DirectoryStats) => {
    if (node.subtreeEbooks + node.subtreePdfs === 0) return;
    // A child holding nearly all the books is the more specific suggestion;
    // its smaller siblings are still listed on their own.
    const dominant = node.children.find((child) => score(child) >= score(node) * DOMINANT_CHILD_SHARE);
    if (dominant) {
      node.children.forEach(pick);
      return;
    }
    // Never suggest the scan roots themselves (e.g. the whole home folder):
    // split them into their book-bearing children instead.
    if (node.depth === 0) {
      node.children.forEach(pick);
      return;
    }
    if (overlapsExcluded(node.path, excluded)) {
      node.children.forEach(pick);
      return;
    }
    suggestions.push({
      path: node.path,
      bookCount: node.subtreeEbooks + node.subtreePdfs,
      ebookCount: node.subtreeEbooks,
      pdfCount: node.subtreePdfs,
      recommended: score(node) >= RECOMMENDED_SCORE,
    });
  };
  roots.forEach(pick);

  suggestions.sort((left, right) => (
    (right.ebookCount + right.pdfCount * PDF_WEIGHT) - (left.ebookCount + left.pdfCount * PDF_WEIGHT)
  ));
  return { suggestions: suggestions.slice(0, options.limit ?? 100), scannedDirectories: scanned, truncated };
}
