import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const asar = require("@electron/asar");
const root = process.cwd();

function formatMb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function sizeOf(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return 0;
  }

  const stat = fs.statSync(targetPath);
  if (!stat.isDirectory()) {
    return stat.size;
  }

  let total = 0;
  for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
    total += sizeOf(path.join(targetPath, entry.name));
  }

  return total;
}

function latestInstaller() {
  const releaseDir = path.join(root, "release");
  if (!fs.existsSync(releaseDir)) {
    return null;
  }

  const installers = fs
    .readdirSync(releaseDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(exe|dmg|AppImage)$/i.test(entry.name))
    .map((entry) => {
      const fullPath = path.join(releaseDir, entry.name);
      const stat = fs.statSync(fullPath);
      return { fullPath, stat };
    })
    .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);

  return installers[0] ?? null;
}

function topDirectories(targetPath, limit = 12) {
  if (!fs.existsSync(targetPath)) {
    return [];
  }

  return fs
    .readdirSync(targetPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const fullPath = path.join(targetPath, entry.name);
      return { name: entry.name, bytes: sizeOf(fullPath) };
    })
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, limit);
}

function summarizeAsar(archivePath) {
  if (!fs.existsSync(archivePath)) {
    return null;
  }

  const entries = asar.listPackage(archivePath);
  const packageCounts = new Map();
  let sourceMaps = 0;

  for (const entry of entries) {
    if (entry.endsWith(".map")) {
      sourceMaps += 1;
    }

    const normalized = entry.replaceAll("\\", "/");
    if (normalized.startsWith("/node_modules/")) {
      const [, , scopeOrName, packageName] = normalized.split("/");
      const name = scopeOrName?.startsWith("@")
        ? `${scopeOrName}/${packageName ?? ""}`
        : scopeOrName;
      if (name) {
        packageCounts.set(name, (packageCounts.get(name) ?? 0) + 1);
      }
    }
  }

  const topPackages = [...packageCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  return { entries: entries.length, sourceMaps, topPackages };
}

const winUnpacked = path.join(root, "release", "win-unpacked");
const resources = path.join(winUnpacked, "resources");
const appAsar = path.join(resources, "app.asar");
const unpacked = path.join(resources, "app.asar.unpacked");
const locales = path.join(winUnpacked, "locales");
const installer = latestInstaller();
const appAsarSummary = summarizeAsar(appAsar);

console.log("Lyceum package size audit");
console.log("=========================");
console.log(`win-unpacked: ${formatMb(sizeOf(winUnpacked))}`);
console.log(`app.asar: ${formatMb(sizeOf(appAsar))}`);
console.log(`app.asar.unpacked: ${formatMb(sizeOf(unpacked))}`);
console.log(`locales: ${formatMb(sizeOf(locales))}`);
if (installer) {
  console.log(`latest installer: ${formatMb(installer.stat.size)} ${path.basename(installer.fullPath)}`);
}

if (appAsarSummary) {
  console.log("");
  console.log(`app.asar entries: ${appAsarSummary.entries}`);
  console.log(`app.asar source maps: ${appAsarSummary.sourceMaps}`);
  console.log("top app.asar packages by file count:");
  for (const item of appAsarSummary.topPackages) {
    console.log(`  ${item.name}: ${item.count}`);
  }
}

const unpackedPackages = topDirectories(path.join(unpacked, "node_modules"));
if (unpackedPackages.length > 0) {
  console.log("");
  console.log("top unpacked packages:");
  for (const item of unpackedPackages) {
    console.log(`  ${item.name}: ${formatMb(item.bytes)}`);
  }
}
