import { ipcMain, BrowserWindow } from "electron";
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
  updateDocumentBookId,
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
import { generateThumbnail } from "../services/document-processing";
import { LIBRARY_PATH, USER_DATA_PATH, THUMBNAILS_DIR, inferFileTypeFromPath, toReadableFileType } from "../services/file-service";
import { extractVocabularyFromEpub } from "../services/vocabulary-service";
import { processFile as processLibraryFile } from "../services/library-service";
import fs from "node:fs";
import path from "node:path";

let win: Electron.BrowserWindow | null = null;

export function setWindow(w: Electron.BrowserWindow | null) {
  win = w;
}

export function registerBookHandlers() {
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

  ipcMain.handle("book:update-metadata", (_, fileHash: string, metadata: {
    author?: string; description?: string; isbn?: string; publisher?: string; publishDate?: string;
  }) => {
    updateMetadata(fileHash, metadata);
    return true;
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
    if (doc.fileType !== "pdf" && doc.fileType !== "epub") {
      return { success: false, error: "Thumbnail generation is only supported for PDF and EPUB files" };
    }
    try {
      const fileType = inferFileTypeFromPath(doc.filePath, toReadableFileType(doc.fileType));
      const thumbnailPath = await generateThumbnail(doc.filePath, fileHash, {
        thumbnailsDir: THUMBNAILS_DIR(), force: true, fileType, logPrefix: "[BooksHandler]",
      });
      if (thumbnailPath) {
        updateThumbnailPath(fileHash, thumbnailPath);
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

  ipcMain.handle("book:get-by-title", (_, title: string) => {
    return getDocumentByTitle(title);
  });

  ipcMain.handle("book:show-in-folder", (_, filePath: string) => {
    const doc = getDocumentByPath(filePath);
    if (!doc?.filePath) return false;
    require("electron").shell.showItemInFolder(doc.filePath);
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
    return reopenDocument(filePath, fileHash);
  });

  ipcMain.handle("pdf:set-thumbnail", async (_, fileHash: string, imagePath: string, mode: "replace" | "prepend") => {
    try {
      const doc = getDocumentByHash(fileHash);
      if (!doc || !doc.filePath) return { success: false, error: "Livro não encontrado" };
      if (!fs.existsSync(doc.filePath)) return { success: false, error: "Arquivo não encontrado" };
      if (!fs.existsSync(imagePath)) return { success: false, error: "Imagem não encontrada" };

      const { PDFDocument } = require("pdf-lib");
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

      await generateThumbnail(doc.filePath, fileHash, {
        thumbnailsDir: THUMBNAILS_DIR(), force: true, fileType: "pdf", logPrefix: "[BooksHandler]",
      });
      if (mode === "replace") updateDocumentNumPages(fileHash, pdfDoc.getPageCount());
      return { success: true };
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message || "Erro ao modificar PDF" };
    }
  });
}
