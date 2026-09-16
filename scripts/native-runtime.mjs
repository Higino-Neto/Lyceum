import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const betterSqliteBinary = path.join(
  root,
  "node_modules",
  "better-sqlite3",
  "build",
  "Release",
  "better_sqlite3.node",
);

function commandPath(name) {
  return path.join(root, "node_modules", ".bin", process.platform === "win32" ? `${name}.cmd` : name);
}

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${path.basename(command)} exited with status ${result.status}`);
  }
}

function nodeBindingWorks() {
  const result = spawnSync(process.execPath, [
    "-e",
    "const Database=require('better-sqlite3');const db=new Database(':memory:');db.close()",
  ], { cwd: root, stdio: "ignore" });
  return result.status === 0;
}

export function ensureNodeNative() {
  if (nodeBindingWorks()) return;
  console.log("[native-runtime] Rebuilding better-sqlite3 for the host Node.js ABI...");
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  run(npm, ["rebuild", "better-sqlite3"]);
  if (!nodeBindingWorks()) throw new Error("better-sqlite3 still cannot load in Node.js after rebuild");
}

export function rebuildForElectron() {
  console.log("[native-runtime] Installing better-sqlite3 for the Electron ABI...");
  const arch = process.arch === "x64" || process.arch === "arm64" || process.arch === "ia32"
    ? process.arch
    : "x64";
  const electronVersion = JSON.parse(
    readFileSync(path.join(root, "node_modules", "electron", "package.json"), "utf8"),
  ).version;
  const configuredCache = process.env.npm_config_cache || process.env.NPM_CONFIG_CACHE;
  run(commandPath("prebuild-install"), [
    "--runtime", "electron",
    "--target", electronVersion,
    "--platform", process.platform,
    "--arch", arch,
    "--force",
  ], {
    cwd: path.join(root, "node_modules", "better-sqlite3"),
    env: {
      ...process.env,
      ...(configuredCache ? { npm_config_cache: configuredCache } : {}),
    },
  });
}

export function backupNodeBinding(target) {
  if (!existsSync(betterSqliteBinary)) throw new Error(`Missing native binding: ${betterSqliteBinary}`);
  mkdirSync(path.dirname(target), { recursive: true });
  copyFileSync(betterSqliteBinary, target);
}

export function restoreNodeBinding(source) {
  if (!existsSync(source)) return;
  mkdirSync(path.dirname(betterSqliteBinary), { recursive: true });
  copyFileSync(source, betterSqliteBinary);
  console.log("[native-runtime] Restored better-sqlite3 for Node.js tests and tooling.");
}

export function localBin(name) {
  return commandPath(name);
}
