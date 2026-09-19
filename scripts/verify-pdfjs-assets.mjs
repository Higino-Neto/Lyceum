import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetRoot = path.join(root, "public", "pdfjs");
const modules = ["build/pdf.mjs", "build/pdf.worker.mjs", "web/viewer.mjs"];
const versions = new Set();
const builds = new Set();

for (const modulePath of modules) {
  const source = fs.readFileSync(path.join(assetRoot, modulePath), "utf8");
  const version = /const pdfjsVersion = "([^"]+)"/.exec(source)?.[1];
  const build = /const pdfjsBuild = "([^"]+)"/.exec(source)?.[1];
  if (!version || !build) throw new Error(`Missing PDF.js build identity in ${modulePath}`);
  versions.add(version);
  builds.add(build);
}
if (versions.size !== 1 || builds.size !== 1) {
  throw new Error("PDF.js viewer, display layer and worker were built from different source revisions");
}

const html = fs.readFileSync(path.join(assetRoot, "web", "viewer.html"), "utf8");
const viewer = fs.readFileSync(path.join(assetRoot, "web", "viewer.mjs"), "utf8");
if (!html.includes("../lyceum/index.mjs") ||
    !html.includes("../lyceum/lyceum-pdfjs.css") ||
    !fs.existsSync(path.join(assetRoot, "lyceum", "lyceum-messaging.mjs")) ||
    !fs.existsSync(path.join(assetRoot, "lyceum", "lyceum-core.mjs"))) {
  throw new Error("Lyceum PDF.js viewer overlay is incomplete");
}
if (!fs.readFileSync(path.join(assetRoot, "lyceum", "lyceum-core.mjs"), "utf8").includes("PDF_BRIDGE_VERSION")) {
  throw new Error("Lyceum PDF.js viewer overlay does not ship the generated shared core");
}
if (!viewer.includes('fileUrl.protocol === "lyceum-pdf:"') ||
    viewer.includes("parent.document.dispatchEvent(event)")) {
  throw new Error("Lyceum PDF.js source adaptations are missing from the built viewer");
}

console.log(`[verify-pdfjs] viewer, display and worker agree: ${[...versions][0]} / ${[...builds][0]}`);
