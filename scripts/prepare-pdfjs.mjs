import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pdfjsDistDir = path.join(rootDir, "node_modules", "pdfjs-dist");
const pdfjsVersion = "4.10.38";
const viewerSourceDir = path.join(rootDir, "vendor", `pdfjs-${pdfjsVersion}-dist`);
const lyceumViewerDir = path.join(rootDir, "resources", "pdfjs-viewer");
const targetDir = path.join(rootDir, "public", "pdfjs");

function copyFile(source, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function copyDirectory(source, target, options = {}) {
  const { skipMaps = true, skipNames = new Set() } = options;

  fs.mkdirSync(target, { recursive: true });

  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (skipNames.has(entry.name)) {
      continue;
    }

    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);

    if (skipMaps && entry.name.endsWith(".map")) {
      continue;
    }

    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath, options);
    } else if (entry.isFile()) {
      copyFile(sourcePath, targetPath);
    }
  }
}

if (!fs.existsSync(pdfjsDistDir)) {
  throw new Error("pdfjs-dist was not found. Run npm install before preparing PDF.js assets.");
}

const installedPdfjsPackage = JSON.parse(
  fs.readFileSync(path.join(pdfjsDistDir, "package.json"), "utf8"),
);

if (installedPdfjsPackage.version !== pdfjsVersion) {
  throw new Error(
    `pdfjs-dist is ${installedPdfjsPackage.version}, but the vendored Mozilla viewer is ${pdfjsVersion}. ` +
      "Update vendor/pdfjs-* and scripts/prepare-pdfjs.mjs together.",
  );
}

if (!fs.existsSync(viewerSourceDir)) {
  throw new Error(`Vendored Mozilla PDF.js viewer was not found at ${viewerSourceDir}.`);
}

fs.rmSync(targetDir, { recursive: true, force: true });
fs.mkdirSync(targetDir, { recursive: true });

copyDirectory(viewerSourceDir, targetDir, {
  skipMaps: true,
  skipNames: new Set(["compressed.tracemonkey-pldi-09.pdf"]),
});

copyDirectory(lyceumViewerDir, path.join(targetDir, "lyceum"), {
  skipMaps: true,
  skipNames: new Set(["README.md"]),
});

const viewerHtmlPath = path.join(targetDir, "web", "viewer.html");
let viewerHtml = fs.readFileSync(viewerHtmlPath, "utf8");
viewerHtml = viewerHtml.replace(
  '<link rel="stylesheet" href="viewer.css">',
  '<link rel="stylesheet" href="viewer.css">\n<link rel="stylesheet" href="../lyceum/lyceum-pdfjs.css">',
);
viewerHtml = viewerHtml.replace(
  '<script src="viewer.mjs" type="module"></script>',
  '<script src="../lyceum/lyceum-bridge.mjs" type="module"></script>\n  <script src="viewer.mjs" type="module"></script>',
);
fs.writeFileSync(viewerHtmlPath, viewerHtml);

const viewerScriptPath = path.join(targetDir, "web", "viewer.mjs");
let viewerScript = fs.readFileSync(viewerScriptPath, "utf8");
const lyceumValidateFileUrlGuard = `      const fileUrl = new URL(file, window.location.href);
      if (fileUrl.protocol === "lyceum-pdf:") {
        return;
      }

      const fileOrigin = fileUrl.origin;
      if (fileOrigin !== viewerOrigin) {
        throw new Error("file origin does not match viewer's");
      }`;

const validateFileUrlGuardPattern =
  /      const fileOrigin = new URL\(file, window\.location\.href\)\.origin;\r?\n      if \(fileOrigin !== viewerOrigin\) \{\r?\n        throw new Error\("file origin does not match viewer's"\);\r?\n      \}/;

if (!viewerScript.includes(lyceumValidateFileUrlGuard)) {
  if (!validateFileUrlGuardPattern.test(viewerScript)) {
    const validationIndex = viewerScript.indexOf(`throw new Error("file origin does not match viewer's");`);
    const validationSnippet = validationIndex >= 0
      ? viewerScript.slice(Math.max(0, validationIndex - 240), validationIndex + 120)
      : "validation guard not found";
    throw new Error(
      "Could not patch Mozilla PDF.js viewer URL validation for Lyceum.\n" +
        `Nearby viewer.mjs snippet:\n${validationSnippet}`,
    );
  }

  viewerScript = viewerScript.replace(validateFileUrlGuardPattern, lyceumValidateFileUrlGuard);
}

if (!viewerScript.includes(lyceumValidateFileUrlGuard)) {
  throw new Error("Could not patch Mozilla PDF.js viewer URL validation for Lyceum.");
}

const crossFrameWebViewerLoadedDispatch = `  try {
    parent.document.dispatchEvent(event);
  } catch (ex) {
    console.error("webviewerloaded:", ex);
    document.dispatchEvent(event);
  }`;
const localWebViewerLoadedDispatch = `  document.dispatchEvent(event);`;
const crossFrameWebViewerLoadedDispatchPattern =
  /  try \{\r?\n    parent\.document\.dispatchEvent\(event\);\r?\n  \} catch \(ex\) \{\r?\n    console\.error\("webviewerloaded:", ex\);\r?\n    document\.dispatchEvent\(event\);\r?\n  \}/;

if (crossFrameWebViewerLoadedDispatchPattern.test(viewerScript)) {
  viewerScript = viewerScript.replace(
    crossFrameWebViewerLoadedDispatchPattern,
    localWebViewerLoadedDispatch,
  );
}

if (crossFrameWebViewerLoadedDispatchPattern.test(viewerScript) || !viewerScript.includes(localWebViewerLoadedDispatch)) {
  const webViewerLoadedIndex = viewerScript.indexOf(`webviewerloaded`);
  const webViewerLoadedSnippet = webViewerLoadedIndex >= 0
    ? viewerScript.slice(Math.max(0, webViewerLoadedIndex - 240), webViewerLoadedIndex + 360)
    : "webviewerloaded dispatch not found";
  throw new Error(
    "Could not patch Mozilla PDF.js webviewerloaded dispatch for Lyceum.\n" +
      `Nearby viewer.mjs snippet:\n${webViewerLoadedSnippet}`,
  );
}
fs.writeFileSync(viewerScriptPath, viewerScript);

console.log(`[prepare-pdfjs] PDF.js viewer assets written to ${path.relative(rootDir, targetDir)}`);
