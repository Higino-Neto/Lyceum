import fs from "node:fs";
import { builtinModules } from "node:module";
import path from "node:path";

const root = path.resolve("dist-electron");
const importPattern = /\b(?:import|export)\s+(?:[^"'()]*?\s+from\s+)?["'](\.{1,2}\/[^"']+)["']|import\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/g;
const bareImportPattern = /\b(?:import|export)\s+(?:[^"'()]*?\s+from\s+)?["']([^."'/][^"']*)["']|import\(\s*["']([^."'/][^"']*)["']\s*\)|\brequire\(\s*["']([^."'/][^"']*)["']\s*\)/g;
const extensions = ["", ".js", ".mjs", ".cjs", ".json"];
const missing = [];
const runtimeMissing = [];
const runtimeDevOnly = [];
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const packageLock = fs.existsSync("package-lock.json")
  ? JSON.parse(fs.readFileSync("package-lock.json", "utf8"))
  : { packages: {} };
const builtinNames = new Set([
  ...builtinModules,
  ...builtinModules.map((name) => `node:${name}`),
]);
const electronRuntimeModules = new Set(["electron"]);

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

function packageNameFor(specifier) {
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? `${parts[0]}/${parts[1]}` : parts[0];
}

function verifyRuntimePackage(fromFile, specifier) {
  if (!specifier || /[$<>{}\s]/.test(specifier)) {
    return;
  }

  if (specifier.startsWith("node:") || builtinNames.has(specifier) || electronRuntimeModules.has(specifier)) {
    return;
  }

  const packageName = packageNameFor(specifier);
  const packageEntry = packageLock.packages?.[`node_modules/${packageName}`];
  const directRuntimeDependency = Boolean(packageJson.dependencies?.[packageName]);

  if (!packageEntry && !directRuntimeDependency) {
    runtimeMissing.push(`${path.relative(root, fromFile)} -> ${specifier}`);
    return;
  }

  if (packageEntry?.dev === true && !directRuntimeDependency) {
    runtimeDevOnly.push(`${path.relative(root, fromFile)} -> ${specifier}`);
  }
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
  for (const match of source.matchAll(bareImportPattern)) {
    const specifier = match[1] || match[2] || match[3];
    verifyRuntimePackage(file, specifier);
  }
}

if (missing.length > 0) {
  throw new Error(`Imports relativos quebrados no dist-electron:\n${missing.join("\n")}`);
}

if (runtimeMissing.length > 0) {
  throw new Error(`Imports externos sem pacote de runtime no Electron:\n${runtimeMissing.join("\n")}`);
}

if (runtimeDevOnly.length > 0) {
  throw new Error(`Imports externos do Electron resolvem apenas como devDependency:\n${runtimeDevOnly.join("\n")}`);
}

console.log(`dist-electron import check passed (${files.length} JS files, runtime externals verified).`);
