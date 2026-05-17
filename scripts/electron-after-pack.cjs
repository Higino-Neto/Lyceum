const fs = require("node:fs");
const path = require("node:path");

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
      path.join(unpackedNodeModules, "pdf-poppler", "lib", "osx"),
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
};
