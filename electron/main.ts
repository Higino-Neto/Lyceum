import { app, BrowserWindow, ipcMain, dialog } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { autoUpdater } from "electron-updater";
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
} from "./local-database";

interface DocumentRecord {
  id: number;
  title: string;
  filePath: string;
  fileHash: string;
  currentPage: number;
  currentZoom: number | null;
  currentScroll: number | null;
  annotations: string | null;
  thumbnailPath: string | null;
  numPages: number;
  createdAt: string;
}

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

function getAllPdfFiles(dir: string): string[] {
  let results: string[] = [];

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

async function scanLibrary() {
  const libraryPath = path.join(app.getPath("userData"), "library");

  if (!fs.existsSync(libraryPath)) return;

  const pdfFiles = getAllPdfFiles(libraryPath);

  for (const filePath of pdfFiles) {
    try {
      const fileHash = generateFileHash(filePath);
      const existing = getDocumentByHash(fileHash);

      const relativePath = path.relative(libraryPath, filePath);
      const pathParts = relativePath.split(path.sep);
      const category = pathParts.length > 1 ? pathParts[0] : null;

      if (!existing) {
        const title = path.basename(filePath);
        const thumbnailPath = await generateThumbnail(filePath, fileHash);
        const numPages = await getPdfPageCount(filePath);

        addDocument(
          title,
          filePath,
          fileHash,
          thumbnailPath || undefined,
          numPages,
        );

        const newDoc = getDocumentByHash(fileHash);
        if (newDoc) {
          updateDocumentSyncStatus(fileHash, true, category || undefined);
        }

        console.log("Added new document:", title);
      } else {
        let needsUpdate = 
          existing.filePath !== filePath || 
          (existing.isSynced !== 1 && existing.isSynced !== undefined) ||
          existing.category !== category;
          
        if (!existing.thumbnailPath) {
          const thumbnailPath = await generateThumbnail(filePath, fileHash);
          if (thumbnailPath) {
            updateThumbnailPath(fileHash, thumbnailPath);
          }
        }
        
        if (needsUpdate) {
          updateDocumentPath(fileHash, filePath);
          updateDocumentSyncStatus(fileHash, true, category || undefined);
          console.log("Updated path:", existing.title);
        }
      }
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
    icon: path.join(process.env.VITE_PUBLIC!, "electron-vite.svg"),
    title: "Lyceum",
    width: 1200,
    height: 800,
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

ipcMain.handle("get-documents", (_, limit?: number, offset?: number) => {
  return getAllDocuments(limit, offset);
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

ipcMain.handle("library:sync-document", async (_, fileHash: string, action: "move" | "copy", category?: string) => {
  const doc = getDocumentByHash(fileHash);
  if (!doc) return { success: false, error: "Document not found" };
  
  const libraryPath = path.join(app.getPath("userData"), "library");
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


app.whenReady().then(async () => {
  initDatabase();
  ensureLibraryFolder();

  await scanLibrary();
  autoUpdater.checkForUpdatesAndNotify();
  createWindow();
});
