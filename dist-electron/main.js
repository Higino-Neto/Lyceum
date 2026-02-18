import { ipcMain as a, dialog as m, app as t, BrowserWindow as l } from "electron";
import { createRequire as f } from "node:module";
import { fileURLToPath as R } from "node:url";
import o from "node:path";
f(import.meta.url);
const p = o.dirname(R(import.meta.url));
process.env.APP_ROOT = o.join(p, "..");
const s = process.env.VITE_DEV_SERVER_URL, E = o.join(process.env.APP_ROOT, "dist-electron"), c = o.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = s ? o.join(process.env.APP_ROOT, "public") : c;
let e;
a.on("open-file-dialog", (r) => {
  m.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "PDF", extensions: ["pdf"] }]
  }).then((n) => {
    n.canceled || r.sender.send("file-opened", n.filePaths[0]);
  });
});
let i = 1;
a.on("zoom", (r, n) => {
  i += n, i = Math.min(Math.max(i, 0.5), 3), r.sender.setZoomFactor(i);
});
function d() {
  e = new l({
    icon: o.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    title: "Lyceum",
    width: 1200,
    height: 800,
    webPreferences: {
      preload: o.join(p, "preload.mjs")
    },
    autoHideMenuBar: !0
  }), e.webContents.on("did-finish-load", () => {
    e == null || e.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), s ? e.loadURL(s) : e.loadFile(o.join(c, "index.html"));
}
t.on("window-all-closed", () => {
  process.platform !== "darwin" && (t.quit(), e = null);
});
t.on("activate", () => {
  l.getAllWindows().length === 0 && d();
});
t.whenReady().then(d);
export {
  E as MAIN_DIST,
  c as RENDERER_DIST,
  s as VITE_DEV_SERVER_URL
};
