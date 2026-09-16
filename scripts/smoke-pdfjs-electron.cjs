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
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true },
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
    if (state?.pages === 1 && state.text.includes("Lyceum PDF.js worker smoke test")) {
      if (!state.realWorker || !state.bridge) {
        throw new Error(`Viewer loaded without a real PDF.js worker or Lyceum bridge: ${JSON.stringify(state)}`);
      }
      console.log("[smoke-pdfjs] Viewer, real worker, text extraction and Lyceum bridge passed");
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
  app.quit();
});
