const fs = require("node:fs");
const path = require("node:path");
const asar = require("@electron/asar");

const KEEP_LOCALES = new Set(["pt-BR.pak", "en-US.pak"]);

function removePath(targetPath) {
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { force: true, recursive: true });
    return true;
  }

  return false;
}

function removeMaps(targetDir) {
  if (!fs.existsSync(targetDir)) {
    return 0;
  }

  let removed = 0;
  for (const entry of fs.readdirSync(targetDir, { withFileTypes: true })) {
    const entryPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      removed += removeMaps(entryPath);
    } else if (entry.name.endsWith(".map")) {
      fs.rmSync(entryPath, { force: true });
      removed += 1;
    }
  }

  return removed;
}

function listFilesRecursive(targetDir) {
  if (!fs.existsSync(targetDir)) return [];
  const files = [];
  for (const entry of fs.readdirSync(targetDir, { withFileTypes: true })) {
    const entryPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) files.push(...listFilesRecursive(entryPath));
    else files.push(entryPath);
  }
  return files;
}

function verifyPackagedRuntime(appOutDir) {
  const resourcesDir = path.join(appOutDir, "resources");
  const asarPath = path.join(resourcesDir, "app.asar");
  if (!fs.existsSync(asarPath)) throw new Error(`[afterPack] app.asar is missing: ${asarPath}`);

  const archiveFiles = new Set(
    asar.listPackage(asarPath).map((file) => file.replace(/\\/g, "/").replace(/^\/+/, "")),
  );
  const workerEntry = "dist-electron/workers/processing.worker.js";
  if (!archiveFiles.has(workerEntry)) {
    throw new Error(`[afterPack] processing worker is missing from app.asar: ${workerEntry}`);
  }

  const workerSource = asar.extractFile(asarPath, path.join(...workerEntry.split("/"))).toString("utf8");
  const chunkImports = [...workerSource.matchAll(/(?:from\s+|import\()["']\.\.\/chunks\/([^"']+)["']/g)]
    .map((match) => `dist-electron/chunks/${match[1]}`);
  for (const importedChunk of chunkImports) {
    if (!archiveFiles.has(importedChunk)) {
      throw new Error(`[afterPack] worker dependency is missing from app.asar: ${importedChunk}`);
    }
  }

  const unpackedModules = path.join(resourcesDir, "app.asar.unpacked", "node_modules");
  const nativeFiles = listFilesRecursive(unpackedModules).filter((file) => file.endsWith(".node"));
  const requiredNativeFamilies = ["better-sqlite3", `${path.sep}@img${path.sep}`, `${path.sep}@napi-rs${path.sep}`];
  for (const family of requiredNativeFamilies) {
    if (!nativeFiles.some((file) => file.includes(family))) {
      throw new Error(`[afterPack] unpacked native runtime is missing for ${family}`);
    }
  }

  console.log(`[afterPack] verified worker bundle and ${nativeFiles.length} unpacked native module(s)`);
}

exports.default = async function afterPack(context) {
  const appOutDir = context.appOutDir;
  const platform = context.electronPlatformName;
  const removed = [];

  const localeDir = path.join(appOutDir, "locales");
  if (fs.existsSync(localeDir)) {
    for (const fileName of fs.readdirSync(localeDir)) {
      if (!KEEP_LOCALES.has(fileName) && removePath(path.join(localeDir, fileName))) {
        removed.push(`locales/${fileName}`);
      }
    }
  }

  const unpackedNodeModules = path.join(
    appOutDir,
    "resources",
    "app.asar.unpacked",
    "node_modules",
  );

  if (platform === "win32") {
    const winOnlyPrunes = [
      path.join(unpackedNodeModules, "better-sqlite3", "deps"),
      path.join(unpackedNodeModules, "better-sqlite3", "src"),
      path.join(unpackedNodeModules, "sharp", "src"),
      path.join(unpackedNodeModules, "sharp", "install"),
    ];

    for (const targetPath of winOnlyPrunes) {
      if (removePath(targetPath)) {
        removed.push(path.relative(appOutDir, targetPath));
      }
    }
  }

  const mapCount = removeMaps(path.join(appOutDir, "resources", "app.asar.unpacked"));
  if (mapCount > 0) {
    removed.push(`${mapCount} unpacked source maps`);
  }

  if (removed.length > 0) {
    console.log(`[afterPack] pruned ${removed.length} packaging artifact(s)`);
  }

  verifyPackagedRuntime(appOutDir);
};
