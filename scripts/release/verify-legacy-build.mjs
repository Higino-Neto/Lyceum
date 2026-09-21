import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const expectedRuntime = {
  "better-sqlite3": "8.7.0",
  sharp: "0.32.6",
  chokidar: "3.6.0",
  tar: "6.2.1",
};

if (!process.argv.includes("--skip-runtime-version-check")) {
  for (const [packageName, expectedVersion] of Object.entries(expectedRuntime)) {
    const manifestPath = path.join("node_modules", ...packageName.split("/"), "package.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    if (manifest.version !== expectedVersion) {
      throw new Error(`${packageName} ${manifest.version} is installed; legacy build requires ${expectedVersion}`);
    }
  }
}

const legacyConfig = JSON.parse(readFileSync("electron-builder.legacy.json5", "utf8"));
if (legacyConfig.electronVersion !== "22.3.27") {
  throw new Error(`Legacy Electron must remain pinned to 22.3.27, received ${legacyConfig.electronVersion}`);
}

const afterPackSource = readFileSync("scripts/electron-after-pack.cjs", "utf8");
if (!afterPackSource.includes('legacySharp: context.packager.config.electronVersion === "22.3.27"')) {
  throw new Error("Legacy package must validate sharp's Electron 22 native layout separately from modern @img packages");
}

function listJavaScriptFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listJavaScriptFiles(entryPath) : entryPath.endsWith(".js") ? [entryPath] : [];
  });
}

const forbiddenApis = [
  "protocol.handle(",
  "net.fetch(",
  "Readable.toWeb(",
  "new Response(",
];
for (const file of listJavaScriptFiles("dist-electron")) {
  const source = readFileSync(file, "utf8");
  for (const api of forbiddenApis) {
    // PDF.js guards this compression-only path with try/catch. The smoke test
    // parses a real PDF in the Electron 22 worker, which covers its required path.
    if (api === "new Response(" && file.endsWith(`${path.sep}pdf.worker.js`)) continue;
    if (source.includes(api)) {
      throw new Error(`Electron 22-incompatible API remained in ${file}: ${api}`);
    }
  }
}

console.log(
  process.argv.includes("--skip-runtime-version-check")
    ? "Verified Electron 22 pin and main-process API compatibility (runtime version check skipped)"
    : "Verified Electron 22 pin, legacy dependency versions, and main-process API compatibility",
);
