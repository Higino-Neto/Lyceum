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
  updateDocumentNumPages,
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
  getDocumentByPath,
  updateAuthor,
  getDocumentsForBackup,
  getAllHabits,
  getHabitById,
  addHabit,
  updateHabit,
  deleteHabit,
  getHabitCompletions,
  getAllHabitCompletions,
  setHabitCompletion,
  deleteHabitCompletion,
  getAllDocumentCategories,
} from "./local-database";
import {
  initBackupClient,
  backupAllDocuments,
  backupAllHabits,
  backupAllCategories,
  setBackupSession,
  clearBackupSession,
} from "./backup";

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
const USER_DATA_PATH = () => app.getPath("userData");

interface FolderInfo {
  name: string;
  path: string;
  fullPath: string;
  bookCount: number;
  subfolders: FolderInfo[];
}

function isPathWithin(basePath: string, targetPath: string): boolean {
  const relative = path.relative(path.resolve(basePath), path.resolve(targetPath));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function assertPathWithin(basePath: string, targetPath: string, errorMessage: string): string {
  const resolvedPath = path.resolve(targetPath);
  if (!isPathWithin(basePath, resolvedPath)) {
    throw new Error(errorMessage);
  }
  return resolvedPath;
}

function isSafeRelativePath(targetPath: string): boolean {
  if (!targetPath || path.isAbsolute(targetPath)) {
    return false;
  }

  const parts = targetPath.split(/[\\/]+/).filter(Boolean);
  return parts.length > 0 && parts.every((part) => part !== "." && part !== "..");
}

function resolveLibraryRelativePath(targetPath: string | null | undefined): string {
  const libraryPath = LIBRARY_PATH();
  if (!targetPath) {
    return libraryPath;
  }

  if (!isSafeRelativePath(targetPath)) {
    throw new Error("Caminho inválido");
  }

  return assertPathWithin(
    libraryPath,
    path.resolve(libraryPath, targetPath),
    "Caminho inválido",
  );
}

function sanitizeFolderName(folderName: string): string {
  const trimmedName = folderName.trim();
  if (
    !trimmedName ||
    trimmedName === "." ||
    trimmedName === ".." ||
    /[\\/:*?"<>|]/.test(trimmedName)
  ) {
    throw new Error("Nome de pasta inválido");
  }

  return trimmedName;
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

    // First check if document exists by path (handles file modifications that change hash)
    const existingByPath = getDocumentByPath(filePath);
    
    const fileHash = generateFileHash(filePath);
    const existing = existingByPath || getDocumentByHash(fileHash);

    // If document exists with same path but different hash (file was modified), update the hash
    if (existingByPath && existingByPath.fileHash !== fileHash) {
      // Update the document with new hash but keep the same record
      updateDocumentPath(fileHash, filePath);
    }

    if (existing && existing.processingStatus === "completed") {
      // Still update thumbnail and page count
      const thumbnailPath = await generateThumbnail(filePath, fileHash, true);
      if (thumbnailPath) {
        updateThumbnailPath(fileHash, thumbnailPath);
      }
      const numPages = await getPdfPageCount(filePath);
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
  } as any);

  fileWatcher.on("add", (filePath) => {
    if (filePath.toLowerCase().endsWith(".pdf")) {
      console.log("[Main] New PDF detected:", filePath);
      processFile(filePath);
    }
  });

  fileWatcher.on("unlink", (filePath) => {
    if (filePath.toLowerCase().endsWith(".pdf")) {
      console.log("[Main] PDF removed:", filePath);
      // Try to find by path first (most reliable)
      const doc = getDocumentByPath(filePath);
      if (doc) {
        const result = deleteDocument(doc.fileHash);
        if (result.success) {
          console.log("[Main] Document deleted from DB:", doc.fileHash);
          win?.webContents.send("library:updated");
        }
        return;
      }
      // Fallback: try hash but handle errors gracefully
      try {
        if (fs.existsSync(filePath)) {
          return; // File still exists, maybe a rename
        }
        const fileHash = generateFileHash(filePath);
        const result = deleteDocument(fileHash);
        if (result.success) {
          console.log("[Main] Document deleted from DB:", fileHash);
          win?.webContents.send("library:updated");
        }
      } catch (err) {
        // File doesn't exist or can't be read - ignore
        console.log("[Main] Could not process unlink event:", filePath);
      }
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

async function resyncLibrary(): Promise<{ added: number; removed: number; updated: number }> {
  const libraryPath = LIBRARY_PATH();
  let added = 0, removed = 0, updated = 0;

  if (!fs.existsSync(libraryPath)) {
    return { added: 0, removed: 0, updated: 0 };
  }

  const pdfFiles = getAllPdfFiles(libraryPath);
  const pdfFileSet = new Set(pdfFiles.map(f => f.toLowerCase()));

  const allDocs = getAllDocuments();
  const docsInLibrary = allDocs.filter(d => d.filePath && d.filePath.startsWith(libraryPath));

  for (const doc of docsInLibrary) {
    if (doc.filePath && !pdfFileSet.has(doc.filePath.toLowerCase())) {
      console.log("[Main] Resync: PDF no longer exists, removing from DB:", doc.filePath);
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
          console.error("[Main] Resync error:", filePath, error);
        }
      }));
    }
  };

  await processInBatches(pdfFiles, 10);

  console.log(`[Main] Resync complete: added=${added}, removed=${removed}, updated=${updated}`);
  return { added, removed, updated };
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
  force = false,
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

    if (!force) {
      const existingPath = findExistingThumbnail();
      if (existingPath) {
        return existingPath;
      }
    }

    // Delete existing thumbnail if force regenerating
    if (force) {
      const existingFiles = fs.readdirSync(thumbnailsDir);
      for (const file of existingFiles) {
        if (file.startsWith(`${fileHash}-`) && file.endsWith(".jpg")) {
          fs.unlinkSync(path.join(thumbnailsDir, file));
          console.log(`Deleted existing thumbnail: ${file}`);
        }
      }
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
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
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
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event) => {
    event.preventDefault();
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

ipcMain.handle("dialog:open-image", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "Images", extensions: ["jpg", "jpeg", "png"] }],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  return result.filePaths[0];
});

ipcMain.handle("dialog:import-pdf", async (_, targetFolder: string | null, action: "move" | "copy" = "copy") => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile", "multiSelections"],
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  
  if (result.canceled || result.filePaths.length === 0) {
    return { success: false, canceled: true };
  }

  try {
    const targetDir = resolveLibraryRelativePath(targetFolder);

    if (!fs.existsSync(targetDir)) {
      return { success: false, errors: ["Pasta de destino não existe"] };
    }

    const imported: string[] = [];
    const errors: string[] = [];

    for (const filePath of result.filePaths) {
      try {
        const fileName = path.basename(filePath);
        const destPath = path.join(targetDir, fileName);
        
        if (fs.existsSync(destPath)) {
          errors.push(`${fileName} já existe na pasta`);
          continue;
        }

        if (action === "move") {
          fs.renameSync(filePath, destPath);
        } else {
          fs.copyFileSync(filePath, destPath);
        }
        imported.push(fileName);
      } catch (err) {
        const error = err as Error & { code?: string };
        errors.push(`${path.basename(filePath)}: ${error.message}`);
      }
    }

    const actionWord = action === "move" ? "movido(s)" : "copiado(s)";
    return { 
      success: true, 
      imported, 
      errors,
      message: imported.length > 0 
        ? `${imported.length} livro(s) ${actionWord}` 
        : "Nenhum livro importado"
    };
  } catch (error) {
    return { success: false, errors: [error instanceof Error ? error.message : "Caminho inválido"] };
  }
});

ipcMain.handle("app:get-last-document", () => {
  return getLastDocument();
});

ipcMain.handle("thumbnail:get", async (_, thumbnailPath: string) => {
  try {
    if (!thumbnailPath) {
      return null;
    }

    const thumbnailsDir = THUMBNAILS_DIR();
    const normalizedThumbnailPath = path.resolve(thumbnailPath);

    if (!isPathWithin(thumbnailsDir, normalizedThumbnailPath)) {
      return null;
    }

    if (fs.existsSync(normalizedThumbnailPath)) {
      const buffer = fs.readFileSync(normalizedThumbnailPath);
      return `data:image/jpeg;base64,${buffer.toString("base64")}`;
    }

    const baseName = path.basename(normalizedThumbnailPath, path.extname(normalizedThumbnailPath));
    const hash = baseName.replace(/-\d+$/, "").replace(/-0+\d+$/, "");
    
    if (fs.existsSync(thumbnailsDir)) {
      const files = fs.readdirSync(thumbnailsDir);
      const match = files.find(f => f.startsWith(hash) && f.endsWith(".jpg"));
      if (match) {
        const buffer = fs.readFileSync(path.join(thumbnailsDir, match));
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
    const knownDocument =
      (fileHash ? getDocumentByHash(fileHash) : undefined) ||
      getDocumentByPath(filePath);

    if (!knownDocument?.filePath) {
      return {
        error: "FILE_NOT_FOUND",
        message: "O arquivo solicitado não pertence à biblioteca da aplicação",
      };
    }

    if (fs.existsSync(knownDocument.filePath)) {
      const fileBuffer = fs.readFileSync(knownDocument.filePath).buffer;
      const hash = generateFileHash(knownDocument.filePath);
      return { fileBuffer, fileHash: hash };
    }

    console.log("[pdf:reopen] File not found, searching by hash:", knownDocument.filePath);

    if (!fileHash) {
      return { error: "FILE_NOT_FOUND", message: "Arquivo não encontrado e hash não fornecido" };
    }

    const libraryPath = LIBRARY_PATH();
    const userDataPath = USER_DATA_PATH();
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

ipcMain.handle("library:resync", async () => {
  const result = await resyncLibrary();
  win?.webContents.send("library:updated");
  return result;
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
  
  try {
    const targetDir = resolveLibraryRelativePath(category);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const fileName = path.basename(doc.filePath);
    const targetPath = path.join(targetDir, fileName);

    if (action === "move") {
      fs.renameSync(doc.filePath, targetPath);
    } else {
      fs.copyFileSync(doc.filePath, targetPath);
    }
    
    if (doc.thumbnailPath && fs.existsSync(doc.thumbnailPath)) {
      const thumbFileName = path.basename(doc.thumbnailPath);
      const targetThumbPath = path.join(USER_DATA_PATH(), "thumbnails", thumbFileName);
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

ipcMain.handle("book:delete", (_, fileHash: string, deleteFile: boolean = false) => {
  const doc = getDocumentByHash(fileHash);
  if (!doc) return { success: false, error: "Document not found" };
  
  if (deleteFile && doc.filePath) {
    try {
      if (fs.existsSync(doc.filePath)) {
        fs.unlinkSync(doc.filePath);
        console.log("[Main] Deleted file:", doc.filePath);
      }
    } catch (error) {
      console.error("[Main] Error deleting file:", error);
      return { success: false, error: "Erro ao excluir arquivo do disco" };
    }
  }
  
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
    const thumbnailPath = await generateThumbnail(doc.filePath, fileHash, true);
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
  const doc = getDocumentByPath(filePath);
  if (!doc?.filePath) {
    return false;
  }

  require("electron").shell.showItemInFolder(doc.filePath);
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

ipcMain.handle("library:create-folder", async (_, folderName: string, parentPath: string | null = null) => {
   try {
     const basePath = resolveLibraryRelativePath(parentPath);
     const safeFolderName = sanitizeFolderName(folderName);
     const newFolderPath = assertPathWithin(
       LIBRARY_PATH(),
       path.join(basePath, safeFolderName),
       "Caminho inválido",
     );
     
     if (fs.existsSync(newFolderPath)) {
       return { success: false, error: "Pasta já existe" };
     }
     
     fs.mkdirSync(newFolderPath, { recursive: true });
     win?.webContents.send("library:updated");
     return { success: true };
   } catch (error: unknown) {
     const err = error as Error & { code?: string };
     console.error("[library:create-folder] Error:", err);
     let errorMessage = "Erro ao criar pasta";
     if (err.code === "EACCES") {
       errorMessage = "Permissão negada";
     }
     return { success: false, error: errorMessage };
   }
 });

ipcMain.handle("library:rename-folder", async (_, oldPath: string, newName: string) => {
  try {
    console.log("[library:rename-folder] oldPath:", oldPath, "newName:", newName);
    const safeOldPath = assertPathWithin(LIBRARY_PATH(), oldPath, "Caminho inválido");
    const parentPath = path.dirname(safeOldPath);
    const safeFolderName = sanitizeFolderName(newName);
    const newPath = assertPathWithin(
      LIBRARY_PATH(),
      path.join(parentPath, safeFolderName),
      "Caminho inválido",
    );
    console.log("[library:rename-folder] newPath:", newPath);
    
    if (fs.existsSync(newPath)) {
      return { success: false, error: "Já existe uma pasta com este nome" };
    }
    
    const allDocs = getAllDocuments();
    const docsInFolder = allDocs.filter(d => d.filePath && d.filePath.startsWith(safeOldPath));
    
    fs.renameSync(safeOldPath, newPath);
    
    for (const doc of docsInFolder) {
      if (doc.filePath) {
        const newFilePath = doc.filePath.replace(safeOldPath, newPath);
        updateDocumentPath(doc.fileHash, newFilePath);
      }
    }
    
    win?.webContents.send("library:updated");
    return { success: true };
  } catch (error: unknown) {
    const err = error as Error & { code?: string };
    console.error("[library:rename-folder] Error:", err);
    let errorMessage = "Erro ao renomear pasta";
    if (err.code === "EBUSY" || err.code === "ENOTEMPTY") {
      errorMessage = "Pasta está sendo usada";
    } else if (err.code === "EPERM") {
      errorMessage = "Permissão negada";
    }
    return { success: false, error: errorMessage };
  }
});

ipcMain.handle("library:delete-folder", async (_, folderPath: string, force = false) => {
  try {
    const safeFolderPath = assertPathWithin(LIBRARY_PATH(), folderPath, "Caminho inválido");

    if (safeFolderPath === LIBRARY_PATH()) {
      return { success: false, error: "A pasta raiz não pode ser excluída" };
    }

    if (!fs.existsSync(safeFolderPath)) {
      return { success: false, error: "Pasta não existe" };
    }

    if (!force) {
      const items = fs.readdirSync(safeFolderPath, { withFileTypes: true });
      const nonEmpty = items.filter(item => !item.name.startsWith("."));
      
      if (nonEmpty.length > 0) {
        return { success: false, error: "Pasta não está vazia" };
      }
    }

    fs.rmSync(safeFolderPath, { recursive: true, force: true });
    win?.webContents.send("library:updated");
    return { success: true };
  } catch (error: unknown) {
    const err = error as Error & { code?: string };
    console.error("[library:delete-folder] Error:", err);
    let errorMessage = "Erro ao excluir pasta";
    if (err.code === "EBUSY" || err.code === "ENOTEMPTY") {
      errorMessage = "Pasta está sendo usada";
    } else if (err.code === "EPERM") {
      errorMessage = "Permissão negada";
    }
    return { success: false, error: errorMessage };
  }
});

ipcMain.handle("library:move-folder", async (_, sourcePath: string, targetPath: string | null) => {
  try {
    const libraryPath = LIBRARY_PATH();
    const safeSourcePath = assertPathWithin(libraryPath, sourcePath, "Caminho inválido");

    if (!fs.existsSync(safeSourcePath)) {
      return { success: false, error: "Pasta não existe" };
    }

    const targetDir = resolveLibraryRelativePath(targetPath);
    
    const folderName = path.basename(safeSourcePath);
    const destinationPath = path.join(targetDir, folderName);
    
    if (fs.existsSync(destinationPath)) {
      return { success: false, error: "Já existe uma pasta com este nome no destino" };
    }

    if (safeSourcePath === destinationPath) {
      return { success: true };
    }

    if (isPathWithin(safeSourcePath, destinationPath)) {
      return { success: false, error: "Não pode mover uma pasta para dentro de si mesma" };
    }

    const allDocs = getAllDocuments();
    const docsInFolder = allDocs.filter(d => d.filePath && d.filePath.startsWith(safeSourcePath));
    
    fs.renameSync(safeSourcePath, destinationPath);
    
    for (const doc of docsInFolder) {
      if (doc.filePath) {
        const newFilePath = doc.filePath.replace(safeSourcePath, destinationPath);
        updateDocumentPath(doc.fileHash, newFilePath);
      }
    }
    
    win?.webContents.send("library:updated");
    return { success: true };
  } catch (error: unknown) {
    const err = error as Error & { code?: string };
    console.error("[library:move-folder] Error:", err);
    let errorMessage = "Erro ao mover pasta";
    if (err.code === "EBUSY" || err.code === "ENOTEMPTY") {
      errorMessage = "Pasta está sendo usada";
    } else if (err.code === "EPERM") {
      errorMessage = "Permissão negada";
    }
    return { success: false, error: errorMessage };
  }
});

ipcMain.handle("library:move-book", async (_, fileHash: string, targetFolderPath: string | null) => {
  try {
    const doc = getDocumentByHash(fileHash);
    
    if (!doc || !doc.filePath) {
      return { success: false, error: "Livro não encontrado" };
    }

    const currentDir = path.dirname(doc.filePath);
    const fileName = path.basename(doc.filePath);
    
    const targetDir = resolveLibraryRelativePath(targetFolderPath);

    if (currentDir === targetDir) {
      return { success: true };
    }

    if (!fs.existsSync(targetDir)) {
      return { success: false, error: "Pasta de destino não existe" };
    }

    const newFilePath = path.join(targetDir, fileName);
    
    if (fs.existsSync(newFilePath)) {
      return { success: false, error: "Já existe um arquivo com este nome na pasta de destino" };
    }

    fs.renameSync(doc.filePath, newFilePath);
    updateDocumentPath(fileHash, newFilePath);
    
    win?.webContents.send("library:updated");
    return { success: true };
  } catch (error: unknown) {
    const err = error as Error & { code?: string };
    console.error("[library:move-book] Error:", err);
    let errorMessage = "Erro ao mover livro";
    if (err.code === "EBUSY") {
      errorMessage = "Arquivo está sendo usado";
    } else if (err.code === "EPERM") {
      errorMessage = "Permissão negada";
    }
    return { success: false, error: errorMessage };
  }
});

ipcMain.handle("pdf:set-thumbnail", async (_, fileHash: string, imagePath: string, mode: "replace" | "prepend") => {
  try {
    const doc = getDocumentByHash(fileHash);
    if (!doc || !doc.filePath) {
      return { success: false, error: "Livro não encontrado" };
    }

    if (!fs.existsSync(doc.filePath)) {
      return { success: false, error: "Arquivo não encontrado" };
    }

    if (!fs.existsSync(imagePath)) {
      return { success: false, error: "Imagem não encontrada" };
    }

    const pdfDoc = await PDFDocument.load(fs.readFileSync(doc.filePath));
    const imageExt = path.extname(imagePath).toLowerCase();
    
    let image;
    if (imageExt === ".png") {
      const pngImage = fs.readFileSync(imagePath);
      image = await pdfDoc.embedPng(pngImage);
    } else if (imageExt === ".jpg" || imageExt === ".jpeg") {
      const jpgImage = fs.readFileSync(imagePath);
      image = await pdfDoc.embedJpg(jpgImage);
    } else {
      return { success: false, error: "Formato de imagem não suportado. Use PNG ou JPG." };
    }

    const { width, height } = pdfDoc.getPage(0).getSize();
    const imageDims = image.scaleToFit(width, height);

    if (mode === "replace") {
      pdfDoc.removePage(0);
      const newPage = pdfDoc.insertPage(0, [width, height]);
      newPage.drawImage(image, {
        x: imageDims.x,
        y: imageDims.y,
        width: imageDims.width,
        height: imageDims.height,
      });
    } else {
      const newPage = pdfDoc.insertPage(0, [width, height]);
      newPage.drawImage(image, {
        x: imageDims.x,
        y: imageDims.y,
        width: imageDims.width,
        height: imageDims.height,
      });
    }

    const pdfBytes = await pdfDoc.save();
    
    // Write to a temp file first, then rename to avoid triggering file watcher
    const tempPath = doc.filePath + ".tmp";
    fs.writeFileSync(tempPath, Buffer.from(pdfBytes));
    fs.unlinkSync(doc.filePath);
    fs.renameSync(tempPath, doc.filePath);

    await generateThumbnail(doc.filePath, fileHash, true);
    
    if (mode === "replace") {
      updateDocumentNumPages(fileHash, pdfDoc.getPageCount());
    }
    
    return { success: true };
  } catch (error: unknown) {
    const err = error as Error & { message?: string };
    console.error("[pdf:set-thumbnail] Error:", err);
    return { success: false, error: err.message || "Erro ao modificar PDF" };
  }
});

ipcMain.handle("backup:init", (_, supabaseUrl: string, supabaseAnonKey: string) => {
  try {
    initBackupClient(supabaseUrl, supabaseAnonKey);
    console.log("[Backup] Supabase client initialized");
    return { success: true };
  } catch (error) {
    const err = error as Error & { message?: string };
    console.error("[Backup] Error initializing:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("backup:set-session", async (_, accessToken: string, refreshToken: string) => {
  try {
    return await setBackupSession(accessToken, refreshToken);
  } catch (error) {
    const err = error as Error & { message?: string };
    console.error("[Backup] Error setting session:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("backup:clear-session", async () => {
  try {
    return await clearBackupSession();
  } catch (error) {
    const err = error as Error & { message?: string };
    console.error("[Backup] Error clearing session:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("backup:all-documents", async () => {
  try {
    const docs = getDocumentsForBackup();
    const result = await backupAllDocuments(docs);
    console.log(`[Backup] Completed: ${result.success} succeeded, ${result.failed} failed`);
    return result;
  } catch (error) {
    const err = error as Error & { message?: string };
    console.error("[Backup] Error:", err);
    return { success: 0, failed: 0, errors: [err.message] };
  }
});

ipcMain.handle("backup:all-habits", async () => {
  try {
    const habits = getAllHabits();
    const completions = getAllHabitCompletions();
    const result = await backupAllHabits(habits, completions);
    console.log(`[Backup] Habits completed: ${result.success} succeeded, ${result.failed} failed`);
    return result;
  } catch (error) {
    const err = error as Error & { message?: string };
    console.error("[Backup] Habits error:", err);
    return { success: 0, failed: 0, errors: [err.message] };
  }
});

ipcMain.handle("backup:all-categories", async () => {
  try {
    const categories = getAllCategories();
    const documentCategories = getAllDocumentCategories();
    const result = await backupAllCategories(categories, documentCategories);
    console.log(`[Backup] Categories completed: ${result.success} succeeded, ${result.failed} failed`);
    return result;
  } catch (error) {
    const err = error as Error & { message?: string };
    console.error("[Backup] Categories error:", err);
    return { success: 0, failed: 0, errors: [err.message] };
  }
});

ipcMain.handle("habits:get-all", () => {
  return getAllHabits();
});

ipcMain.handle("habits:get-by-id", (_, id: string) => {
  return getHabitById(id);
});

ipcMain.handle("habits:add", (_, habit: { id: string; name: string; unit: string | null; valueMode: string }) => {
  addHabit(habit);
  return { success: true };
});

ipcMain.handle("habits:update", (_, id: string, updates: { name?: string; unit?: string | null; valueMode?: string }) => {
  updateHabit(id, updates);
  return { success: true };
});

ipcMain.handle("habits:delete", (_, id: string) => {
  deleteHabit(id);
  return { success: true };
});

ipcMain.handle("habits:get-completions", (_, habitId: string) => {
  return getHabitCompletions(habitId);
});

ipcMain.handle("habits:get-all-completions", () => {
  return getAllHabitCompletions();
});

ipcMain.handle("habits:set-completion", (_, habitId: string, dateKey: string, value: string | null) => {
  setHabitCompletion(habitId, dateKey, value);
  return { success: true };
});

ipcMain.handle("habits:delete-completion", (_, habitId: string, dateKey: string) => {
  deleteHabitCompletion(habitId, dateKey);
  return { success: true };
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
