import fs from "node:fs";
import path from "node:path";
import chokidar, { type FSWatcher } from "chokidar";
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
  ALL_BOOK_EXTENSIONS,
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
  isPdfMagicBytesValid,
  type BookFileType,
} from "./document-processing";

export interface FolderInfo {
  name: string;
  path: string;
  fullPath: string;
  bookCount: number;
  subfolders: FolderInfo[];
  hasChildren?: boolean;
  isLoaded?: boolean;
  stats?: FolderStats;
}

export interface FolderStats {
  bookCount: number;
  totalSizeMB: number;
  lastModified: string | null;
  formatBreakdown: Record<string, number>;
}

export interface FolderChangedPayload {
  event: "add" | "addDir" | "change" | "unlink" | "unlinkDir" | "manual";
  path?: string;
  rootPath?: string;
  changedAt: string;
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

export interface NotificationPayload {
  type: "success" | "error" | "warning";
  message: string;
}

let emitLibraryChanged: (() => void) | null = null;
let emitNotification: ((notification: NotificationPayload) => void) | null = null;
let emitFolderChanged: ((payload: FolderChangedPayload) => void) | null = null;
let folderWatcher: FSWatcher | null = null;
let folderWatchDebounce: ReturnType<typeof setTimeout> | null = null;

const FOLDER_STRUCTURE_CACHE_LIMIT = 8;
const folderStructureCache = new Map<string, {
  rootMtime: number;
  value: FolderInfo[];
}>();

export function setLibraryChangeEmitter(callback: (() => void) | null) {
  emitLibraryChanged = callback;
}

export function setNotificationEmitter(callback: ((notification: NotificationPayload) => void) | null) {
  emitNotification = callback;
}

export function setFolderChangeEmitter(callback: ((payload: FolderChangedPayload) => void) | null) {
  emitFolderChanged = callback;
}

let lastNotification: { type: string; message: string } | null = null;

function sendNotification(type: NotificationPayload["type"], message: string) {
  if (lastNotification?.type === type && lastNotification?.message === message) return;
  lastNotification = { type, message };
  emitNotification?.({ type, message });
  if (type === "error") {
    console.error(`[Notification] ${message}`);
  } else {
    console.warn(`[Notification] ${message}`);
  }
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

function normalizeCachePath(filePath: string): string {
  return path.resolve(filePath).replace(/\\/g, "/");
}

function safeStat(targetPath: string): fs.Stats | null {
  try {
    return fs.statSync(targetPath);
  } catch {
    return null;
  }
}

function safeReadDir(dirPath: string): fs.Dirent[] {
  try {
    return fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }
}

function isVisibleDirectory(item: fs.Dirent): boolean {
  return item.isDirectory() && !item.name.startsWith(".");
}

function isBookFileName(fileName: string): boolean {
  return ALL_BOOK_EXTENSIONS.has(path.extname(fileName).toLowerCase());
}

function getRootMtime(rootPath: string): number {
  return safeStat(rootPath)?.mtimeMs ?? 0;
}

function getCacheKey(rootPath: string, useAbsolutePaths: boolean): string {
  return `${normalizeCachePath(rootPath)}::${useAbsolutePaths ? "abs" : "rel"}`;
}

function setCachedFolderStructure(key: string, rootMtime: number, value: FolderInfo[]) {
  folderStructureCache.delete(key);
  folderStructureCache.set(key, { rootMtime, value });

  while (folderStructureCache.size > FOLDER_STRUCTURE_CACHE_LIMIT) {
    const oldestKey = folderStructureCache.keys().next().value;
    if (!oldestKey) break;
    folderStructureCache.delete(oldestKey);
  }
}

export function invalidateFolderStructureCache(rootPath?: string) {
  if (!rootPath) {
    folderStructureCache.clear();
    return;
  }

  const normalizedRoot = normalizeCachePath(rootPath);
  for (const key of Array.from(folderStructureCache.keys())) {
    if (key.startsWith(`${normalizedRoot}::`)) {
      folderStructureCache.delete(key);
    }
  }
}

export function notifyFolderChanged(payload: Partial<FolderChangedPayload> = {}) {
  invalidateFolderStructureCache(payload.rootPath);
  emitFolderChanged?.({
    event: payload.event ?? "manual",
    path: payload.path,
    rootPath: payload.rootPath,
    changedAt: new Date().toISOString(),
  });
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
    const isPdf = lowerPath.endsWith(".pdf");
    const isEpub = lowerPath.endsWith(".epub");
    const isCbz = lowerPath.endsWith(".cbz");
    const isAzw3 = lowerPath.endsWith(".azw3");
    const isKfx = lowerPath.endsWith(".kfx");
    if (!isPdf && !isEpub && !isCbz && !isAzw3 && !isKfx) return;
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
          onWarning: (msg) => sendNotification("warning", msg),
        });
        if (thumbnailPath) {
          updateThumbnailPath(fileHash, thumbnailPath);
        } else if (isPdf && !isPdfMagicBytesValid(filePath)) {
          sendNotification("warning", `PDF appears corrupted: ${path.basename(filePath)}`);
          updateProcessingStatus(fileHash, "failed");
          emitLibraryChanged?.();
        }
      }
      const numPages = isPdf ? await getPdfPageCount(filePath) : isCbz ? await getCbzPageCount(filePath) : await getEpubChapterCount(filePath);
      updateDocumentNumPages(fileHash, numPages);
      updateFileSize(fileHash, fs.statSync(filePath).size);
      return;
    }

    if (existing && existing.processingStatus === "failed" && isPdf && !isPdfMagicBytesValid(filePath)) {
      emitLibraryChanged?.();
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
          onWarning: (msg) => sendNotification("warning", msg),
        })
      : null;

    const pdfCorrupted = isPdf && !thumbnailPath && !isPdfMagicBytesValid(filePath);
    if (pdfCorrupted) {
      sendNotification("warning", `PDF appears corrupted: ${path.basename(filePath)}`);
    }

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
      updateProcessingStatus(fileHash, pdfCorrupted ? "failed" : "completed");
      updateDocumentPath(fileHash, filePath);
      updateDocumentSyncStatus(fileHash, isSynced, category);
      emitLibraryChanged?.();
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
        updateProcessingStatus(fileHash, pdfCorrupted ? "failed" : "completed");
        emitLibraryChanged?.();
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
    const items = safeReadDir(dirPath);
    const folders: FolderInfo[] = [];
    for (const item of items) {
      if (isVisibleDirectory(item)) {
        const itemFullPath = path.join(dirPath, item.name);
        const relativePath = path.relative(relativeTo, itemFullPath);
        const bookFiles = getAllBookFilesUtil(itemFullPath);
        const subfolders = buildTree(itemFullPath, relativeTo);
        folders.push({
          name: item.name,
          path: useAbsolutePaths ? itemFullPath : relativePath,
          fullPath: itemFullPath,
          bookCount: bookFiles.length,
          subfolders,
          hasChildren: subfolders.length > 0,
          isLoaded: true,
        });
      }
    }
    return folders.sort((a, b) => a.name.localeCompare(b.name));
  };

  return buildTree(rootPath, rootPath);
}

export function getFolderStructureCached(
  rootPath: string = LIBRARY_PATH(),
  useAbsolutePaths = false,
): FolderInfo[] {
  if (!fs.existsSync(rootPath)) return [];

  const key = getCacheKey(rootPath, useAbsolutePaths);
  const rootMtime = getRootMtime(rootPath);
  const cached = folderStructureCache.get(key);
  if (cached && cached.rootMtime === rootMtime) {
    folderStructureCache.delete(key);
    folderStructureCache.set(key, cached);
    return cached.value;
  }

  const value = getFolderStructure(rootPath, useAbsolutePaths);
  setCachedFolderStructure(key, rootMtime, value);
  return value;
}

function countDirectBookFiles(folderPath: string): number {
  return safeReadDir(folderPath).filter((item) => item.isFile() && isBookFileName(item.name)).length;
}

function hasVisibleSubfolders(folderPath: string): boolean {
  return safeReadDir(folderPath).some(isVisibleDirectory);
}

export function getFolderChildren(parentPath: string | null = null): FolderInfo[] {
  const target = resolveManagedFolderPath(parentPath);
  if (!fs.existsSync(target.targetDir)) return [];

  const useAbsolutePaths = target.rootType === "source";
  return safeReadDir(target.targetDir)
    .filter(isVisibleDirectory)
    .map((item) => {
      const itemFullPath = path.join(target.targetDir, item.name);
      return {
        name: item.name,
        path: useAbsolutePaths ? itemFullPath : path.relative(target.rootPath, itemFullPath),
        fullPath: itemFullPath,
        bookCount: countDirectBookFiles(itemFullPath),
        subfolders: [],
        hasChildren: hasVisibleSubfolders(itemFullPath),
        isLoaded: false,
      } satisfies FolderInfo;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getFolderStats(folderPath: string | null = null): FolderStats {
  const target = resolveManagedFolderPath(folderPath);
  let bookCount = 0;
  let totalBytes = 0;
  let newestMtime = safeStat(target.targetDir)?.mtimeMs ?? 0;
  const formatBreakdown: Record<string, number> = {};
  const pending = [target.targetDir];

  while (pending.length > 0) {
    const currentDir = pending.pop();
    if (!currentDir) continue;

    for (const item of safeReadDir(currentDir)) {
      const itemPath = path.join(currentDir, item.name);
      const stats = safeStat(itemPath);
      if (!stats) continue;
      newestMtime = Math.max(newestMtime, stats.mtimeMs);

      if (isVisibleDirectory(item)) {
        pending.push(itemPath);
        continue;
      }

      if (!item.isFile() || !isBookFileName(item.name)) continue;
      const format = path.extname(item.name).slice(1).toLowerCase() || "unknown";
      bookCount++;
      totalBytes += stats.size;
      formatBreakdown[format] = (formatBreakdown[format] ?? 0) + 1;
    }
  }

  return {
    bookCount,
    totalSizeMB: Number((totalBytes / (1024 * 1024)).toFixed(2)),
    lastModified: newestMtime > 0 ? new Date(newestMtime).toISOString() : null,
    formatBreakdown,
  };
}

export function folderExists(folderPath: string | null = null): boolean {
  try {
    return safeStat(resolveManagedFolderPath(folderPath).targetDir)?.isDirectory() ?? false;
  } catch {
    return false;
  }
}

function findWatchedRootForPath(changedPath?: string): string | undefined {
  if (!changedPath) return undefined;
  return getLibraryRoots()
    .map((root) => root.path)
    .find((rootPath) => isWithinRoot(rootPath, changedPath));
}

function scheduleFolderChanged(event: FolderChangedPayload["event"], changedPath?: string) {
  const rootPath = findWatchedRootForPath(changedPath);
  invalidateFolderStructureCache(rootPath);

  if (folderWatchDebounce) {
    clearTimeout(folderWatchDebounce);
  }

  folderWatchDebounce = setTimeout(() => {
    folderWatchDebounce = null;
    notifyFolderChanged({ event, path: changedPath, rootPath });
  }, 250);
}

export function stopLibraryPathWatcher() {
  if (folderWatchDebounce) {
    clearTimeout(folderWatchDebounce);
    folderWatchDebounce = null;
  }

  if (folderWatcher) {
    void folderWatcher.close();
    folderWatcher = null;
  }
}

export function watchLibraryPath() {
  stopLibraryPathWatcher();

  const watchedPaths = getLibraryRoots()
    .map((root) => root.path)
    .filter((rootPath) => fs.existsSync(rootPath));

  if (watchedPaths.length === 0) return;

  folderWatcher = chokidar.watch(watchedPaths, {
    persistent: true,
    ignoreInitial: true,
    depth: 99,
    awaitWriteFinish: {
      stabilityThreshold: 500,
      pollInterval: 100,
    },
  });

  for (const event of ["add", "addDir", "change", "unlink", "unlinkDir"] as const) {
    folderWatcher.on(event, (changedPath) => {
      scheduleFolderChanged(event, changedPath);
    });
  }

  folderWatcher.on("error", (error) => {
    console.error("[LibraryService] Folder watcher error:", error);
  });
}

export function refreshLibraryPathWatcher() {
  watchLibraryPath();
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

async function getAllBookFilesAsync(dir: string): Promise<string[]> {
  const results: string[] = [];
  let items: fs.Dirent[];
  try {
    items = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  await Promise.all(items.map(async (item) => {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      results.push(...await getAllBookFilesAsync(fullPath));
      return;
    }
    if (ALL_BOOK_EXTENSIONS.has(path.extname(item.name).toLowerCase())) {
      results.push(fullPath);
    }
  }));

  return results;
}

export async function getFolderStructureAsync(
  rootPath: string = LIBRARY_PATH(),
  useAbsolutePaths = false,
): Promise<FolderInfo[]> {
  if (!fs.existsSync(rootPath)) return [];

  const buildTree = async (dirPath: string, relativeTo: string): Promise<FolderInfo[]> => {
    let items: fs.Dirent[];
    try {
      items = await fs.promises.readdir(dirPath, { withFileTypes: true });
    } catch {
      return [];
    }

    const folders: Array<FolderInfo | null> = await Promise.all(items.map(async (item) => {
      if (!item.isDirectory() || item.name.startsWith(".")) return null;

      const itemFullPath = path.join(dirPath, item.name);
      const bookFiles = await getAllBookFilesAsync(itemFullPath);
      const subfolders = await buildTree(itemFullPath, relativeTo);

      return {
        name: item.name,
        path: useAbsolutePaths ? itemFullPath : path.relative(relativeTo, itemFullPath),
        fullPath: itemFullPath,
        bookCount: bookFiles.length,
        subfolders,
        hasChildren: subfolders.length > 0,
        isLoaded: true,
      } satisfies FolderInfo;
    }));

    return folders
      .filter((folder): folder is FolderInfo => Boolean(folder))
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  return buildTree(rootPath, rootPath);
}

export async function getAllFoldersFlatAsync(libraryPath: string): Promise<string[]> {
  const folders: string[] = [];
  const scan = async (dir: string) => {
    let items: fs.Dirent[];
    try {
      items = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    await Promise.all(items.map(async (item) => {
      if (!item.isDirectory() || item.name.startsWith(".")) return;
      const fullPath = path.join(dir, item.name);
      folders.push(path.relative(libraryPath, fullPath));
      await scan(fullPath);
    }));
  };

  await scan(libraryPath);
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
