import fs from "node:fs";
import path from "node:path";
import electron from "electron";
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
  updateFileSize,
  updateMetadata,
  updateProcessingStatus,
  deleteDocument,
  type DocumentRecord,
} from "../local-database";
import {
  LIBRARY_PATH,
  generateFileHash,
  getAllBookFiles as getAllBookFilesUtil,
  inferFileTypeFromPath,
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

const { app } = electron;

export interface FolderInfo {
  name: string;
  path: string;
  fullPath: string;
  bookCount: number;
  subfolders: FolderInfo[];
}

export async function processFile(filePath: string): Promise<void> {
  try {
    if (!fs.existsSync(filePath)) return;

    const lowerPath = filePath.toLowerCase();
    const isEpub = lowerPath.endsWith(".epub");
    const isCbz = lowerPath.endsWith(".cbz");
    const isPdf = lowerPath.endsWith(".pdf");
    const fileType: BookFileType = isCbz ? "cbz" : isEpub ? "epub" : "pdf";
    const thumbnailsDir = path.join(app.getPath("userData"), "thumbnails");
    if (isCbz) {
      await validateCbzFile(filePath);
    }

    const existingByPath = getDocumentByPath(filePath);
    const fileHash = generateFileHash(filePath);
    const existing = existingByPath || getDocumentByHash(fileHash);

    if (existingByPath && existingByPath.fileHash !== fileHash) {
      updateDocumentPath(fileHash, filePath);
    }

    if (existing && existing.processingStatus === "completed") {
      const thumbnailPath = await generateThumbnail(filePath, fileHash, {
        thumbnailsDir, force: true, fileType, logPrefix: "[LibraryService]",
      });
      if (thumbnailPath) updateThumbnailPath(fileHash, thumbnailPath);
      const numPages = isPdf ? await getPdfPageCount(filePath) : isCbz ? await getCbzPageCount(filePath) : await getEpubChapterCount(filePath);
      updateDocumentNumPages(fileHash, numPages);
      return;
    }

    if (existing) {
      updateProcessingStatus(fileHash, "processing");
    }

    const relativePath = path.relative(LIBRARY_PATH(), filePath);
    const pathParts = relativePath.split(path.sep);
    const category = pathParts.length > 1 ? pathParts[0] : null;

    const stats = fs.statSync(filePath);
    const numPages = isPdf ? await getPdfPageCount(filePath) : isCbz ? await getCbzPageCount(filePath) : await getEpubChapterCount(filePath);
    const metadata = isPdf ? await extractPdfMetadata(filePath) : isCbz ? null : await extractEpubMetadata(filePath);
    const thumbnailPath = await generateThumbnail(filePath, fileHash, {
      thumbnailsDir, force: false, fileType, logPrefix: "[LibraryService]",
    });

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
        updateDocumentSyncStatus(fileHash, true, category || undefined);
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

export async function scanLibrary(): Promise<void> {
  const libraryPath = LIBRARY_PATH();
  if (!fs.existsSync(libraryPath)) return;

  const pdfFiles = getAllBookFilesUtil(libraryPath);
  for (const filePath of pdfFiles) {
    try {
      const fileHash = generateFileHash(filePath);
      const existing = getDocumentByHash(fileHash);
      if (existing && existing.processingStatus === "completed") continue;
      await processFile(filePath);
    } catch (error) {
      console.error("[LibraryService] Error scanning:", filePath, error);
    }
  }
}

export async function resyncLibrary(): Promise<{ added: number; removed: number; updated: number }> {
  const libraryPath = LIBRARY_PATH();
  let added = 0, removed = 0, updated = 0;

  if (!fs.existsSync(libraryPath)) {
    return { added: 0, removed: 0, updated: 0 };
  }

  const pdfFiles = getAllBookFilesUtil(libraryPath);
  const pdfFileSet = new Set(pdfFiles.map(f => f.toLowerCase()));

  const allDocs = getAllDocuments();
  const docsInLibrary = allDocs.filter(d => d.filePath && d.filePath.startsWith(libraryPath));

  for (const doc of docsInLibrary) {
    if (doc.filePath && !pdfFileSet.has(doc.filePath.toLowerCase())) {
      deleteDocument(doc.fileHash);
      removed++;
    }
  }

  const processInBatches = async (files: string[], batchSize: number) => {
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      await Promise.all(batch.map(async (filePath) => {
        try {
          const fileHash = generateFileHash(filePath);
          const existing = getDocumentByHash(fileHash);
          if (!existing) {
            await processFile(filePath);
            added++;
          } else if (existing.filePath !== filePath) {
            updateDocumentPath(fileHash, filePath);
            updated++;
          }
        } catch (error) {
          console.error("[LibraryService] Resync error:", filePath, error);
        }
      }));
    }
  };

  await processInBatches(pdfFiles, 10);
  return { added, removed, updated };
}

export function getFolderStructure(libraryPath: string): FolderInfo[] {
  if (!fs.existsSync(libraryPath)) return [];

  const buildTree = (dirPath: string, relativeTo: string): FolderInfo[] => {
    if (!fs.existsSync(dirPath)) return [];
    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    const folders: FolderInfo[] = [];
    for (const item of items) {
      if (item.isDirectory() && !item.name.startsWith(".")) {
        const itemFullPath = path.join(dirPath, item.name);
        const relativePath = path.relative(relativeTo, itemFullPath);
        const bookFiles = getAllBookFilesUtil(itemFullPath);
        folders.push({
          name: item.name,
          path: relativePath,
          fullPath: itemFullPath,
          bookCount: bookFiles.length,
          subfolders: buildTree(itemFullPath, relativeTo),
        });
      }
    }
    return folders.sort((a, b) => a.name.localeCompare(b.name));
  };

  return buildTree(libraryPath, libraryPath);
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
  const libraryPath = LIBRARY_PATH();
  const allDocs = getAllDocuments();
  if (folderPath === null) {
    return allDocs.filter(d => d.filePath && d.filePath.startsWith(libraryPath));
  }
  const targetPath = path.join(libraryPath, folderPath);
  return allDocs.filter(d => {
    if (!d.filePath) return false;
    const docDir = path.dirname(d.filePath);
    return docDir === targetPath || docDir.startsWith(targetPath + path.sep);
  });
}
