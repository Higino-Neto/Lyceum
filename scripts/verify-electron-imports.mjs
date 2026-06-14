import fs from "node:fs";
import path from "node:path";

const root = path.resolve("dist-electron");
const importPattern = /\b(?:import|export)\s+(?:[^"'()]*?\s+from\s+)?["'](\.{1,2}\/[^"']+)["']|import\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/g;
const extensions = ["", ".js", ".mjs", ".cjs", ".json"];
const missing = [];

function filesIn(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? filesIn(fullPath) : [fullPath];
  });
}

function resolveImport(fromFile, specifier) {
  const base = path.resolve(path.dirname(fromFile), specifier);
  for (const extension of extensions) {
    const candidate = `${base}${extension}`;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  if (fs.existsSync(base) && fs.statSync(base).isDirectory()) {
    for (const extension of extensions.slice(1)) {
      const candidate = path.join(base, `index${extension}`);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
    }
  }
  return null;
}

if (!fs.existsSync(root)) {
  throw new Error("dist-electron nao existe; rode o build Electron antes da verificacao.");
}

const files = filesIn(root).filter((file) => /\.(?:m?js|cjs)$/.test(file));
if (files.length === 0) {
  throw new Error("dist-electron nao contem arquivos JavaScript.");
}

for (const file of files) {
  const source = fs.readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n\r]*/g, "");
  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1] || match[2];
    if (!resolveImport(file, specifier)) {
      missing.push(`${path.relative(root, file)} -> ${specifier}`);
    }
  }
}

if (missing.length > 0) {
  throw new Error(`Imports relativos quebrados no dist-electron:\n${missing.join("\n")}`);
}

console.log(`dist-electron import check passed (${files.length} JS files).`);
