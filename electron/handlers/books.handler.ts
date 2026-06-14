import { ipcMain, BrowserWindow, shell } from "electron";
import { PDFDocument } from "pdf-lib";
import {
  getDocumentByHash,
  getDocumentByPath,
  getDocumentById,
  getFavoriteDocuments,
  getDocumentsPendingProcessing,
  updateThumbnailPath,
  updateTitle,
  updateAuthor,
  toggleFavorite,
  updateRating,
  updateNotes,
  updateMetadata,
  mergeDocuments,
  updateDocumentBookId,
  updateDocumentFileIdentity,
  getDocumentsByBookId,
  getDocumentByTitle,
  updateDocumentNumPages,
  saveWordIndex,
  getWordIndex,
  getWordCount,
  getBookStats,
  deleteWordIndex,
} from "../local-database";
import { reopenDocument, renameBook, deleteBook } from "../services/document-service";
import { mergeBooksIntoManagedFolder } from "../services/folder-service";
import { notifyFolderChanged } from "../services/library-service";
import { generateThumbnail } from "../services/document-processing";
import { LIBRARY_PATH, USER_DATA_PATH, THUMBNAILS_DIR, generateFileHash, inferFileTypeFromPath, toReadableFileType } from "../services/file-service";
import { extractVocabularyFromEpub } from "../services/vocabulary-service";
import { processFile as processLibraryFile } from "../services/library-service";
import { setBookCoverInFile, writeBookMetadataToFile, writeCoverImageFile, writeThumbnailFile, type EditableBookMetadata } from "../services/book-file-metadata";
import { searchBookMetadataSources, type MetadataSearchField, type MetadataSearchScope } from "../../src/api/bookMetadataSearch";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

let win: Electron.BrowserWindow | null = null;

export function setWindow(w: Electron.BrowserWindow | null) {
  win = w;
}

export function registerBookHandlers() {
  function syncMergedBookMetadata(bookId: string | null | undefined, primaryHash: string, metadata: EditableBookMetadata) {
    if (!bookId) return;
    const groupDocs = getDocumentsByBookId(bookId);
    for (const groupDoc of groupDocs) {
      if (groupDoc.fileHash !== primaryHash) {
        updateMetadata(groupDoc.fileHash, metadata);
      }
    }
  }

  function syncMergedBookThumbnail(bookId: string | null | undefined, primaryHash: string, thumbnailPath: string | undefined | null) {
    if (!bookId || !thumbnailPath) return;
    const groupDocs = getDocumentsByBookId(bookId);
    for (const groupDoc of groupDocs) {
      if (groupDoc.fileHash !== primaryHash) {
        updateThumbnailPath(groupDoc.fileHash, thumbnailPath);
      }
    }
  }

  async function applyBookThumbnail(fileHash: string, imagePath: string, mode: "replace" | "prepend") {
    const doc = getDocumentByHash(fileHash);
    if (!doc || !doc.filePath) return { success: false, error: "Livro nao encontrado" };
    if (!fs.existsSync(doc.filePath)) return { success: false, error: "Arquivo nao encontrado" };
    if (!fs.existsSync(imagePath)) return { success: false, error: "Imagem nao encontrada" };

    if (doc.fileType !== "pdf") {
      const metadata: EditableBookMetadata = {
        title: doc.title,
        author: doc.author || undefined,
        description: doc.description || undefined,
        isbn: doc.isbn || undefined,
        publisher: doc.publisher || undefined,
        publishDate: doc.publishDate || undefined,
        language: doc.language || undefined,
        identifier: doc.identifier || undefined,
        asin: doc.asin || undefined,
        subject: doc.subject || undefined,
        series: doc.series || undefined,
        seriesIndex: doc.seriesIndex || undefined,
        authorSort: doc.authorSort || undefined,
        titleSort: doc.titleSort || undefined,
      };
      const fileResult = await setBookCoverInFile(doc.filePath, doc.fileType, imagePath, metadata);
      const nextHash = fileResult.success ? generateFileHash(doc.filePath) : fileHash;
      const thumbnailPath = path.join(THUMBNAILS_DIR(), `${nextHash}-thumb.webp`);
      await writeThumbnailFile(imagePath, thumbnailPath);

      if (fileResult.success) {
        updateDocumentFileIdentity(fileHash, nextHash, doc.filePath, fs.statSync(doc.filePath).size);
        updateThumbnailPath(nextHash, thumbnailPath);
        syncMergedBookThumbnail(doc.bookId, nextHash, thumbnailPath);
        win?.webContents.send("library:updated");
        return { success: true, fileHash: nextHash, thumbnailPath, warnings: fileResult.warnings };
      }

      updateThumbnailPath(fileHash, thumbnailPath);
      syncMergedBookThumbnail(doc.bookId, fileHash, thumbnailPath);
      win?.webContents.send("library:updated");
      return {
        success: true,
        fileHash,
        thumbnailPath,
        warnings: [
          ...(fileResult.warnings || []),
          fileResult.error || `Capa embutida nao suportada para ${String(doc.fileType || "este formato").toUpperCase()}. Thumbnail da biblioteca atualizado.`,
        ],
      };
    }

    const pdfDoc = await PDFDocument.load(fs.readFileSync(doc.filePath));
    const imageExt = path.extname(imagePath).toLowerCase();
    let image;
    if (imageExt === ".png") {
      image = await pdfDoc.embedPng(fs.readFileSync(imagePath));
    } else if (imageExt === ".jpg" || imageExt === ".jpeg") {
      image = await pdfDoc.embedJpg(fs.readFileSync(imagePath));
    } else {
      return { success: false, error: "Formato de imagem nao suportado. Use PNG ou JPG." };
    }

    const { width, height } = pdfDoc.getPage(0).getSize();
    const imageDims = image.scaleToFit(width, height);
    if (mode === "replace") {
      pdfDoc.removePage(0);
      const newPage = pdfDoc.insertPage(0, [width, height]);
      newPage.drawImage(image, { x: imageDims.x, y: imageDims.y, width: imageDims.width, height: imageDims.height });
    } else {
      const newPage = pdfDoc.insertPage(0, [width, height]);
      newPage.drawImage(image, { x: imageDims.x, y: imageDims.y, width: imageDims.width, height: imageDims.height });
    }

    const pdfBytes = await pdfDoc.save();
    const tempPath = doc.filePath + ".tmp";
    fs.writeFileSync(tempPath, Buffer.from(pdfBytes));
    fs.unlinkSync(doc.filePath);
    fs.renameSync(tempPath, doc.filePath);

    const nextHash = generateFileHash(doc.filePath);
    const thumbnailPath = await generateThumbnail(doc.filePath, nextHash, {
      thumbnailsDir: THUMBNAILS_DIR(), force: true, fileType: "pdf", logPrefix: "[BooksHandler]",
    });
    updateDocumentFileIdentity(fileHash, nextHash, doc.filePath, fs.statSync(doc.filePath).size);
    if (thumbnailPath) updateThumbnailPath(nextHash, thumbnailPath);
    syncMergedBookThumbnail(doc.bookId, nextHash, thumbnailPath);
    if (mode === "replace") updateDocumentNumPages(nextHash, pdfDoc.getPageCount());
    return { success: true, fileHash: nextHash, thumbnailPath: thumbnailPath || undefined };
  }

  async function downloadCoverImage(imageUrl: string) {
    const url = new URL(imageUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("URL de capa invalida.");
    }

    const response = await fetch(url.toString(), {
      headers: { "User-Agent": "Lyceum/1.0 book metadata search" },
    });
    if (!response.ok) throw new Error(`Falha ao baixar capa: HTTP ${response.status}`);

    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > 15 * 1024 * 1024) throw new Error("Imagem de capa muito grande.");

    const workspace = await fs.promises.mkdtemp(path.join(os.tmpdir(), "lyceum-cover-url-"));
    const rawPath = path.join(workspace, "source-cover");
    const coverPath = path.join(workspace, "cover.jpg");
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > 15 * 1024 * 1024) throw new Error("Imagem de capa muito grande.");
    await fs.promises.writeFile(rawPath, buffer);
    await writeCoverImageFile(rawPath, coverPath);
    return { workspace, coverPath };
  }

  ipcMain.handle("book:toggle-favorite", (_, fileHash: string) => {
    return toggleFavorite(fileHash);
  });

  ipcMain.handle("book:update-rating", (_, fileHash: string, rating: number) => {
    updateRating(fileHash, rating);
    return true;
  });

  ipcMain.handle("book:update-notes", (_, fileHash: string, notes: string) => {
    updateNotes(fileHash, notes);
    return true;
  });

  ipcMain.handle("book:search-metadata", async (_, source: MetadataSearchScope, query: string, field: MetadataSearchField, limit?: number) => {
    try {
      return {
        success: true,
        ...(await searchBookMetadataSources(source, query, field, limit || 12)),
      };
    } catch (error) {
      return {
        success: false,
        results: [],
        warnings: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle("book:update-metadata", async (_, fileHash: string, metadata: EditableBookMetadata & { pageCount?: number }) => {
    const doc = getDocumentByHash(fileHash);
    if (!doc?.filePath || !fs.existsSync(doc.filePath)) {
      return { success: false, error: "Arquivo nao encontrado" };
    }

    const mergedMetadata: EditableBookMetadata = {
      title: metadata.title ?? doc.title,
      author: metadata.author ?? doc.author ?? undefined,
      description: metadata.description ?? doc.description ?? undefined,
      isbn: metadata.isbn ?? doc.isbn ?? undefined,
      publisher: metadata.publisher ?? doc.publisher ?? undefined,
      publishDate: metadata.publishDate ?? doc.publishDate ?? undefined,
      language: metadata.language ?? doc.language ?? undefined,
      identifier: metadata.identifier ?? doc.identifier ?? undefined,
      asin: metadata.asin ?? doc.asin ?? undefined,
      subject: metadata.subject ?? doc.subject ?? undefined,
      series: metadata.series ?? doc.series ?? undefined,
      seriesIndex: metadata.seriesIndex ?? doc.seriesIndex ?? undefined,
      authorSort: metadata.authorSort ?? doc.authorSort ?? undefined,
      titleSort: metadata.titleSort ?? doc.titleSort ?? undefined,
    };

    try {
      const fileResult = await writeBookMetadataToFile(doc.filePath, doc.fileType, mergedMetadata);
      const warnings = [...(fileResult.warnings || [])];
      if (!fileResult.success) {
        warnings.push(fileResult.error || `Edicao de metadados nao suportada para ${String(doc.fileType || "este formato").toUpperCase()}. Dados salvos apenas na biblioteca.`);
      }
      updateMetadata(fileHash, mergedMetadata);
      const nextHash = fileResult.success ? generateFileHash(doc.filePath) : fileHash;
      if (fileResult.success) {
        updateDocumentFileIdentity(fileHash, nextHash, doc.filePath, fs.statSync(doc.filePath).size);
      }
      syncMergedBookMetadata(doc.bookId, nextHash, mergedMetadata);
      if (metadata.pageCount && Number.isFinite(metadata.pageCount)) {
        updateDocumentNumPages(nextHash, metadata.pageCount);
      }
      win?.webContents.send("library:updated");
      return { success: true, fileHash: nextHash, warnings };
    } catch (error) {
      updateMetadata(fileHash, mergedMetadata);
      syncMergedBookMetadata(doc.bookId, fileHash, mergedMetadata);
      if (metadata.pageCount && Number.isFinite(metadata.pageCount)) {
        updateDocumentNumPages(fileHash, metadata.pageCount);
      }
      win?.webContents.send("library:updated");
      return {
        success: true,
        fileHash,
        warnings: [error instanceof Error ? error.message : String(error)],
      };
    }
  });

  ipcMain.handle("book:update-title", (_, fileHash: string, newTitle: string) => {
    updateTitle(fileHash, newTitle);
    return true;
  });

  ipcMain.handle("book:rename", async (_, fileHash: string, newTitle: string, newAuthor: string) => {
    return renameBook(fileHash, newTitle, newAuthor);
  });

  ipcMain.handle("book:delete", (_, fileHash: string, deleteFile?: boolean) => {
    return deleteBook(fileHash, deleteFile);
  });

  ipcMain.handle("book:get-by-id", (_, id: number) => {
    return getDocumentById(id);
  });

  ipcMain.handle("book:get-favorites", () => {
    return getFavoriteDocuments();
  });

  ipcMain.handle("book:process-pending", async () => {
    const pending = getDocumentsPendingProcessing();
    for (const doc of pending) {
      await processLibraryFile(doc.filePath);
    }
    return { processed: pending.length };
  });

  ipcMain.handle("book:regenerate-thumbnail", async (_, fileHash: string) => {
    const doc = getDocumentByHash(fileHash);
    if (!doc) return { success: false, error: "Document not found" };
    if (!["pdf", "epub", "cbz", "azw3", "kfx"].includes(doc.fileType)) {
      return { success: false, error: "Thumbnail generation is only supported for PDF, EPUB, CBZ, AZW3 and KFX files" };
    }
    try {
      const fileType = doc.fileType === "azw3" || doc.fileType === "kfx"
        ? doc.fileType
        : doc.fileType === "cbz"
          ? "cbz"
        : inferFileTypeFromPath(doc.filePath, toReadableFileType(doc.fileType));
      const thumbnailPath = await generateThumbnail(doc.filePath, fileHash, {
        thumbnailsDir: THUMBNAILS_DIR(), force: true, fileType, logPrefix: "[BooksHandler]",
      });
      if (thumbnailPath) {
        updateThumbnailPath(fileHash, thumbnailPath);
        syncMergedBookThumbnail(doc.bookId, fileHash, thumbnailPath);
        return { success: true, thumbnailPath };
      }
      return { success: false, error: "Failed to generate thumbnail" };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle("book:update-book-id", (_, fileHash: string, bookId: string) => {
    updateDocumentBookId(fileHash, bookId);
    return { success: true };
  });

  ipcMain.handle("book:get-by-book-id", (_, bookId: string) => {
    return getDocumentsByBookId(bookId);
  });

  ipcMain.handle("book:merge", (_, fileHashes: string[]) => {
    const docs = fileHashes.map((fileHash) => getDocumentByHash(fileHash)).filter(Boolean);
    const existingBookId = docs.find((doc) => doc?.bookId)?.bookId;
    const bookId = existingBookId || `local-${randomUUID()}`;
    const result = mergeDocuments(fileHashes, bookId);
    if (result.success) {
      win?.webContents.send("library:updated");
    }
    return result;
  });

  ipcMain.handle("book:merge-into-folder", (_, fileHashes: string[], parentPath: string | null = null) => {
    const result = mergeBooksIntoManagedFolder(fileHashes, parentPath);
    if (result.success) {
      notifyFolderChanged();
      win?.webContents.send("library:updated");
    }
    return result;
  });

  ipcMain.handle("book:get-by-title", (_, title: string) => {
    return getDocumentByTitle(title);
  });

  ipcMain.handle("book:show-in-folder", (_, filePath: string) => {
    const doc = getDocumentByPath(filePath);
    if (!doc?.filePath) return false;
    shell.showItemInFolder(doc.filePath);
    return true;
  });

  ipcMain.handle("book:extract-vocabulary", async (_, fileHash: string) => {
    const doc = getDocumentByHash(fileHash);
    if (!doc) return { success: false, error: "Document not found" };
    if (doc.fileType !== "epub") return { success: false, error: "Vocabulary extraction only supported for EPUB files" };
    if (!fs.existsSync(doc.filePath)) return { success: false, error: "File not found" };
    try {
      const words = extractVocabularyFromEpub(doc.filePath);
      const totalWords = words.reduce((sum, w) => sum + w.count, 0);
      saveWordIndex(fileHash, words);
      return { success: true, totalWords, uniqueWords: words.length };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle("book:get-vocabulary-stats", (_, fileHash: string) => {
    const stats = getBookStats(fileHash);
    return stats ? { hasIndex: true, ...stats } : { hasIndex: false, totalWords: 0, uniqueWords: 0 };
  });

  ipcMain.handle("book:get-word-count", (_, fileHash: string, word: string) => {
    const count = getWordCount(fileHash, word);
    return { word: word.toLowerCase(), count };
  });

  ipcMain.handle("book:delete-vocabulary", (_, fileHash: string) => {
    deleteWordIndex(fileHash);
    return { success: true };
  });

  ipcMain.handle("pdf:reopen", async (_, filePath?: string, fileHash?: string) => {
    const result = await reopenDocument(filePath, fileHash);
    win?.webContents.send("library:updated");
    return result;
  });

  ipcMain.handle("pdf:set-thumbnail", async (_, fileHash: string, imagePath: string, mode: "replace" | "prepend") => {
    try {
      return await applyBookThumbnail(fileHash, imagePath, mode);

      const doc = getDocumentByHash(fileHash);
      if (!doc || !doc.filePath) return { success: false, error: "Livro não encontrado" };
      if (!fs.existsSync(doc.filePath)) return { success: false, error: "Arquivo não encontrado" };
      if (!fs.existsSync(imagePath)) return { success: false, error: "Imagem não encontrada" };

      if (doc.fileType !== "pdf") {
        const metadata: EditableBookMetadata = {
          title: doc.title,
          author: doc.author || undefined,
          description: doc.description || undefined,
          isbn: doc.isbn || undefined,
          publisher: doc.publisher || undefined,
          publishDate: doc.publishDate || undefined,
          language: doc.language || undefined,
          identifier: doc.identifier || undefined,
          asin: doc.asin || undefined,
          subject: doc.subject || undefined,
          series: doc.series || undefined,
          seriesIndex: doc.seriesIndex || undefined,
          authorSort: doc.authorSort || undefined,
          titleSort: doc.titleSort || undefined,
        };
        const fileResult = await setBookCoverInFile(doc.filePath, doc.fileType, imagePath, metadata);
        if (!fileResult.success) return fileResult;
        const nextHash = generateFileHash(doc.filePath);
        const thumbnailPath = path.join(THUMBNAILS_DIR(), `${nextHash}-thumb.webp`);
        await writeThumbnailFile(imagePath, thumbnailPath);
        updateDocumentFileIdentity(fileHash, nextHash, doc.filePath, fs.statSync(doc.filePath).size);
        updateThumbnailPath(nextHash, thumbnailPath);
        win?.webContents.send("library:updated");
        return { success: true, fileHash: nextHash, thumbnailPath, warnings: fileResult.warnings };
      }

      const pdfDoc = await PDFDocument.load(fs.readFileSync(doc.filePath));
      const imageExt = path.extname(imagePath).toLowerCase();

      let image;
      if (imageExt === ".png") {
        image = await pdfDoc.embedPng(fs.readFileSync(imagePath));
      } else if (imageExt === ".jpg" || imageExt === ".jpeg") {
        image = await pdfDoc.embedJpg(fs.readFileSync(imagePath));
      } else {
        return { success: false, error: "Formato de imagem não suportado. Use PNG ou JPG." };
      }

      const { width, height } = pdfDoc.getPage(0).getSize();
      const imageDims = image.scaleToFit(width, height);

      if (mode === "replace") {
        pdfDoc.removePage(0);
        const newPage = pdfDoc.insertPage(0, [width, height]);
        newPage.drawImage(image, { x: imageDims.x, y: imageDims.y, width: imageDims.width, height: imageDims.height });
      } else {
        const newPage = pdfDoc.insertPage(0, [width, height]);
        newPage.drawImage(image, { x: imageDims.x, y: imageDims.y, width: imageDims.width, height: imageDims.height });
      }

      const pdfBytes = await pdfDoc.save();
      const tempPath = doc.filePath + ".tmp";
      fs.writeFileSync(tempPath, Buffer.from(pdfBytes));
      fs.unlinkSync(doc.filePath);
      fs.renameSync(tempPath, doc.filePath);

      const nextHash = generateFileHash(doc.filePath);
      const thumbnailPath = await generateThumbnail(doc.filePath, nextHash, {
        thumbnailsDir: THUMBNAILS_DIR(), force: true, fileType: "pdf", logPrefix: "[BooksHandler]",
      });
      updateDocumentFileIdentity(fileHash, nextHash, doc.filePath, fs.statSync(doc.filePath).size);
      if (thumbnailPath) updateThumbnailPath(nextHash, thumbnailPath);
      if (mode === "replace") updateDocumentNumPages(nextHash, pdfDoc.getPageCount());
      return { success: true, fileHash: nextHash, thumbnailPath: thumbnailPath || undefined };
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message || "Erro ao modificar PDF" };
    }
  });

  ipcMain.handle("book:set-thumbnail-from-url", async (_, fileHash: string, imageUrl: string, mode: "replace" | "prepend") => {
    let workspace: string | undefined;
    try {
      const downloaded = await downloadCoverImage(imageUrl);
      workspace = downloaded.workspace;
      return await applyBookThumbnail(fileHash, downloaded.coverPath, mode);
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message || "Erro ao baixar capa" };
    } finally {
      if (workspace) {
        fs.promises.rm(workspace, { recursive: true, force: true }).catch(() => {});
      }
    }
  });
}
