import Database from "better-sqlite3";
import electron from "electron";
import path from "path";
import type { BookCategory, CategoryRepository } from "../src/core/library/category";
import type {
  DocumentMetadataPatch,
  DocumentMetadataRepository,
} from "../src/core/library/document-metadata";
import type { DocumentFileRepository } from "../src/core/library/document-files";
import { type ReaderProgressRepository, type ReadingPosition } from "../src/core/reader/progress";
import {
  CURRENT_SQLITE_SCHEMA_VERSION,
  getSqliteSchemaVersion,
  runDatabaseMigrations,
} from "./database-migrations";
import {
  createAnnotationRepository,
  ensureAnnotationSchema,
} from "./annotation-repository";
import {
  ensureApplicationSchema,
  ensureBootstrapSchema,
  ensurePostMigrationSchema,
} from "./infrastructure/sqlite-schema";
import {
  createSqliteDocumentQueryRepository,
  type DocumentQueryRepository,
} from "./infrastructure/sqlite-document-query";
import {
  createSqliteDocumentSearchIndex,
  type DocumentSearchIndex,
} from "./infrastructure/sqlite-document-search-index";
import { createSqliteDocumentMetadataRepository } from "./infrastructure/sqlite-document-metadata-repository";
import { createSqliteDocumentFileRepository } from "./infrastructure/sqlite-document-file-repository";
import { createSqliteReaderProgressRepository } from "./infrastructure/sqlite-reader-progress-repository";
import { getFileMtime, getFileName, getFolderPath } from "./infrastructure/document-file-metadata";
import { createSqliteCategoryRepository } from "./infrastructure/sqlite-category-repository";
import {
  createSqliteWordIndexRepository,
  type WordIndexEntry,
  type WordIndexRepository,
} from "./infrastructure/sqlite-word-index-repository";
import {
  createSqliteWatchFolderRepository,
  type WatchFolderRecord,
  type WatchFolderRepository,
} from "./infrastructure/sqlite-watch-folder-repository";
import type {
  BookFileType,
  DocumentRecord,
  LibraryFileTypeFilter,
  LibraryListQuery,
  LibraryListResult,
  LibrarySection,
  LibrarySortOption,
  ReadingStatus,
} from "../src/types/LibraryTypes";
import type {
  AnnotatedPage,
  ConceptGraphPayload,
  ConceptRelation,
  CreateKeyConceptInput,
  KeyConcept,
  UpdateKeyConceptInput,
} from "../src/types/AnnotationTypes";

const { app } = electron;

export type {
  BookFileType,
  DocumentRecord,
  LibraryFileTypeFilter,
  LibraryListQuery,
  LibraryListResult,
  LibrarySection,
  LibrarySortOption,
};

export type { BookCategory } from "../src/core/library/category";

export interface DocumentWithCategories extends DocumentRecord {
  categories: BookCategory[];
}

let db: Database.Database;
let annotations: ReturnType<typeof createAnnotationRepository>;
let documentQueries: DocumentQueryRepository;
let documentSearchIndex: DocumentSearchIndex;
let documentMetadata: DocumentMetadataRepository;
let documentFiles: DocumentFileRepository;
let readerProgress: ReaderProgressRepository;
let categories: CategoryRepository;
let wordIndex: WordIndexRepository;
let watchFolders: WatchFolderRepository;

function normalizeStoredPath(filePath: string | null | undefined): string | null {
  return filePath ? filePath.replace(/\\/g, "/") : null;
}

function hydrateDocumentFileMetadata(): void {
  try {
    const docs = db.prepare<[], Pick<DocumentRecord, "id" | "filePath" | "fileName" | "folderPath" | "fileMtime">>(
      `SELECT id, filePath, fileName, folderPath, fileMtime FROM documents WHERE filePath IS NOT NULL`
    ).all();

    const update = db.prepare(
      `UPDATE documents
       SET fileName = ?,
           folderPath = ?,
           fileMtime = COALESCE(?, fileMtime),
           importedAt = COALESCE(importedAt, createdAt),
           updatedAt = COALESCE(updatedAt, createdAt)
       WHERE id = ?`
    );

    const updateMany = db.transaction((items: typeof docs) => {
      for (const doc of items) {
        const nextFileName = doc.fileName || getFileName(doc.filePath);
        const nextFolderPath = getFolderPath(doc.filePath);
        const nextMtime = doc.fileMtime ?? getFileMtime(doc.filePath);

        update.run(nextFileName, nextFolderPath, nextMtime, doc.id);
      }
    });

    updateMany(docs);
  } catch (error) {
    console.error("[DB] Error hydrating document file metadata:", error);
  }
}

export function initDatabase() {
  const startedAt = Date.now();
  const dbPath = path.join(app.getPath("userData"), "app.db");
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.pragma("temp_store = MEMORY");
  documentQueries = createSqliteDocumentQueryRepository(
    db,
    path.join(app.getPath("userData"), "library"),
  );

  ensureBootstrapSchema(db);

  try {
    runDatabaseMigrations(db, 1, ({ version, name }) => {
      console.info(`[DB] Applied SQLite migration ${version}: ${name}`);
    });
  } catch (error) {
    console.error("[DB] Core SQLite migration failed:", {
      dbPath,
      schemaVersion: getSqliteSchemaVersion(db),
      error,
    });
    db.close();
    throw error;
  }

  ensureApplicationSchema(db);


  try {
    runDatabaseMigrations(db, CURRENT_SQLITE_SCHEMA_VERSION, ({ version, name }) => {
      console.info(`[DB] Applied SQLite migration ${version}: ${name}`);
    });
  } catch (error) {
    console.error("[DB] SQLite migration failed:", {
      dbPath,
      schemaVersion: getSqliteSchemaVersion(db),
      error,
    });
    db.close();
    throw error;
  }

  ensureAnnotationSchema(db);
  annotations = createAnnotationRepository(db);

  ensurePostMigrationSchema(db);
  categories = createSqliteCategoryRepository(
    db,
    path.join(app.getPath("userData"), "library"),
  );
  wordIndex = createSqliteWordIndexRepository(db);
  watchFolders = createSqliteWatchFolderRepository(db);

  const updateStmt = db.prepare(`
    UPDATE documents
    SET thumbnailPath = REPLACE(thumbnailPath, '.jpg', '-1.jpg')
    WHERE thumbnailPath IS NOT NULL AND thumbnailPath NOT LIKE '%-1.jpg'
  `);
  updateStmt.run();

  db.exec(`
    UPDATE documents
    SET fileType = CASE
      WHEN LOWER(filePath) LIKE '%.epub' THEN 'epub'
      WHEN LOWER(filePath) LIKE '%.pdf' THEN 'pdf'
      ELSE fileType
    END
    WHERE filePath IS NOT NULL
  `);

  db.exec(`DELETE FROM documents WHERE fileType = 'pdf' AND LOWER(filePath) LIKE '%.docx'`);
  db.exec(`DELETE FROM documents WHERE fileType = 'pdf' AND LOWER(filePath) LIKE '%.txt'`);
  db.exec(`DELETE FROM documents WHERE fileType = 'pdf' AND LOWER(filePath) LIKE '%.html'`);
  db.exec(`DELETE FROM documents WHERE fileType = 'pdf' AND LOWER(filePath) LIKE '%.htm'`);

  hydrateDocumentFileMetadata();

  documentSearchIndex = createSqliteDocumentSearchIndex(db);
  documentSearchIndex.rebuild();
  documentMetadata = createSqliteDocumentMetadataRepository(db, documentSearchIndex);
  documentFiles = createSqliteDocumentFileRepository(db, documentSearchIndex);
  readerProgress = createSqliteReaderProgressRepository(db);
  console.info("[DB] SQLite ready", {
    dbPath,
    schemaVersion: getSqliteSchemaVersion(db),
    expectedSchemaVersion: CURRENT_SQLITE_SCHEMA_VERSION,
    durationMs: Date.now() - startedAt,
  });
  return db;
}

export function getCategoryRepository(): CategoryRepository {
  return categories;
}

export function getDocumentMetadataRepository(): DocumentMetadataRepository {
  return documentMetadata;
}

export function createCategory(name: string, color?: string): BookCategory | null {
  return categories.create(name, color);
}

export function updateCategory(id: number, name: string, color: string): boolean {
  return categories.update(id, name, color);
}

export function deleteCategory(id: number): boolean {
  return categories.remove(id);
}

export function getAllCategories(): BookCategory[] {
  return categories.list();
}

export function getCategoryById(id: number): BookCategory | null {
  return categories.find(id);
}

export function getCategoriesForDocument(documentId: number): BookCategory[] {
  return categories.listForDocument(documentId);
}

export function getCategoriesForDocumentByHash(fileHash: string): BookCategory[] {
  return categories.listForDocumentHash(fileHash);
}

export function setDocumentCategories(documentId: number, categoryIds: number[]): boolean {
  return categories.setForDocument(documentId, categoryIds);
}

export function addCategoryToDocument(documentId: number, categoryId: number): boolean {
  return categories.addToDocument(documentId, categoryId);
}

export function removeCategoryFromDocument(documentId: number, categoryId: number): boolean {
  return categories.removeFromDocument(documentId, categoryId);
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
  return categories.listColors();
}

export function importCategoriesFromFolders(): number {
  return categories.importFromFolders();
}

export function updateLastOpened(fileHash: string) {
  readerProgress.markOpened(fileHash);
}

export function updateReadingState(fileHash: string, state: ReadingPosition) {
  readerProgress.savePosition(fileHash, state);
}

export function updateReadingStatus(fileHash: string, status: ReadingStatus): boolean {
  const updated = readerProgress.updateStatus(fileHash, status);
  // A merged book (several formats sharing a bookId) is one book in the
  // library view, so keep every variant in the same status category.
  const document = documentQueries.byHash(fileHash);
  if (document?.bookId) {
    for (const variant of documentQueries.byBookId(document.bookId)) {
      if (variant.fileHash !== fileHash) {
        readerProgress.updateStatus(variant.fileHash, status);
      }
    }
  }
  return updated;
}

export function createKeyConcept(input: CreateKeyConceptInput): KeyConcept {
  return annotations.createConcept(input);
}

export function updateKeyConcept(id: string, updates: UpdateKeyConceptInput): KeyConcept {
  return annotations.updateConcept(id, updates);
}

export function deleteKeyConcept(id: string): boolean {
  return annotations.deleteConcept(id);
}

export function createConceptRelation(
  bookId: string,
  conceptAId: string,
  conceptBId: string,
): ConceptRelation {
  return annotations.createRelation(bookId, conceptAId, conceptBId);
}

export function deleteConceptRelation(conceptAId: string, conceptBId: string): boolean {
  return annotations.deleteRelation(conceptAId, conceptBId);
}

export function getKeyConceptsByBook(bookId: string): KeyConcept[] {
  return annotations.getConceptsByBook(bookId);
}

export function getKeyConceptsByPage(bookId: string, page: number): KeyConcept[] {
  return annotations.getConceptsByPage(bookId, page);
}

export function getConceptGraph(bookId: string): ConceptGraphPayload {
  return annotations.getGraph(bookId);
}

export function getAnnotatedPages(bookId: string): AnnotatedPage[] {
  return annotations.getAnnotatedPages(bookId);
}

export function getRelatedKeyConcepts(conceptId: string): KeyConcept[] {
  return annotations.getRelatedConcepts(conceptId);
}

export function addDocument(
  title: string,
  filePath: string,
  fileHash: string,
  thumbnailPath: string | undefined,
  numPages: number = 1,
  fileType: BookFileType = "pdf",
  isSynced: number = 0,
) {
  const statement = db.prepare(`
        INSERT INTO documents (title, filePath, fileHash, fileName, folderPath, fileMtime, thumbnailPath, numPages, fileType, isSynced)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
  const result = statement.run(
    title,
    filePath,
    fileHash,
    getFileName(filePath),
    getFolderPath(filePath),
    getFileMtime(filePath),
    thumbnailPath || null,
    numPages,
    fileType,
    isSynced,
  );
  documentSearchIndex.refreshById(result.lastInsertRowid as number);
  return result;
}
export function getAllDocuments(): DocumentRecord[] {
  return documentQueries.all();
}

export function getDocumentFolderCounts(): Record<string, number> {
  return documentQueries.folderCounts();
}

export function listDocuments(query: LibraryListQuery = {}): LibraryListResult {
  return documentQueries.list(query);
}
export function getDocumentByHash(
  fileHash: string,
): DocumentRecord | undefined {
  return documentQueries.byHash(fileHash);
}

export function getDocumentByFilePath(
  filePath: string,
): DocumentRecord | undefined {
  return documentQueries.byFilePath(filePath);
}

export function getLastDocument(): DocumentRecord | undefined {
  return documentQueries.lastOpened();
}

export function updateDocumentBookId(fileHash: string, bookId: string | null): void {
  db.prepare(
    `UPDATE documents SET bookId = ? WHERE fileHash = ?`
  ).run(bookId, fileHash);
}

export function getDocumentsByBookId(bookId: string): DocumentRecord[] {
  return documentQueries.byBookId(bookId);
}

export function unmergeDocuments(bookId: string): DocumentRecord[] {
  const documents = getDocumentsByBookId(bookId);
  if (documents.length === 0) return [];

  const clearGroup = db.transaction((items: DocumentRecord[]) => {
    const update = db.prepare(`
      UPDATE documents
      SET bookId = NULL, updatedAt = CURRENT_TIMESTAMP
      WHERE fileHash = ?
    `);
    for (const document of items) {
      update.run(document.fileHash);
      documentSearchIndex.refreshByHash(document.fileHash);
    }
  });
  clearGroup(documents);
  return documents.map((document) => ({ ...document, bookId: null }));
}

type SharedMetadata = Pick<
  DocumentRecord,
  | "author"
  | "description"
  | "isbn"
  | "publisher"
  | "publishDate"
  | "language"
  | "identifier"
  | "asin"
  | "subject"
  | "series"
  | "seriesIndex"
  | "authorSort"
  | "titleSort"
>;

const SHARED_METADATA_FIELDS: (keyof SharedMetadata)[] = [
  // "title" is intentionally not shared: each format variant keeps its own
  // file name after a merge instead of being overwritten by one title.
  "author",
  "description",
  "isbn",
  "publisher",
  "publishDate",
  "language",
  "identifier",
  "asin",
  "subject",
  "series",
  "seriesIndex",
  "authorSort",
  "titleSort",
];

function hasMeaningfulValue(value: unknown): boolean {
  return typeof value === "string" ? value.trim().length > 0 : value !== null && value !== undefined;
}

export function mergeDocuments(fileHashes: string[], bookId: string): {
  success: boolean;
  bookId: string;
  mergedCount: number;
  documents: DocumentRecord[];
  error?: string;
} {
  const uniqueHashes = Array.from(new Set(fileHashes.filter(Boolean)));
  if (uniqueHashes.length < 2) {
    return { success: false, bookId, mergedCount: 0, documents: [], error: "Selecione pelo menos dois livros" };
  }

  const selectedDocs = uniqueHashes
    .map((fileHash) => getDocumentByHash(fileHash))
    .filter((doc): doc is DocumentRecord => Boolean(doc));

  if (selectedDocs.length < 2) {
    return { success: false, bookId, mergedCount: 0, documents: [], error: "Livros nao encontrados" };
  }

  const existingBookIds = Array.from(
    new Set(selectedDocs.map((doc) => doc.bookId).filter((value): value is string => Boolean(value))),
  );
  const groupedDocs = existingBookIds.flatMap((existingBookId) => getDocumentsByBookId(existingBookId));
  const allDocsByHash = new Map<string, DocumentRecord>();
  for (const doc of [...selectedDocs, ...groupedDocs]) {
    allDocsByHash.set(doc.fileHash, doc);
  }

  const allDocs = Array.from(allDocsByHash.values());
  const canonical = selectedDocs[0]!;
  const sharedMetadata = SHARED_METADATA_FIELDS.reduce((metadata, field) => {
    const canonicalValue = canonical[field];
    const fallbackValue = allDocs.find((doc) => hasMeaningfulValue(doc[field]))?.[field] ?? null;
    return {
      ...metadata,
      [field]: hasMeaningfulValue(canonicalValue) ? canonicalValue : fallbackValue,
    };
  }, {} as SharedMetadata);
  const sharedThumbnailPath =
    canonical.thumbnailPath ||
    allDocs.find((doc) => hasMeaningfulValue(doc.thumbnailPath))?.thumbnailPath ||
    null;

  const updateSql = `
    UPDATE documents
    SET bookId = ?,
        title = ?,
        author = ?,
        description = ?,
        isbn = ?,
        publisher = ?,
        publishDate = ?,
        language = ?,
        identifier = ?,
        asin = ?,
        subject = ?,
        series = ?,
        seriesIndex = ?,
        authorSort = ?,
        titleSort = ?,
        thumbnailPath = COALESCE(?, thumbnailPath),
        updatedAt = CURRENT_TIMESTAMP
    WHERE fileHash = ?
  `;
  const update = db.prepare(updateSql);

  const updateMany = db.transaction((docs: DocumentRecord[]) => {
    for (const doc of docs) {
      update.run(
        bookId,
        // Each format variant keeps the name of its own file: merging books
        // must not replace distinct names with one shared title.
        doc.title,
        sharedMetadata.author,
        sharedMetadata.description,
        sharedMetadata.isbn,
        sharedMetadata.publisher,
        sharedMetadata.publishDate,
        sharedMetadata.language,
        sharedMetadata.identifier,
        sharedMetadata.asin,
        sharedMetadata.subject,
        sharedMetadata.series,
        sharedMetadata.seriesIndex,
        sharedMetadata.authorSort,
        sharedMetadata.titleSort,
        sharedThumbnailPath,
        doc.fileHash,
      );
      documentSearchIndex.refreshByHash(doc.fileHash);
    }
  });

  updateMany(allDocs);

  return {
    success: true,
    bookId,
    mergedCount: allDocs.length,
    documents: allDocs.map((doc) => getDocumentByHash(doc.fileHash)).filter((doc): doc is DocumentRecord => Boolean(doc)),
  };
}

export function getDocumentByTitle(title: string): DocumentRecord | undefined {
  return documentQueries.byTitle(title);
}

export function getDocumentByPath(filePath: string): DocumentRecord | undefined {
  return documentQueries.byFilePath(filePath);
}

export function updateDocumentPath(fileHash: string, newPath: string) {
  documentFiles.updatePath(fileHash, newPath);
}

export function updateDocumentFileType(
  fileHash: string,
  fileType: BookFileType
) {
  documentFiles.updateFileType(fileHash, fileType);
}

export function updateDocumentNumPages(fileHash: string, numPages: number) {
  documentFiles.updateNumPages(fileHash, numPages);
}

export function updateDocumentSyncStatus(fileHash: string, isSynced: boolean, category?: string) {
  documentFiles.updateSyncStatus(fileHash, isSynced, category);
}

/**
 * Everything a cover thumbnail can be reached by: recorded paths, plus the
 * hash of every known file (thumb:// resolves covers by hash prefix).
 */
export function listReferencedThumbnailPaths(): string[] {
  const rows = db.prepare("SELECT thumbnailPath, fileHash FROM documents").all() as Array<{ thumbnailPath: string | null; fileHash: string | null }>;
  const references: string[] = [];
  for (const row of rows) {
    if (row.thumbnailPath) references.push(row.thumbnailPath);
    if (row.fileHash) references.push(`${row.fileHash}-*`);
  }
  return references;
}

export function updateThumbnailPath(fileHash: string, thumbnailPath: string) {
  documentFiles.updateThumbnailPath(fileHash, thumbnailPath);
}

export function getDocumentsBySyncStatus(synced: boolean): DocumentRecord[] {
  return documentQueries.bySyncStatus(synced);
}

export function getCategories(): string[] {
  return documentQueries.legacyCategories();
}

export function searchDocuments(query: string): DocumentRecord[] {
  return documentQueries.searchTitles(query);
}

export function toggleFavorite(fileHash: string): boolean {
  return documentMetadata.toggleFavorite(fileHash);
}

export function updateRating(fileHash: string, rating: number): void {
  documentMetadata.updateRating(fileHash, rating);
  // Score belongs to the merged book, not a single format variant.
  const document = documentQueries.byHash(fileHash);
  if (document?.bookId) {
    for (const variant of documentQueries.byBookId(document.bookId)) {
      if (variant.fileHash !== fileHash) {
        documentMetadata.updateRating(variant.fileHash, rating);
      }
    }
  }
}

export function updateNotes(fileHash: string, notes: string): void {
  documentMetadata.updateNotes(fileHash, notes);
}

export function updateMetadata(fileHash: string, metadata: DocumentMetadataPatch): void {
  documentMetadata.updateMetadata(fileHash, metadata);
}

export function updateProcessingStatus(
  fileHash: string,
  status: "pending" | "processing" | "completed" | "failed"
): void {
  documentFiles.updateProcessingStatus(fileHash, status);
}

export function getDocumentsPendingProcessing(): DocumentRecord[] {
  return documentQueries.pendingProcessing();
}

export function updateFileSize(fileHash: string, fileSize: number): void {
  documentFiles.updateFileSize(fileHash, fileSize);
}

export function updateDocumentFileIdentity(
  oldFileHash: string,
  newFileHash: string,
  filePath: string,
  fileSize: number,
): void {
  documentFiles.updateIdentity(oldFileHash, newFileHash, filePath, fileSize);
}

export function updateTitle(fileHash: string, newTitle: string): void {
  documentMetadata.updateTitle(fileHash, newTitle);
}

export function updateAuthor(fileHash: string, author: string | null): void {
  documentMetadata.updateAuthor(fileHash, author);
}

export function deleteDocument(fileHash: string): { success: boolean; error?: string } {
  return documentFiles.remove(fileHash);
}

export function getDocumentById(id: number): DocumentRecord | undefined {
  return documentQueries.byId(id);
}

export function getFavoriteDocuments(): DocumentRecord[] {
  return documentMetadata.getFavorites();
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
  language: string | null;
  identifier: string | null;
  asin: string | null;
  subject: string | null;
  series: string | null;
  seriesIndex: string | null;
  authorSort: string | null;
  titleSort: string | null;
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

export interface DocumentCategoryRecord {
  documentId: number;
  categoryId: number;
}

export function getAllDocumentCategories(): DocumentCategoryRecord[] {
  return db.prepare<[], DocumentCategoryRecord>(`SELECT documentId, categoryId FROM document_categories`).all();
}

export type { WordIndexEntry };

export function saveWordIndex(fileHash: string, words: WordIndexEntry[]): void {
  wordIndex.save(fileHash, words);
}

export function getWordIndex(fileHash: string): WordIndexEntry[] {
  return wordIndex.list(fileHash);
}

export function getWordCount(fileHash: string, word: string): number {
  return wordIndex.count(fileHash, word);
}

export function getBookStats(fileHash: string): { totalWords: number; uniqueWords: number } | null {
  return wordIndex.stats(fileHash);
}

export function hasWordIndex(fileHash: string): boolean {
  return wordIndex.has(fileHash);
}

export function deleteWordIndex(fileHash: string): void {
  wordIndex.remove(fileHash);
}

export type { WatchFolderRecord } from "./infrastructure/sqlite-watch-folder-repository";

export function getWatchFolders(type: "watch" | "source" = "watch"): WatchFolderRecord[] {
  return watchFolders.list(type);
}

function addTypedWatchFolder(folderPath: string, label: string | undefined, type: "watch" | "source"): WatchFolderRecord {
  return watchFolders.add(folderPath, label, type);
}

export function addWatchFolder(folderPath: string, label?: string): WatchFolderRecord {
  return addTypedWatchFolder(folderPath, label, "watch");
}

export function getSourceFolders(): WatchFolderRecord[] {
  return getWatchFolders("source");
}

export function addSourceFolder(folderPath: string, label?: string): WatchFolderRecord {
  return addTypedWatchFolder(folderPath, label, "source");
}

export function removeWatchFolder(id: number): void {
  watchFolders.remove(id);
}

export function removeSourceFolder(id: number): WatchFolderRecord | undefined {
  return watchFolders.removeSource(id);
}

export function deleteDocumentsUnderPath(rootPath: string): number {
  const normalizedRoot = normalizeStoredPath(path.resolve(rootPath));
  if (!normalizedRoot) return 0;
  const docs = db.prepare<[string, string], DocumentRecord>(
    `SELECT * FROM documents
     WHERE REPLACE(filePath, '\\', '/') = ?
        OR REPLACE(filePath, '\\', '/') LIKE ?`
  ).all(normalizedRoot, `${normalizedRoot}/%`);

  for (const doc of docs) {
    deleteDocument(doc.fileHash);
  }

  return docs.length;
}

export function getWatchFolderBooks(folderPath: string): DocumentRecord[] {
  return watchFolders.books(folderPath);
}

export function getUnsyncedFolderPaths(): string[] {
  return watchFolders.unsyncedPaths();
}

export function getUnsyncedBookCount(folderPath: string): number {
  return watchFolders.unsyncedBookCount(folderPath);
}
