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

function getAllPdfFiles(dir: string): string[] {
  let results: string[] = [];

  if (!fs.existsSync(dir)) return results;

  const list = fs.readdirSync(dir, { withFileTypes: true });

  for (const file of list) {
    const fullPath = path.join(dir, file.name);

    if (file.isDirectory()) {
      results = results.concat(getAllPdfFiles(fullPath));
    } else if (file.isFile() && file.name.toLowerCase().endsWith(".pdf")) {
      results.push(fullPath);
    }
  }

  return results;
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

ipcMain.handle("pdf:reopen", async (_, filePath: string) => {
  try {
    const fileBuffer = fs.readFileSync(filePath).buffer;
    const fileHash = generateFileHash(filePath);
    return { fileBuffer, fileHash };
  } catch {
    return null;
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

ipcMain.handle("book:show-in-folder", (_, filePath: string) => {
  require("electron").shell.showItemInFolder(filePath);
  return true;
});


app.whenReady().then(async () => {
  initDatabase();
  ensureLibraryFolder();
  setupFileWatcher();
  
  await scanLibrary();
  autoUpdater.checkForUpdatesAndNotify();
  createWindow();
});
