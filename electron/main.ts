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
  updateLastOpened,
  updateReadingState,
} from "./local-database";

interface DocumentRecord {
  id: number;
  title: string;
  filePath: string;
  fileHash: string;
  currentPage: number;
  currentZoom: number;
  currentScroll: number;
  annotations: string;
}

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const __filename = fileURLToPath(import.meta.url);
(globalThis as any).__filename = __filename;
import crypto from "crypto";
import fs from "fs";

process.env.APP_ROOT = path.join(__dirname, "..");

export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

let win: BrowserWindow | null = null;

function generateFileHash(filePath: string) {
  const fileBuffer = fs.readFileSync(filePath);
  const hash = crypto.createHash("sha256");
  hash.update(fileBuffer);
  return hash.digest("hex");
}

async function generateThumbnail(filePath: string, fileHash: string): Promise<string | null> {
  try {
    const pdfRequire = require("pdf-poppler");
    const thumbnailsDir = path.join(app.getPath("userData"), "thumbnails");
    
    if (!fs.existsSync(thumbnailsDir)) {
      fs.mkdirSync(thumbnailsDir, { recursive: true });
    }

    const outputPath = path.join(thumbnailsDir, `${fileHash}.jpg`);
    
    if (fs.existsSync(outputPath)) {
      return outputPath;
    }

    const opts = {
      format: "jpeg",
      outDir: thumbnailsDir,
      outPrefix: fileHash,
      page: 1,
      quality: 80,
    };

    await pdfRequire.convert(filePath, opts);
    return outputPath;
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

app.whenReady().then(() => {
  initDatabase();
  autoUpdater.checkForUpdatesAndNotify();
  createWindow();
});

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
    updateLastOpened(fileHash); // ✅ atualiza timestamp ao reabrir
    return { ...existing, fileBuffer };
  }

  const thumbnailPath = await generateThumbnail(filePath, fileHash);
  addDocument(title, filePath, fileHash, thumbnailPath || undefined);
  const doc = getDocumentByHash(fileHash);
  if (!doc) return null;
  return { ...doc, fileBuffer };
});

ipcMain.handle("app:get-last-document", () => {
  return getLastDocument();
});

ipcMain.handle("thumbnail:get", async (_, thumbnailPath: string) => {
  try {
    if (!thumbnailPath || !fs.existsSync(thumbnailPath)) {
      return null;
    }
    const buffer = fs.readFileSync(thumbnailPath);
    return `data:image/jpeg;base64,${buffer.toString("base64")}`;
  } catch {
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