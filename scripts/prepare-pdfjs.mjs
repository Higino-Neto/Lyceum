import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pdfjsDistDir = path.join(rootDir, "node_modules", "pdfjs-dist");
const pdfjsVersion = "4.10.38";
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

// Always build from the tracked source. A pre-existing, ignored build output
// must never change which PDF.js implementation is shipped.
const sourceDir = path.join(rootDir, "vendor", `pdfjs-${pdfjsVersion}`);
const viewerSourceDir = path.join(sourceDir, "build", "generic");
const gulpBinary = path.join(sourceDir, "node_modules", ".bin", process.platform === "win32" ? "gulp.cmd" : "gulp");
const dependencyMarker = path.join(sourceDir, "node_modules", ".lyceum-lock-hash");
const lockHash = createHash("sha256")
  .update(fs.readFileSync(path.join(sourceDir, "package-lock.json")))
  .digest("hex");
if (!fs.existsSync(gulpBinary) || !fs.existsSync(dependencyMarker) ||
    fs.readFileSync(dependencyMarker, "utf8") !== lockHash) {
  console.log("[prepare-pdfjs] Installing vendored PDF.js build dependencies");
  execFileSync(process.platform === "win32" ? "npm.cmd" : "npm", ["ci", "--ignore-scripts"], {
    cwd: sourceDir,
    stdio: "inherit",
  });
  fs.writeFileSync(dependencyMarker, lockHash);
}
console.log("[prepare-pdfjs] Building vendored PDF.js from source");
execFileSync(gulpBinary, ["generic"], { cwd: sourceDir, stdio: "inherit" });
if (!fs.existsSync(path.join(viewerSourceDir, "web", "viewer.html"))) {
  throw new Error(`PDF.js source build did not produce ${viewerSourceDir}.`);
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
function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) {
    throw new Error(`PDF.js ${label} integration point changed; update the Lyceum adapter.`);
  }
  return source.replace(before, after);
}
viewerHtml = replaceOnce(viewerHtml,
  '<link rel="stylesheet" href="viewer.css">',
  '<link rel="stylesheet" href="viewer.css">\n<link rel="stylesheet" href="../lyceum/lyceum-pdfjs.css">',
  "viewer stylesheet",
);
viewerHtml = replaceOnce(viewerHtml,
  '<script src="viewer.mjs" type="module"></script>',
  '<script src="../lyceum/lyceum-bridge.mjs" type="module"></script>\n  <script src="viewer.mjs" type="module"></script>',
  "viewer script",
);
fs.writeFileSync(viewerHtmlPath, viewerHtml);

console.log(`[prepare-pdfjs] PDF.js viewer assets written to ${path.relative(rootDir, targetDir)}`);
