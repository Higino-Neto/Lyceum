const electron = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { PDFDocument, StandardFonts } = require("pdf-lib");

const { app, BrowserWindow, protocol } = electron;
const assetRoot = path.resolve(__dirname, "..", "public", "pdfjs");
const mime = {
  ".html": "text/html",
  ".mjs": "text/javascript",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};

protocol.registerSchemesAsPrivileged([
  { scheme: "lyceum-pdfjs", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
  { scheme: "lyceum-pdf", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);
app.commandLine.appendSwitch("no-sandbox");
app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("disable-dev-shm-usage");

async function main() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([612, 792]);
  page.drawText("Lyceum PDF.js worker smoke test", { x: 50, y: 700, font, size: 18 });
  for (let number = 2; number <= 20; number++) {
    const sheet = pdf.addPage(number === 12 ? [792, 612] : [612, 792]);
    sheet.drawText(`BookEdge - page ${number}`, { x: 50, y: 500, font, size: 24 });
    sheet.drawRectangle({ x: 50, y: 200, width: 250 + number * 5, height: 150 });
  }
  const bytes = await pdf.save();

  protocol.handle("lyceum-pdfjs", request => {
    const url = new URL(request.url);
    const assetPath = path.resolve(assetRoot, `.${decodeURIComponent(url.pathname)}`);
    if (!assetPath.startsWith(`${assetRoot}${path.sep}`) || !fs.existsSync(assetPath)) {
      return new Response(null, { status: 404 });
    }
    return new Response(fs.readFileSync(assetPath), {
      headers: { "Content-Type": mime[path.extname(assetPath)] || "application/octet-stream" },
    });
  });
  protocol.handle("lyceum-pdf", () => new Response(bytes, {
    headers: { "Content-Type": "application/pdf", "Access-Control-Allow-Origin": "*" },
  }));

  const win = new BrowserWindow({
    show: false,
    width: 1440, height: 1000,
    webPreferences: { backgroundThrottling: false, contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true },
  });
  const errors = [];
  const watchdog = setTimeout(() => {
    console.error(`[smoke-pdfjs] Electron did not finish within 45 seconds. Console: ${errors.slice(-8).join(" | ")}`);
    process.exit(1);
  }, 45000);
  win.webContents.on("console-message", (_event, level, message) => {
    if (level >= 3) errors.push(message);
  });
  win.webContents.on("render-process-gone", (_event, details) => {
    errors.push(`Renderer exited: ${details.reason}`);
  });
  const sourceUrl = "lyceum-pdf://document/" + "a".repeat(64) + ".pdf";
  await win.loadURL(`lyceum-pdfjs://viewer/web/viewer.html?file=${encodeURIComponent(sourceUrl)}`);

  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const state = await win.webContents.executeJavaScript(`(async () => {
      const viewer = globalThis.PDFViewerApplication;
      if (!viewer?.pdfDocument) return null;
      const content = await (await viewer.pdfDocument.getPage(1)).getTextContent();
      return {
        pages: viewer.pdfDocument.numPages,
        text: content.items.map(item => item.str || "").join(" "),
        realWorker: !!viewer.pdfLoadingTask?._worker?._webWorker,
        bridge: !!globalThis.LyceumPdfJs?.getOutline,
      };
    })()`, true).catch(() => null);
    if (state?.pages === 20 && state.text.includes("Lyceum PDF.js worker smoke test")) {
      if (!state.realWorker || !state.bridge) {
        throw new Error(`Viewer loaded without a real PDF.js worker or Lyceum bridge: ${JSON.stringify(state)}`);
      }
      const riffle = await win.webContents.executeJavaScript(`(async () => {
        const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
        for (let i = 0; i < 80 && document.getElementById("lyceumBookEdge")?.hidden !== false; i++) await wait(50);
        const edge = document.getElementById("lyceumBookEdge");
        if (!edge || edge.hidden) throw new Error("BookEdge unavailable");
        const app = globalThis.PDFViewerApplication;
        const before = { page: app.page, scroll: app.pdfViewer.container.scrollTop, scale: app.pdfViewer.currentScale };
        edge.click();
        const dialog = document.getElementById("lyceumRiffle");
        dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "PageDown", bubbles: true }));
        for (let i = 0; i < 160 && document.querySelectorAll(".riffleTile canvas").length < 12; i++) await wait(50);
        const thumbs = document.querySelectorAll(".riffleTile canvas").length;
        if (thumbs !== 12 || !document.querySelector(".rifflePreview canvas")) throw new Error("Riffle canvases did not render: " + thumbs + " / " + dialog.open + " / " + document.querySelector(".riffleGrid").textContent);
        const unchanged = () => app.page === before.page && app.pdfViewer.container.scrollTop === before.scroll && app.pdfViewer.currentScale === before.scale;
        if (!unchanged()) throw new Error("Preview changed reading state");
        dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
        if (dialog.open || !unchanged()) throw new Error("Cancel did not preserve state");
        edge.click();
        dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
        document.querySelector('[data-action="open"]').click();
        for (let i = 0; i < 80 && app.page !== 20; i++) await wait(50);
        if (app.page !== 20 || dialog.open) throw new Error("Explicit navigation failed");
        edge.click();
        for (let i = 0; i < 160 && document.querySelectorAll(".riffleTile canvas").length < 12; i++) await wait(50);
        return { thumbs, page: app.page, preview: !!document.querySelector(".rifflePreview canvas") };
      })()`, true);
      if (process.env.LYCEUM_SMOKE_SCREENSHOT) {
        fs.writeFileSync(process.env.LYCEUM_SMOKE_SCREENSHOT, (await win.webContents.capturePage()).toPNG());
      }
      console.log("[smoke-pdfjs] Viewer, real worker, text extraction, bridge and BookEdge/Riffle passed", riffle);
      clearTimeout(watchdog);
      win.destroy();
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`PDF.js viewer did not render within 30 seconds. Console: ${errors.slice(-8).join(" | ")}`);
}

app.whenReady().then(main).then(() => app.quit()).catch(error => {
  console.error("[smoke-pdfjs]", error);
  process.exitCode = 1;
  app.exit(1);
});
