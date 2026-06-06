import fs from "node:fs";
import path from "node:path";
import {
  getAllDocuments,
  addDocument,
  getDocumentByHash,
  getDocumentByPath,
  getDocumentByFilePath,
  updateThumbnailPath,
  updateDocumentNumPages,
  updateDocumentPath,
  updateDocumentSyncStatus,
  updateDocumentFileIdentity,
  updateFileSize,
  updateMetadata,
  updateProcessingStatus,
  deleteDocument,
  getSourceFolders,
  type DocumentRecord,
  type WatchFolderRecord,
} from "../local-database";
import {
  LIBRARY_PATH,
  THUMBNAILS_DIR,
  generateFileHash,
  getAllBookFiles as getAllBookFilesUtil,
  inferBookFileTypeFromPath,
} from "./file-service";
import {
  generateThumbnail,
  extractPdfMetadata,
  extractEpubMetadata,
  getPdfPageCount,
  getEpubChapterCount,
  getCbzPageCount,
  validateCbzFile,
  type BookFileType,
} from "./document-processing";

export interface FolderInfo {
  name: string;
  path: string;
  fullPath: string;
  bookCount: number;
  subfolders: FolderInfo[];
}

export interface LibraryRootInfo {
  id: number | null;
  type: "library" | "source";
  label: string;
  path: string;
}

interface ProcessFileOptions {
  rootPath?: string;
  isSynced?: boolean;
  generateThumbnail?: boolean;
}

interface LibraryJob {
  key: string;
  run: () => Promise<boolean | void>;
}

export interface ScanLibraryResult {
  queued: number;
  skipped: number;
  total: number;
}

export interface ThumbnailRequest {
  fileHash: string;
  filePath: string;
  fileType?: BookFileType | null;
  force?: boolean;
}

let emitLibraryChanged: (() => void) | null = null;

export function setLibraryChangeEmitter(callback: (() => void) | null) {
  emitLibraryChanged = callback;
}

class LibraryJobQueue {
  private queue: LibraryJob[] = [];
  private queuedKeys = new Set<string>();
  private active = 0;
  private scheduled = false;
  private changedSinceEmit = 0;
  private emitTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly maxConcurrency = 1) {}

  enqueue(job: LibraryJob): boolean {
    if (this.queuedKeys.has(job.key)) return false;
    this.queuedKeys.add(job.key);
    this.queue.push(job);
    this.schedule();
    return true;
  }

  private schedule() {
    if (this.scheduled) return;
    this.scheduled = true;
    setImmediate(() => {
      this.scheduled = false;
      void this.processNext();
    });
  }

  private async processNext() {
    while (this.active < this.maxConcurrency && this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) return;

      this.active++;
      this.queuedKeys.delete(job.key);

      setImmediate(async () => {
        try {
          const changed = await job.run();
          if (changed !== false) {
            this.changedSinceEmit++;
            if (this.changedSinceEmit >= 6) {
              this.flushChanges();
            }
          }
        } catch (error) {
          console.error("[LibraryService] Background job error:", error);
        } finally {
          this.active--;
          if (this.queue.length > 0) {
            this.schedule();
          } else {
            this.flushChanges();
          }
        }
      });
    }
  }

  private flushChanges() {
    if (this.changedSinceEmit === 0) return;
    if (this.emitTimer) return;
    this.emitTimer = setTimeout(() => {
      this.emitTimer = null;
      if (this.changedSinceEmit === 0) return;
      this.changedSinceEmit = 0;
      emitLibraryChanged?.();
    }, 500);
  }
}

const libraryJobQueue = new LibraryJobQueue(1);

function normalizePathForCompare(filePath: string): string {
  return path.resolve(filePath).replace(/\\/g, "/").toLowerCase();
}

function isCompletedDocumentCurrent(existing: DocumentRecord | undefined, filePath: string): boolean {
  if (!existing || existing.processingStatus !== "completed" || !existing.filePath) return false;
  if (normalizePathForCompare(existing.filePath) !== normalizePathForCompare(filePath)) return false;

  try {
    const stats = fs.statSync(filePath);
    const sameMtime = existing.fileMtime === Math.round(stats.mtimeMs);
    const sameSize = existing.fileSize === stats.size;
    return sameMtime && sameSize;
  } catch {
    return false;
  }
}

function getSupportedThumbnailFileType(filePath: string, fileType?: string | null): BookFileType | null {
  const inferred = (fileType || inferBookFileTypeFromPath(filePath)).toLowerCase();
  if (
    inferred === "pdf" ||
    inferred === "epub" ||
    inferred === "cbz" ||
    inferred === "azw3" ||
    inferred === "kfx"
  ) {
    return inferred;
  }
  return null;
}

function isWithinRoot(rootPath: string, targetPath: string): boolean {
  const relative = path.relative(path.resolve(rootPath), path.resolve(targetPath));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function categoryForFile(filePath: string, rootPath: string): string | undefined {
  const relativePath = path.relative(rootPath, filePath);
  const pathParts = relativePath.split(path.sep).filter(Boolean);
  return pathParts.length > 1 ? pathParts[0] : undefined;
}

function categoryForFolder(folderPath: string, rootPath: string): string | undefined {
  const relativePath = path.relative(rootPath, folderPath);
  const pathParts = relativePath.split(path.sep).filter(Boolean);
  return pathParts[0];
}

export function getLibraryRoots(): LibraryRootInfo[] {
  const libraryPath = LIBRARY_PATH();
  const sourceFolders = getSourceFolders();
  return [
    {
      id: null,
      type: "library",
      label: "Biblioteca",
      path: libraryPath,
    },
    ...sourceFolders.map((folder) => ({
      id: folder.id,
      type: "source" as const,
      label: folder.label || path.basename(folder.path) || folder.path,
      path: folder.path,
    })),
  ];
}

function sourceRootForPath(filePath: string): WatchFolderRecord | undefined {
  const normalizedFile = normalizePathForCompare(filePath);
  return getSourceFolders().find((folder) => {
    const normalizedRoot = normalizePathForCompare(folder.path);
    return normalizedFile === normalizedRoot || normalizedFile.startsWith(`${normalizedRoot}/`);
  });
}

export function resolveManagedFolderPath(targetFolderPath: string | null | undefined): {
  targetDir: string;
  rootPath: string;
  rootType: "library" | "source";
  category?: string;
} {
  const libraryPath = LIBRARY_PATH();
  const sourceFolders = getSourceFolders();

  if (!targetFolderPath) {
    return {
      targetDir: libraryPath,
      rootPath: libraryPath,
      rootType: "library",
      category: undefined,
    };
  }

  if (path.isAbsolute(targetFolderPath)) {
    const resolvedTarget = path.resolve(targetFolderPath);
    const sourceRoot = sourceFolders.find((folder) => isWithinRoot(folder.path, resolvedTarget));
    if (sourceRoot) {
      return {
        targetDir: resolvedTarget,
        rootPath: path.resolve(sourceRoot.path),
        rootType: "source",
        category: categoryForFolder(resolvedTarget, sourceRoot.path),
      };
    }

    if (isWithinRoot(libraryPath, resolvedTarget)) {
      return {
        targetDir: resolvedTarget,
        rootPath: libraryPath,
        rootType: "library",
        category: categoryForFolder(resolvedTarget, libraryPath),
      };
    }

    throw new Error("Caminho inv\u00e1lido");
  }

  const targetDir = path.resolve(libraryPath, targetFolderPath);
  if (!isWithinRoot(libraryPath, targetDir)) {
    throw new Error("Caminho inv\u00e1lido");
  }

  return {
    targetDir,
    rootPath: libraryPath,
    rootType: "library",
    category: categoryForFolder(targetDir, libraryPath),
  };
}

export async function processFile(filePath: string, options: ProcessFileOptions = {}): Promise<void> {
  try {
    if (!fs.existsSync(filePath)) return;

    const lowerPath = filePath.toLowerCase();
    const isEpub = lowerPath.endsWith(".epub");
    const isCbz = lowerPath.endsWith(".cbz");
    const isPdf = lowerPath.endsWith(".pdf");
    const fileType: BookFileType = isCbz ? "cbz" : isEpub ? "epub" : "pdf";
    const thumbnailsDir = THUMBNAILS_DIR();
    const shouldGenerateThumbnail = options.generateThumbnail !== false;
    if (isCbz) {
      await validateCbzFile(filePath);
    }

    const stats = fs.statSync(filePath);
    const existingByPath = getDocumentByPath(filePath);
    const fileHash = generateFileHash(filePath);
    const existing = existingByPath || getDocumentByHash(fileHash);
    const sourceRoot = sourceRootForPath(filePath);
    const rootPath = options.rootPath || sourceRoot?.path || LIBRARY_PATH();
    const isSynced = options.isSynced ?? (Boolean(sourceRoot) || isWithinRoot(LIBRARY_PATH(), filePath));
    const category = categoryForFile(filePath, rootPath);

    if (existingByPath && existingByPath.fileHash !== fileHash) {
      updateDocumentFileIdentity(existingByPath.fileHash, fileHash, filePath, stats.size);
    }

    if (existing && existing.processingStatus === "completed") {
      if (existing.filePath !== filePath) updateDocumentPath(fileHash, filePath);
      updateDocumentSyncStatus(fileHash, isSynced, category);
      if (shouldGenerateThumbnail && !existing.thumbnailPath) {
        const thumbnailPath = await generateThumbnail(filePath, fileHash, {
          thumbnailsDir, force: false, fileType, logPrefix: "[LibraryService]",
        });
        if (thumbnailPath) updateThumbnailPath(fileHash, thumbnailPath);
      }
      const numPages = isPdf ? await getPdfPageCount(filePath) : isCbz ? await getCbzPageCount(filePath) : await getEpubChapterCount(filePath);
      updateDocumentNumPages(fileHash, numPages);
      updateFileSize(fileHash, fs.statSync(filePath).size);
      return;
    }

    if (existing) {
      updateProcessingStatus(fileHash, "processing");
    }

    const numPages = isPdf ? await getPdfPageCount(filePath) : isCbz ? await getCbzPageCount(filePath) : await getEpubChapterCount(filePath);
    const metadata = isPdf ? await extractPdfMetadata(filePath) : isCbz ? null : await extractEpubMetadata(filePath);
    const thumbnailPath = shouldGenerateThumbnail
      ? await generateThumbnail(filePath, fileHash, {
          thumbnailsDir, force: false, fileType, logPrefix: "[LibraryService]",
        })
      : null;

    if (existing) {
      if (thumbnailPath) updateThumbnailPath(fileHash, thumbnailPath);
      updateFileSize(fileHash, stats.size);
      if (metadata) {
        updateMetadata(fileHash, {
          title: metadata.title,
          author: metadata.author,
          publisher: metadata.producer,
          publishDate: metadata.creationDate,
        });
      }
      updateProcessingStatus(fileHash, "completed");
      updateDocumentPath(fileHash, filePath);
      updateDocumentSyncStatus(fileHash, isSynced, category);
    } else {
      const ext = isCbz ? ".cbz" : isEpub ? ".epub" : ".pdf";
      const title = path.basename(filePath, ext);
      addDocument(title, filePath, fileHash, thumbnailPath || undefined, numPages || 1, fileType);
      const newDoc = getDocumentByHash(fileHash);
      if (newDoc) {
        updateFileSize(fileHash, stats.size);
        if (metadata) {
          updateMetadata(fileHash, {
            title: metadata.title,
            author: metadata.author,
            publisher: metadata.producer,
            publishDate: metadata.creationDate,
          });
        }
        updateDocumentSyncStatus(fileHash, isSynced, category);
        updateProcessingStatus(fileHash, "completed");
      }
    }
  } catch (error) {
    console.error("[LibraryService] Error processing file:", error);
    const fileHash = generateFileHash(filePath);
    const existing = getDocumentByHash(fileHash);
    if (existing) {
      updateProcessingStatus(fileHash, "failed");
    }
  }
}

export async function scanLibrary(): Promise<ScanLibraryResult> {
  const roots = getLibraryRoots();
  let queued = 0;
  let skipped = 0;
  let total = 0;

  for (const root of roots) {
    if (!fs.existsSync(root.path)) continue;

    const bookFiles = getAllBookFilesUtil(root.path);
    for (const filePath of bookFiles) {
      total++;
      try {
        const existingByPath = getDocumentByPath(filePath);
        if (isCompletedDocumentCurrent(existingByPath, filePath)) {
          skipped++;
          continue;
        }

        const added = libraryJobQueue.enqueue({
          key: `scan:${normalizePathForCompare(filePath)}`,
          run: async () => {
            await processFile(filePath, {
              rootPath: root.path,
              isSynced: true,
              generateThumbnail: false,
            });
            return true;
          },
        });

        if (added) queued++;
      } catch (error) {
        console.error("[LibraryService] Error scanning:", filePath, error);
      }
    }
  }

  if (queued === 0 && skipped > 0) {
    emitLibraryChanged?.();
  }

  return { queued, skipped, total };
}

export function queueThumbnailGeneration(requests: ThumbnailRequest[]): { queued: number; skipped: number } {
  let queued = 0;
  let skipped = 0;

  for (const request of requests) {
    if (!request.fileHash || !request.filePath) {
      skipped++;
      continue;
    }

    const doc = getDocumentByHash(request.fileHash);
    if (!doc || !doc.filePath || normalizePathForCompare(doc.filePath) !== normalizePathForCompare(request.filePath)) {
      skipped++;
      continue;
    }

    if (!request.force && doc.thumbnailPath && fs.existsSync(doc.thumbnailPath)) {
      skipped++;
      continue;
    }

    const fileType = getSupportedThumbnailFileType(request.filePath, request.fileType);
    if (!fileType) {
      skipped++;
      continue;
    }

    const added = libraryJobQueue.enqueue({
      key: `thumb:${request.fileHash}`,
      run: async () => {
        const thumbnailPath = await generateThumbnail(request.filePath, request.fileHash, {
          thumbnailsDir: THUMBNAILS_DIR(),
          force: request.force === true,
          fileType,
          logPrefix: "[LibraryService]",
        });

        if (!thumbnailPath) return false;
        updateThumbnailPath(request.fileHash, thumbnailPath);
        return true;
      },
    });

    if (added) {
      queued++;
    } else {
      skipped++;
    }
  }

  return { queued, skipped };
}

export function queueAllThumbnailRegeneration(): { queued: number; skipped: number; total: number } {
  const docs = getAllDocuments();
  const result = queueThumbnailGeneration(
    docs
      .filter((doc) => Boolean(doc.fileHash && doc.filePath))
      .map((doc) => ({
        fileHash: doc.fileHash,
        filePath: doc.filePath,
        fileType: doc.fileType as BookFileType,
        force: true,
      })),
  );

  return {
    ...result,
    total: docs.length,
  };
}

export async function resyncLibrary(): Promise<{ added: number; removed: number; updated: number }> {
  const roots = getLibraryRoots().filter((root) => fs.existsSync(root.path));
  let added = 0, removed = 0, updated = 0;

  if (roots.length === 0) {
    return { added: 0, removed: 0, updated: 0 };
  }

  const bookFilesByRoot = roots.map((root) => ({
    root,
    files: getAllBookFilesUtil(root.path),
  }));
  const bookFileSet = new Set(bookFilesByRoot.flatMap(({ files }) => files.map((file) => normalizePathForCompare(file))));

  const allDocs = getAllDocuments();
  const docsInLibrary = allDocs.filter((doc) => {
    if (!doc.filePath || doc.isSynced !== 1) return false;
    return roots.some((root) => isWithinRoot(root.path, doc.filePath));
  });

  for (const doc of docsInLibrary) {
    if (doc.filePath && !bookFileSet.has(normalizePathForCompare(doc.filePath))) {
      deleteDocument(doc.fileHash);
      removed++;
    }
  }

  const processInBatches = async (root: LibraryRootInfo, files: string[], batchSize: number) => {
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      await Promise.all(batch.map(async (filePath) => {
        try {
          const fileHash = generateFileHash(filePath);
          const existing = getDocumentByHash(fileHash);
          if (!existing) {
            await processFile(filePath, { rootPath: root.path, isSynced: true });
            added++;
          } else if (existing.filePath !== filePath) {
            updateDocumentPath(fileHash, filePath);
            updateDocumentSyncStatus(fileHash, true, categoryForFile(filePath, root.path));
            updated++;
          }
        } catch (error) {
          console.error("[LibraryService] Resync error:", filePath, error);
        }
      }));
    }
  };

  for (const { root, files } of bookFilesByRoot) {
    await processInBatches(root, files, 10);
  }
  return { added, removed, updated };
}

export function getFolderStructure(rootPath: string = LIBRARY_PATH(), useAbsolutePaths = false): FolderInfo[] {
  if (!fs.existsSync(rootPath)) return [];

  const buildTree = (dirPath: string, relativeTo: string): FolderInfo[] => {
    if (!fs.existsSync(dirPath)) return [];
    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    const folders: FolderInfo[] = [];
    for (const item of items) {
      if (item.isDirectory() && !item.name.startsWith(".")) {
        const itemFullPath = path.join(dirPath, item.name);
        const relativePath = path.relative(relativeTo, itemFullPath);
        const bookFiles = getAllBookFilesUtil(itemFullPath);
        if (bookFiles.length === 0) continue;
        folders.push({
          name: item.name,
          path: useAbsolutePaths ? itemFullPath : relativePath,
          fullPath: itemFullPath,
          bookCount: bookFiles.length,
          subfolders: buildTree(itemFullPath, relativeTo),
        });
      }
    }
    return folders.sort((a, b) => a.name.localeCompare(b.name));
  };

  return buildTree(rootPath, rootPath);
}

export function getAllFoldersFlat(libraryPath: string): string[] {
  const folders: string[] = [];
  const scan = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      if (item.isDirectory() && !item.name.startsWith(".")) {
        const fullPath = path.join(dir, item.name);
        const relativePath = path.relative(libraryPath, fullPath);
        folders.push(relativePath);
        scan(fullPath);
      }
    }
  };
  scan(libraryPath);
  return folders.sort((a, b) => a.localeCompare(b));
}

export function getBooksInFolder(folderPath: string | null): DocumentRecord[] {
  const target = resolveManagedFolderPath(folderPath);
  const allDocs = getAllDocuments();
  if (folderPath === null) {
    return allDocs.filter((doc) => doc.filePath && isWithinRoot(target.rootPath, doc.filePath));
  }
  return allDocs.filter(d => {
    if (!d.filePath) return false;
    const docDir = path.dirname(d.filePath);
    return docDir === target.targetDir || docDir.startsWith(target.targetDir + path.sep);
  });
}
