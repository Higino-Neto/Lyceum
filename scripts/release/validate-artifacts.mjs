import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { assertStableVersion, expectedArtifacts, readProductVersion } from "./release-config.mjs";

const artifactDir = path.resolve(process.argv[2] || "release-assets");
const version = process.argv[3] || readProductVersion();
assertStableVersion(version);

function listFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
  });
}

const files = listFiles(artifactDir);
const byName = new Map();
for (const file of files) {
  const name = path.basename(file);
  if (byName.has(name)) throw new Error(`Duplicate artifact filename: ${name}`);
  if (statSync(file).size <= 0) throw new Error(`Artifact is empty: ${name}`);
  byName.set(name, file);
}

for (const name of expectedArtifacts(version)) {
  if (!byName.has(name)) throw new Error(`Required release artifact is missing: ${name}`);
}

const distributable = /\.(?:exe|dmg|AppImage|deb|rpm|apk|zip)$/;
for (const name of byName.keys()) {
  if (distributable.test(name) && !name.includes(version)) {
    throw new Error(`Distributable does not contain release version ${version}: ${name}`);
  }
  const foreignVersion = name.match(/Lyceum-(\d+\.\d+\.\d+)-/i)?.[1];
  if (foreignVersion && foreignVersion !== version) {
    throw new Error(`Artifact belongs to version ${foreignVersion}, expected ${version}: ${name}`);
  }
}

for (const manifestName of ["lyceum-mobile-latest.json", "lyceum-mobile-ota.json"]) {
  const manifest = JSON.parse(readFileSync(byName.get(manifestName), "utf8"));
  if (manifest.version !== version) {
    throw new Error(`${manifestName} declares ${manifest.version}, expected ${version}`);
  }
}

for (const [metadataName, packageName] of [
  ["latest.yml", `Lyceum-${version}-Windows-x64-Setup.exe`],
  ["latest-arm64.yml", `Lyceum-${version}-Windows-arm64-Setup.exe`],
  ["latest-linux.yml", `Lyceum-${version}-Linux-x86_64.AppImage`],
  ["latest-mac.yml", `Lyceum-${version}-macOS-universal.zip`],
]) {
  const metadata = readFileSync(byName.get(metadataName), "utf8");
  if (!metadata.includes(packageName)) {
    throw new Error(`${metadataName} does not point to ${packageName}`);
  }
}

console.log(`Validated ${files.length} unique, non-empty release files for Lyceum ${version}`);
