import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pdfjsDistDir = path.join(rootDir, "node_modules", "pdfjs-dist");
const viewerSourceDir = path.join(rootDir, "resources", "pdfjs-viewer");
const targetDir = path.join(rootDir, "public", "pdfjs");

function copyFile(source, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function copyDirectory(source, target, options = {}) {
  const { skipMaps = true } = options;

  fs.mkdirSync(target, { recursive: true });

  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
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

fs.rmSync(targetDir, { recursive: true, force: true });
fs.mkdirSync(targetDir, { recursive: true });

copyDirectory(viewerSourceDir, targetDir);

copyFile(
  path.join(pdfjsDistDir, "build", "pdf.mjs"),
  path.join(targetDir, "build", "pdf.mjs"),
);
copyFile(
  path.join(pdfjsDistDir, "build", "pdf.worker.mjs"),
  path.join(targetDir, "build", "pdf.worker.mjs"),
);
copyFile(
  path.join(pdfjsDistDir, "build", "pdf.sandbox.mjs"),
  path.join(targetDir, "build", "pdf.sandbox.mjs"),
);

copyFile(
  path.join(pdfjsDistDir, "web", "pdf_viewer.mjs"),
  path.join(targetDir, "web", "pdf_viewer.mjs"),
);
copyFile(
  path.join(pdfjsDistDir, "web", "pdf_viewer.css"),
  path.join(targetDir, "web", "pdf_viewer.css"),
);
copyDirectory(
  path.join(pdfjsDistDir, "web", "images"),
  path.join(targetDir, "web", "images"),
);
copyDirectory(
  path.join(pdfjsDistDir, "cmaps"),
  path.join(targetDir, "cmaps"),
);
copyDirectory(
  path.join(pdfjsDistDir, "standard_fonts"),
  path.join(targetDir, "standard_fonts"),
);
copyDirectory(
  path.join(pdfjsDistDir, "image_decoders"),
  path.join(targetDir, "image_decoders"),
);

console.log(`[prepare-pdfjs] PDF.js viewer assets written to ${path.relative(rootDir, targetDir)}`);
