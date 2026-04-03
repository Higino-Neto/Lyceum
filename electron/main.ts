import { app, BrowserWindow, ipcMain, dialog } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { autoUpdater } from "electron-updater";
import chokidar, { FSWatcher } from "chokidar";
import {
  addDocument,
  getAllDocuments,
  getDocumentByHash,
  getLastDocument,
  initDatabase,
  updateDocumentPath,
  updateDocumentSyncStatus,
  updateLastOpened,
  updateReadingState,
  getDocumentsBySyncStatus,
  getCategories,
  updateThumbnailPath,
  searchDocuments,
  toggleFavorite,
  updateRating,
  updateNotes,
  updateMetadata,
  updateProcessingStatus,
  getDocumentsPendingProcessing,
  updateFileSize,
  updateTitle,
  deleteDocument,
  getDocumentById,
  getFavoriteDocuments,
  createCategory,
  updateCategory,
  deleteCategory,
  getAllCategories,
  getCategoryById,
  getCategoriesForDocument,
  getCategoriesForDocumentByHash,
  setDocumentCategories,
  addCategoryToDocument,
  removeCategoryFromDocument,
  getDocumentsByCategory,
  getCategoryColors,
  importCategoriesFromFolders,
  updateDocumentBookId,
  getDocumentsByBookId,
  getDocumentByTitle,
  updateAuthor,
} from "./local-database";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const __filename = fileURLToPath(import.meta.url);
(globalThis as any).__filename = __filename;
import crypto from "crypto";
import fs from "fs";
import { PDFDocument } from "pdf-lib";

process.env.APP_ROOT = path.join(__dirname, "..");

export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

let win: BrowserWindow | null = null;
let fileWatcher: FSWatcher | null = null;

const THUMBNAILS_DIR = () => path.join(app.getPath("userData"), "thumbnails");
const LIBRARY_PATH = () => path.join(app.getPath("userData"), "library");

interface FolderInfo {
  name: string;
  path: string;
  fullPath: string;
  bookCount: number;
  subfolders: FolderInfo[];
}

function getAllPdfFiles(dir: string): string[] {
  let results: string[] = [];

  if (!fs.existsSync(dir)) return results;

  const list = fs.readdirSync(dir, { withFileTypes: true });

  for (const file of list) {
    const fullPath = path.join(dir, file.name);

    if (file.isDirectory()) {
      results = results.concat(getAllPdfFiles(fullPath));
    } else if (file.isFile()) {
      const fileName = file.name.toLowerCase();
      if (fileName.endsWith(".pdf") && !fileName.includes(".tmp")) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

function getFolderStructure(libraryPath: string): FolderInfo[] {
  if (!fs.existsSync(libraryPath)) return [];

  const buildTree = (dirPath: string, relativeTo: string): FolderInfo[] => {
    if (!fs.existsSync(dirPath)) return [];

    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    const folders: FolderInfo[] = [];

    for (const item of items) {
      if (item.isDirectory() && !item.name.startsWith(".")) {
        const itemFullPath = path.join(dirPath, item.name);
        const relativePath = path.relative(relativeTo, itemFullPath);
        
        const pdfFiles = getAllPdfFiles(itemFullPath);
        
        folders.push({
          name: item.name,
          path: relativePath,
          fullPath: itemFullPath,
          bookCount: pdfFiles.length,
          subfolders: buildTree(itemFullPath, relativeTo),
        });
      }
    }

    return folders.sort((a, b) => a.name.localeCompare(b.name));
  };

  return buildTree(libraryPath, libraryPath);
}

function getAllFoldersFlat(libraryPath: string): string[] {
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

function getBooksInFolder(folderPath: string | null): DocumentRecord[] {
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

async function processFile(filePath: string): Promise<void> {
  try {
    if (!fs.existsSync(filePath)) return;

    const fileHash = generateFileHash(filePath);
    const existing = getDocumentByHash(fileHash);

    if (existing && existing.processingStatus === "completed") return;

    if (existing) {
      updateProcessingStatus(fileHash, "processing");
    }

    const relativePath = path.relative(LIBRARY_PATH(), filePath);
    const pathParts = relativePath.split(path.sep);
    const category = pathParts.length > 1 ? pathParts[0] : null;

    const stats = fs.statSync(filePath);
    const numPages = await getPdfPageCount(filePath);
    const metadata = await extractMetadata(filePath);
    const thumbnailPath = await generateThumbnail(filePath, fileHash);

    if (existing) {
      if (thumbnailPath) {
        updateThumbnailPath(fileHash, thumbnailPath);
      }
      updateFileSize(fileHash, stats.size);
      if (metadata) {
        updateMetadata(fileHash, {
          author: metadata.author,
          publisher: metadata.producer,
          publishDate: metadata.creationDate,
        });
      }
      updateProcessingStatus(fileHash, "completed");
    } else {
      const title = path.basename(filePath, ".pdf");
      addDocument(
        title,
        filePath,
        fileHash,
        thumbnailPath || undefined,
        numPages || 1
      );
      
      const newDoc = getDocumentByHash(fileHash);
      if (newDoc) {
        updateFileSize(fileHash, stats.size);
        if (metadata) {
          updateMetadata(fileHash, {
            author: metadata.author,
            publisher: metadata.producer,
            publishDate: metadata.creationDate,
          });
        }
        updateDocumentSyncStatus(fileHash, true, category || undefined);
        updateProcessingStatus(fileHash, "completed");
      }
    }
    
    win?.webContents.send("library:updated");
  } catch (error) {
    console.error("[Main] Error processing file:", error);
    const fileHash = generateFileHash(filePath);
    const existing = getDocumentByHash(fileHash);
    if (existing) {
      updateProcessingStatus(fileHash, "failed");
    }
  }
}

async function extractMetadata(
  filePath: string
): Promise<{
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
  creationDate?: string;
  modificationDate?: string;
} | null> {
  try {
    const pdfBytes = fs.readFileSync(filePath);
    const pdfDoc = await PDFDocument.load(pdfBytes, {
      ignoreEncryption: true,
    });

    const formatPdfDate = (pdfDate: string | undefined): string | undefined => {
      if (!pdfDate) return undefined;
      const match = pdfDate.match(/D:(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?/);
      if (match) {
        const year = match[1];
        const month = match[2] || "01";
        const day = match[3] || "01";
        const hour = match[4] || "00";
        const minute = match[5] || "00";
        const second = match[6] || "00";
        return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
      }
      return pdfDate;
    };

    const metadata: {
      title?: string;
      author?: string;
      subject?: string;
      keywords?: string;
      creator?: string;
      producer?: string;
      creationDate?: string;
      modificationDate?: string;
    } = {};

    try {
      const catalog = pdfDoc.catalog as unknown as { get?: (key: string) => unknown } | undefined;
      if (catalog) {
        const infoRef = catalog.get?.("Info");
        if (infoRef) {
          const info = infoRef as { [key: string]: unknown };
          const getStr = (key: string): string | undefined => {
            try {
              const val = info[key];
              return typeof val?.toString === "function" ? val.toString() : undefined;
            } catch {
              return undefined;
            }
          };
          metadata.title = getStr("Title");
          metadata.author = getStr("Author");
          metadata.subject = getStr("Subject");
          metadata.keywords = getStr("Keywords");
          metadata.creator = getStr("Creator");
          metadata.producer = getStr("Producer");
          
          const creationDate = getStr("CreationDate");
          const modDate = getStr("ModDate");
          if (creationDate) metadata.creationDate = formatPdfDate(creationDate);
          if (modDate) metadata.modificationDate = formatPdfDate(modDate);
        }
      }
    } catch (e) {
      console.error("[Main] Catalog metadata extraction failed:", e);
    }

    return metadata;
  } catch (error) {
    console.error("[Main] Metadata extraction error:", error);
    return null;
  }
}

function setupFileWatcher() {
  const libraryPath = LIBRARY_PATH();
  
  if (fileWatcher) {
    fileWatcher.close();
  }

  if (!fs.existsSync(libraryPath)) {
    fs.mkdirSync(libraryPath, { recursive: true });
  }

  fileWatcher = chokidar.watch(libraryPath, {
    persistent: true,
    ignoreInitial: true,
    depth: 99,
    awaitWriteFinish: {
      stabilityThreshold: 1000,
      pollInterval: 100,
    },
  });

  fileWatcher.on("add", (filePath) => {
    if (filePath.toLowerCase().endsWith(".pdf")) {
      console.log("[Main] New PDF detected:", filePath);
      processFile(filePath);
    }
  });

  fileWatcher.on("unlink", (filePath) => {
    if (filePath.toLowerCase().endsWith(".pdf")) {
      console.log("[Main] PDF removed:", filePath);
      // Optionally handle file deletion
    }
  });

  fileWatcher.on("error", (error) => {
    console.error("[Main] File watcher error:", error);
  });

  console.log("[Main] File watcher setup for:", libraryPath);
}

async function scanLibrary() {
  const libraryPath = LIBRARY_PATH();

  if (!fs.existsSync(libraryPath)) return;

  const pdfFiles = getAllPdfFiles(libraryPath);

  for (const filePath of pdfFiles) {
    try {
      const fileHash = generateFileHash(filePath);
      const existing = getDocumentByHash(fileHash);

      if (existing && existing.processingStatus === "completed") {
        continue;
      }

      await processFile(filePath);
    } catch (error) {
      console.error("Error scanning:", filePath, error);
    }
  }
}

async function getPdfPageCount(filePath: string): Promise<number> {
  try {
    const pdfBytes = fs.readFileSync(filePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    return pdfDoc.getPageCount();
  } catch (error) {
    console.error("Error getting PDF page count:", error);
    return 1;
  }
}

function ensureLibraryFolder() {
  const libraryPath = path.join(app.getPath("userData"), "library");

  if (!fs.existsSync(libraryPath)) {
    fs.mkdirSync(libraryPath, { recursive: true });
  }

  return libraryPath;
}

function generateFileHash(filePath: string) {
  const fileBuffer = fs.readFileSync(filePath);
  const hash = crypto.createHash("sha256");
  hash.update(fileBuffer);
  return hash.digest("hex");
}
async function generateThumbnail(
  filePath: string,
  fileHash: string,
): Promise<string | null> {
  try {
    const pdfRequire = require("pdf-poppler");
    const thumbnailsDir = path.join(app.getPath("userData"), "thumbnails");

    if (!fs.existsSync(thumbnailsDir)) {
      fs.mkdirSync(thumbnailsDir, { recursive: true });
    }

    // Helper to find existing thumbnail for this hash
    const findExistingThumbnail = () => {
      const files = fs.readdirSync(thumbnailsDir);
      const matchingFile = files.find(
        (f) => f.startsWith(`${fileHash}-`) && f.endsWith(".jpg"),
      );
      if (matchingFile) {
        const fullPath = path.join(thumbnailsDir, matchingFile);
        console.log(`Found existing thumbnail: ${fullPath}`);
        return fullPath;
      }
      return null;
    };

    const existingPath = findExistingThumbnail();
    if (existingPath) {
      return existingPath;
    }

    const opts = {
      format: "jpeg",
      out_dir: thumbnailsDir,
      out_prefix: fileHash,
      page: 1,
    };

    await pdfRequire.convert(filePath, opts);

    // After conversion, find the generated file (accounts for variable padding)
    const generatedPath = findExistingThumbnail();
    if (generatedPath) {
      console.log(`Thumbnail generated: ${generatedPath}`);
      return generatedPath;
    } else {
      console.error(
        `No thumbnail file found after generation for hash: ${fileHash}`,
      );
      return null;
    }
  } catch (error) {
    console.error("Error generating thumbnail:", error);
    return null;
  }
}
function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC!, "logo.ico"),
    title: "Lyceum",
    width: 1200,
    height: 800,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
    },
    autoHideMenuBar: true,
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
  win.webContents.on("did-finish-load", () => {
    win?.webContents.setZoomFactor(1.0);
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle("add-document", (_, data) => {
  const fileHash = generateFileHash(data.filePath);

  const existing = getDocumentByHash(fileHash);
  if (existing) return existing;

  return addDocument(data.title, data.filePath, fileHash);
});

ipcMain.handle("get-documents", () => {
  return getAllDocuments();
});

ipcMain.handle("reading:save", (_, payload) => {
  const { fileHash, state } = payload ?? {};
  if (!fileHash || !state) return;

  const safeState = {
    currentPage: state.currentPage ?? 1,
    currentZoom: state.currentZoom ?? 1,
    currentScroll: state.currentScroll ?? 0,
    annotations: state.annotations ?? "[]",
  };

  updateReadingState(fileHash, safeState);
});

ipcMain.handle("reading:get", (_, fileHash) => {
  return getDocumentByHash(fileHash);
});

ipcMain.handle("dialog:open-pdf", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const filePath = result.filePaths[0];
  const title = path.basename(filePath);
  const fileHash = generateFileHash(filePath);
  const fileBuffer = fs.readFileSync(filePath).buffer;

  const existing = getDocumentByHash(fileHash);
  if (existing) {
    updateLastOpened(fileHash);
    return { ...existing, fileBuffer };
  }

  const thumbnailPath = await generateThumbnail(filePath, fileHash);
  const numPages = await getPdfPageCount(filePath);
  addDocument(title, filePath, fileHash, thumbnailPath || undefined, numPages);
  
  const doc = getDocumentByHash(fileHash);
  if (!doc) return null;
  
  updateDocumentSyncStatus(fileHash, false);
  
  return { ...doc, fileBuffer, thumbnailPath };
});

ipcMain.handle("app:get-last-document", () => {
  return getLastDocument();
});

ipcMain.handle("thumbnail:get", async (_, thumbnailPath: string) => {
  try {
    if (!thumbnailPath) {
      return null;
    }

    if (fs.existsSync(thumbnailPath)) {
      const buffer = fs.readFileSync(thumbnailPath);
      return `data:image/jpeg;base64,${buffer.toString("base64")}`;
    }

    const dir = path.dirname(thumbnailPath);
    const baseName = path.basename(thumbnailPath, path.extname(thumbnailPath));
    const hash = baseName.replace(/-\d+$/, "").replace(/-0+\d+$/, "");
    
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      const match = files.find(f => f.startsWith(hash) && f.endsWith(".jpg"));
      if (match) {
        const buffer = fs.readFileSync(path.join(dir, match));
        return `data:image/jpeg;base64,${buffer.toString("base64")}`;
      }
    }

    return null;
  } catch (error) {
    console.error("[thumbnail:get] Error:", error);
    return null;
  }
});

function findFileByHash(fileHash: string, searchPaths: string[]): string | null {
  for (const searchPath of searchPaths) {
    if (!fs.existsSync(searchPath)) continue;
    
    const files = getAllPdfFiles(searchPath);
    for (const filePath of files) {
      try {
        const hash = generateFileHash(filePath);
        if (hash === fileHash) {
          return filePath;
        }
      } catch {
        continue;
      }
    }
  }
  return null;
}

ipcMain.handle("pdf:reopen", async (_, filePath: string, fileHash?: string) => {
  try {
    if (fs.existsSync(filePath)) {
      const fileBuffer = fs.readFileSync(filePath).buffer;
      const hash = generateFileHash(filePath);
      return { fileBuffer, fileHash: hash };
    }

    console.log("[pdf:reopen] File not found, searching by hash:", filePath);

    if (!fileHash) {
      return { error: "FILE_NOT_FOUND", message: "Arquivo não encontrado e hash não fornecido" };
    }

    const libraryPath = LIBRARY_PATH();
    const userDataPath = app.getPath("userData");
    const searchPaths = [libraryPath, userDataPath];

    const foundPath = findFileByHash(fileHash, searchPaths);

    if (!foundPath) {
      return { error: "FILE_NOT_FOUND", message: "Arquivo não encontrado em nenhuma pasta da biblioteca" };
    }

    console.log("[pdf:reopen] Found file at new location:", foundPath);
    updateDocumentPath(fileHash, foundPath);

    const fileBuffer = fs.readFileSync(foundPath).buffer;
    return { fileBuffer, fileHash, foundAt: foundPath };
  } catch (error) {
    console.error("[pdf:reopen] Error:", error);
    return { error: "READ_ERROR", message: "Erro ao ler o arquivo" };
  }
});

ipcMain.handle("library:get-path", () => {
  return path.join(app.getPath("userData"), "library");
});

ipcMain.handle("library:scan", async () => {
  await scanLibrary();
});

ipcMain.handle("library:get-sync-status", (_, synced: boolean) => {
  return getDocumentsBySyncStatus(synced);
});

ipcMain.handle("library:get-categories", () => {
  return getCategories();
});

ipcMain.handle("library:search-local", (_, query: string) => {
  return searchDocuments(query);
});

ipcMain.handle("window:minimize", () => {
  win?.minimize();
});

ipcMain.handle("window:maximize", () => {
  if (win?.isMaximized()) {
    win.unmaximize();
  } else {
    win?.maximize();
  }
});

ipcMain.handle("window:close", () => {
  win?.close();
});

ipcMain.handle("window:isMaximized", () => {
  return win?.isMaximized() ?? false;
});

ipcMain.handle("library:sync-document", async (_, fileHash: string, action: "move" | "copy", category?: string) => {
  const doc = getDocumentByHash(fileHash);
  if (!doc) return { success: false, error: "Document not found" };
  
  const libraryPath = LIBRARY_PATH();
  const targetDir = category ? path.join(libraryPath, category) : libraryPath;
  
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  
  const fileName = path.basename(doc.filePath);
  const targetPath = path.join(targetDir, fileName);
  
  try {
    if (action === "move") {
      fs.renameSync(doc.filePath, targetPath);
    } else {
      fs.copyFileSync(doc.filePath, targetPath);
    }
    
    if (doc.thumbnailPath && fs.existsSync(doc.thumbnailPath)) {
      const thumbFileName = path.basename(doc.thumbnailPath);
      const targetThumbPath = path.join(app.getPath("userData"), "thumbnails", thumbFileName);
      if (action === "move") {
        fs.renameSync(doc.thumbnailPath, targetThumbPath);
      } else {
        fs.copyFileSync(doc.thumbnailPath, targetThumbPath);
      }
      updateDocumentPath(fileHash, targetPath);
      updateDocumentSyncStatus(fileHash, true, category);
    } else {
      updateDocumentPath(fileHash, targetPath);
      updateDocumentSyncStatus(fileHash, true, category);
      
      const newThumbnail = await generateThumbnail(targetPath, fileHash);
      if (newThumbnail) {
        updateThumbnailPath(fileHash, newThumbnail);
      }
    }
    
    return { success: true, newPath: targetPath };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

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
  author?: string;
  description?: string;
  isbn?: string;
  publisher?: string;
  publishDate?: string;
}) => {
  updateMetadata(fileHash, metadata);
  return true;
});

ipcMain.handle("book:update-title", (_, fileHash: string, newTitle: string) => {
  updateTitle(fileHash, newTitle);
  return true;
});

ipcMain.handle("book:rename", async (_, fileHash: string, newTitle: string, newAuthor: string) => {
  try {
    let doc = getDocumentByHash(fileHash);
    
    if (!doc) {
      return { success: false, error: "Documento não encontrado" };
    }

    let filePath = doc.filePath;

    if (!filePath || !fs.existsSync(filePath)) {
      console.log("[book:rename] File not found at stored path, searching by hash:", filePath);
      
      const libraryPath = LIBRARY_PATH();
      const userDataPath = app.getPath("userData");
      const searchPaths = [libraryPath, userDataPath];
      
      const foundPath = findFileByHash(fileHash, searchPaths);
      
      if (!foundPath) {
        return { success: false, error: "Arquivo não encontrado em nenhuma pasta da biblioteca" };
      }
      
      filePath = foundPath;
      updateDocumentPath(fileHash, foundPath);
      console.log("[book:rename] Found file at new location:", foundPath);
    }

    const dir = path.dirname(filePath);
    const ext = path.extname(filePath);
    const newFileName = `${newTitle}${ext}`;
    const newFilePath = path.join(dir, newFileName);

    if (filePath !== newFilePath) {
      if (fs.existsSync(newFilePath)) {
        return { success: false, error: "Já existe um arquivo com este nome" };
      }
      fs.renameSync(filePath, newFilePath);
      filePath = newFilePath;
      updateDocumentPath(fileHash, newFilePath);
    }

    const finalTitle = newTitle.toLowerCase().endsWith(".pdf") ? newTitle : `${newTitle}.pdf`;
    updateTitle(fileHash, finalTitle);
    updateAuthor(fileHash, newAuthor || null);

    return { success: true };
  } catch (error) {
    console.error("[book:rename] Error:", error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle("book:delete", (_, fileHash: string) => {
  return deleteDocument(fileHash);
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
    await processFile(doc.filePath);
  }
  return { processed: pending.length };
});

ipcMain.handle("book:regenerate-thumbnail", async (_, fileHash: string) => {
  const doc = getDocumentByHash(fileHash);
  if (!doc) return { success: false, error: "Document not found" };
  
  try {
    const thumbnailPath = await generateThumbnail(doc.filePath, fileHash);
    if (thumbnailPath) {
      updateThumbnailPath(fileHash, thumbnailPath);
      return { success: true, thumbnailPath };
    }
    return { success: false, error: "Failed to generate thumbnail" };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle("library:open-folder", () => {
  const libraryPath = LIBRARY_PATH();
  require("electron").shell.openPath(libraryPath);
  return libraryPath;
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
  require("electron").shell.showItemInFolder(filePath);
  return true;
});

ipcMain.handle("category:create", (_, name: string, color?: string) => {
  return createCategory(name, color);
});

ipcMain.handle("category:update", (_, id: number, name: string, color: string) => {
  return updateCategory(id, name, color);
});

ipcMain.handle("category:delete", (_, id: number) => {
  return deleteCategory(id);
});

ipcMain.handle("category:get-all", () => {
  return getAllCategories();
});

ipcMain.handle("category:get-by-id", (_, id: number) => {
  return getCategoryById(id);
});

ipcMain.handle("category:get-for-document", (_, documentId: number) => {
  return getCategoriesForDocument(documentId);
});

ipcMain.handle("category:get-for-document-by-hash", (_, fileHash: string) => {
  return getCategoriesForDocumentByHash(fileHash);
});

ipcMain.handle("category:set-for-document", (_, documentId: number, categoryIds: number[]) => {
  return setDocumentCategories(documentId, categoryIds);
});

ipcMain.handle("category:add-to-document", (_, documentId: number, categoryId: number) => {
  return addCategoryToDocument(documentId, categoryId);
});

ipcMain.handle("category:remove-from-document", (_, documentId: number, categoryId: number) => {
  return removeCategoryFromDocument(documentId, categoryId);
});

ipcMain.handle("category:get-colors", () => {
  return getCategoryColors();
});

ipcMain.handle("category:import-from-folders", () => {
  const count = importCategoriesFromFolders();
  return { imported: count };
});

ipcMain.handle("library:get-folder-structure", () => {
  return getFolderStructure(LIBRARY_PATH());
});

ipcMain.handle("library:get-all-folders", () => {
  return getAllFoldersFlat(LIBRARY_PATH());
});

ipcMain.handle("library:get-books-in-folder", (_, folderPath: string | null) => {
  return getBooksInFolder(folderPath);
});

ipcMain.handle("library:create-folder", async (_, folderName: string) => {
  try {
    const libraryPath = LIBRARY_PATH();
    const newFolderPath = path.join(libraryPath, folderName);
    
    if (fs.existsSync(newFolderPath)) {
      return { success: false, error: "Pasta já existe" };
    }
    
    fs.mkdirSync(newFolderPath, { recursive: true });
    win?.webContents.send("library:updated");
    return { success: true };
  } catch (error) {
    console.error("[library:create-folder] Error:", error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle("library:rename-folder", async (_, oldPath: string, newName: string) => {
  try {
    const parentPath = path.dirname(oldPath);
    const newPath = path.join(parentPath, newName);
    
    if (fs.existsSync(newPath)) {
      return { success: false, error: "Já existe uma pasta com este nome" };
    }
    
    fs.renameSync(oldPath, newPath);
    win?.webContents.send("library:updated");
    return { success: true };
  } catch (error) {
    console.error("[library:rename-folder] Error:", error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle("library:delete-folder", async (_, folderPath: string) => {
  try {
    const libraryPath = LIBRARY_PATH();
    
    if (!folderPath.startsWith(libraryPath)) {
      return { success: false, error: "Caminho inválido" };
    }

    if (!fs.existsSync(folderPath)) {
      return { success: false, error: "Pasta não existe" };
    }

    const items = fs.readdirSync(folderPath);
    if (items.length > 0) {
      return { success: false, error: "Pasta não está vazia" };
    }

    fs.rmdirSync(folderPath);
    win?.webContents.send("library:updated");
    return { success: true };
  } catch (error) {
    console.error("[library:delete-folder] Error:", error);
    return { success: false, error: String(error) };
  }
});


app.whenReady().then(async () => {
  initDatabase();
  ensureLibraryFolder();
  setupFileWatcher();
  
  importCategoriesFromFolders();
  await scanLibrary();
  autoUpdater.checkForUpdatesAndNotify();
  createWindow();
});
