// Runs Lyceum from a frozen snapshot of a production build, without the Vite
// dev server or any file watcher. Code edits made while the app is open (for
// example by an agent) never reload or break the running instance.
//
//   npm run start:last   -> launch the last build that exists in dist/ + dist-electron/
//   npm run start:fresh  -> build the current code once, then launch it (no watcher)
//
// The snapshot lives in .lyceum-run/ and carries its own Electron-ABI copy of
// better-sqlite3, so the root node_modules binding (used by tests on the host
// Node.js ABI) is never swapped while the app is running.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { localBin, run } from "./native-runtime.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const snapshotDir = path.join(root, ".lyceum-run");
const fresh = process.argv.includes("--fresh");

const rootPackage = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const electronVersion = JSON.parse(
  readFileSync(path.join(root, "node_modules", "electron", "package.json"), "utf8"),
).version;

function buildCurrentCode() {
  console.log("[run-snapshot] Building the current code (no type checks)...");
  run(process.execPath, ["scripts/prepare-pdfjs.mjs"]);
  run(process.execPath, ["scripts/verify-pdfjs-assets.mjs"]);
  run(localBin("vite"), ["build"]);
}

function assertBuildExists() {
  const missing = ["dist/index.html", "dist-electron/main.js"]
    .filter((file) => !existsSync(path.join(root, file)));
  if (missing.length > 0) {
    throw new Error(
      `No previous build found (missing ${missing.join(", ")}). Run "npm run start:fresh" first.`,
    );
  }
}

function copySnapshot() {
  for (const folder of ["dist", "dist-electron"]) {
    rmSync(path.join(snapshotDir, folder), { recursive: true, force: true });
    cpSync(path.join(root, folder), path.join(snapshotDir, folder), { recursive: true });
  }
  rmSync(path.join(snapshotDir, "resources"), { recursive: true, force: true });
  cpSync(path.join(root, "resources", "icons"), path.join(snapshotDir, "resources", "icons"), {
    recursive: true,
  });
  // Same package name as the real app so the snapshot shares its userData
  // (library, settings, vocabulary) with `npm run dev`.
  writeFileSync(path.join(snapshotDir, "package.json"), `${JSON.stringify({
    name: rootPackage.name,
    version: rootPackage.version,
    type: rootPackage.type,
    main: rootPackage.main,
  }, null, 2)}\n`);
}

function ensureElectronSqlite() {
  const source = path.join(root, "node_modules", "better-sqlite3");
  const target = path.join(snapshotDir, "node_modules", "better-sqlite3");
  const marker = path.join(target, ".electron-version");
  const sourceVersion = JSON.parse(readFileSync(path.join(source, "package.json"), "utf8")).version;
  const expectedMarker = `${electronVersion}:${sourceVersion}:${process.platform}-${process.arch}`;
  if (existsSync(marker) && readFileSync(marker, "utf8") === expectedMarker) return;

  console.log("[run-snapshot] Preparing better-sqlite3 for the Electron ABI (first run only)...");
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  cpSync(path.join(source, "package.json"), path.join(target, "package.json"));
  cpSync(path.join(source, "lib"), path.join(target, "lib"), { recursive: true });
  run(localBin("prebuild-install"), [
    "--runtime", "electron",
    "--target", electronVersion,
    "--platform", process.platform,
    "--arch", process.arch,
    "--force",
  ], { cwd: target });
  writeFileSync(marker, expectedMarker);
}

if (fresh) buildCurrentCode();
assertBuildExists();
mkdirSync(snapshotDir, { recursive: true });
copySnapshot();
ensureElectronSqlite();

const env = { ...process.env };
delete env.VITE_DEV_SERVER_URL;
delete env.ELECTRON_RUN_AS_NODE;

console.log(`[run-snapshot] Launching ${fresh ? "fresh" : "last"} build from .lyceum-run/`);
const child = spawn(localBin("electron"), [snapshotDir], { cwd: root, stdio: "inherit", env });
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => { if (!child.killed) child.kill(signal); });
}
child.once("exit", (code) => { process.exitCode = code ?? 0; });
