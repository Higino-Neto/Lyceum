import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const version = process.env.MOBILE_RELEASE_VERSION || packageJson.version;
const appId = "com.higino.lyceum.mobile";
const artifactDir = path.join(root, "release-mobile");
const zipName = `lyceum-mobile-ota-${version}.zip`;
const manifestName = "lyceum-mobile-ota.json";
const zipPath = path.join(artifactDir, zipName);
const manifestPath = path.join(artifactDir, manifestName);

mkdirSync(artifactDir, { recursive: true });

const capgoBin = path.join(root, "node_modules", "@capgo", "cli", "dist", "index.js");

const output = execFileSync(
  process.execPath,
  [
    capgoBin,
    "bundle",
    "zip",
    appId,
    "--path",
    "dist-mobile",
    "--bundle",
    version,
    "--name",
    zipName,
    "--json",
  ],
  { cwd: root, encoding: "utf8" },
);

const jsonStart = output.indexOf("{");
const jsonEnd = output.lastIndexOf("}");
if (jsonStart < 0 || jsonEnd < jsonStart) {
  throw new Error(`Could not parse Capgo CLI output:\n${output}`);
}

const result = JSON.parse(output.slice(jsonStart, jsonEnd + 1));
const generatedPath = path.resolve(root, result.path || zipName);
if (generatedPath !== zipPath) {
  try {
    renameSync(generatedPath, zipPath);
  } catch {
    copyFileSync(generatedPath, zipPath);
  }
}

const releaseBaseUrl = `https://github.com/higino-neto/lyceum/releases/download/mobile-v${version}`;
const manifest = {
  version,
  url: `${releaseBaseUrl}/${zipName}`,
  checksum: result.checksum,
  size: result.size,
  notes: `Lyceum Mobile ${version}`,
};

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ ...manifest, zipPath, manifestPath }, null, 2));
