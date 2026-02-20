import { app, BrowserWindow, ipcMain, dialog } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
// import fs from "node:fs";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.APP_ROOT = path.join(__dirname, "..");

export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

let win: BrowserWindow | null = null;

// const recentsFile = path.join(app.getPath("userData"), "recents.json");

// function saveRecent(filePath: string) {
//   console.log("Salvando em:", recentsFile);

//   let data: any[] = [];

//   if (fs.existsSync(recentsFile)) {
//     data = JSON.parse(fs.readFileSync(recentsFile, "utf-8"));
//   }

//   data = data.filter((item) => item.path !== filePath);

//   const entry = {
//     name: path.basename(filePath),
//     path: filePath,
//     lastOpened: new Date().toISOString(),
//   };

//   data.unshift(entry);
//   data = data.slice(0, 15);

//   fs.writeFileSync(recentsFile, JSON.stringify(data, null, 2));
// }

// function getRecents() {
//   console.log("Lendo de:", recentsFile);

//   if (!fs.existsSync(recentsFile)) return [];

//   const data = JSON.parse(fs.readFileSync(recentsFile, "utf-8"));

//   return data.filter((item: any) => fs.existsSync(item.path));
// }

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
}

app.whenReady().then(() => {
  // console.log("userData path:", app.getPath("userData"));
  createWindow();
});

// // ipcMain.handle("open-pdf", async () => {
// //   console.log("ipc handler 'open-pdf' invoked");
// //   const result = await dialog.showOpenDialog({
// //     properties: ["openFile"],
// //     filters: [{ name: "PDF", extensions: ["pdf"] }],
// //   });

// //   if (result.canceled) return null;

// //   const filePath = result.filePaths[0];

// //   console.log("open-pdf selected:", filePath);

// //   saveRecent(filePath);

// //   return {
// //     name: path.basename(filePath),
// //     path: filePath,
// //   };
// // });

// ipcMain.handle("get-recents", () => {
//   return getRecents();
// });

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
