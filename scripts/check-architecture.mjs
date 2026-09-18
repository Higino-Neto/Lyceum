import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function walk(relativeDirectory) {
  const absoluteDirectory = path.join(root, relativeDirectory);
  if (!fs.existsSync(absoluteDirectory)) return [];
  return fs.readdirSync(absoluteDirectory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(relativeDirectory, entry.name);
    return entry.isDirectory() ? walk(relativePath) : [relativePath];
  });
}

const sourceFiles = walk("src").filter((file) => /\.(ts|tsx)$/.test(file));
for (const file of sourceFiles) {
  const contents = read(file);
  if (/from\s+["']electron["']|require\(["']electron["']\)/.test(contents)) {
    failures.push(`${file}: renderer code must not import Electron directly`);
  }
}

for (const file of walk("src/core").filter((entry) => /\.(ts|tsx)$/.test(entry))) {
  const contents = read(file);
  if (/from\s+["'](?:react|electron|@supabase\/|@capacitor\/)/.test(contents)) {
    failures.push(`${file}: core modules must remain framework-independent`);
  }
}

for (const file of walk("src/features").filter((entry) => /\.(ts|tsx)$/.test(entry))) {
  const contents = read(file);
  if (/from\s+["'][^"']*pages\//.test(contents)) {
    failures.push(`${file}: feature modules must not depend on page components`);
  }
}

const preload = read("electron/preload.ts");
const envDeclaration = read("electron/electron-env.d.ts");
if (!preload.includes("export type LyceumApi = typeof api")) {
  failures.push("electron/preload.ts: Window.api must be derived from the bridge implementation");
}
if (!envDeclaration.includes('import("./preload").LyceumApi')) {
  failures.push("electron/electron-env.d.ts: use the preload contract instead of a handwritten copy");
}
if (/\[key:\s*string\]\s*:\s*any/.test(envDeclaration + read("src/types/api.d.ts"))) {
  failures.push("Window.api must not contain an any-valued index signature");
}

const handlerChannels = new Set(
  walk("electron")
    .filter((file) => file.endsWith(".ts"))
    .flatMap((file) => [...read(file).matchAll(/ipcMain\.handle\(\s*["'`]([^"'`]+)/g)])
    .map((match) => match[1]),
);
const invokedChannels = new Set(
  [...preload.matchAll(/(?:ipcRenderer\.invoke|\binvoke(?:<[^>]+>)?)\(\s*["'`]([^"'`]+)/g)]
    .map((match) => match[1]),
);
for (const channel of invokedChannels) {
  if (!handlerChannels.has(channel)) {
    failures.push(`IPC channel ${channel} is exposed by preload but has no handler`);
  }
}

if (failures.length > 0) {
  console.error("Architecture checks failed:\n" + failures.map((failure) => `- ${failure}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Architecture checks passed (${handlerChannels.size} handlers, ${invokedChannels.size} invokes).`);
}
