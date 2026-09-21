import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export function readProductVersion() {
  const packageJson = JSON.parse(readFileSync(path.join(rootDir, "package.json"), "utf8"));
  if (typeof packageJson.version !== "string") throw new Error("package.json does not declare a version");
  return packageJson.version;
}

export function assertStableVersion(version) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(version);
  if (!match) throw new Error(`Release version must be stable SemVer (X.Y.Z), received: ${version}`);
  const parts = match.slice(1).map(Number);
  if (parts[1] > 999 || parts[2] > 999) {
    throw new Error("Android versionCode supports minor and patch values from 0 through 999");
  }
  return parts;
}

export function androidVersionCode(version) {
  const [major, minor, patch] = assertStableVersion(version);
  const code = major * 1_000_000 + minor * 1_000 + patch;
  if (!Number.isSafeInteger(code) || code <= 0 || code > 2_100_000_000) {
    throw new Error(`Version ${version} cannot be represented by an Android versionCode`);
  }
  return code;
}

export function expectedArtifacts(version) {
  return [
    `Lyceum-${version}-Windows-x64-Setup.exe`,
    `Lyceum-${version}-Windows-arm64-Setup.exe`,
    `Lyceum-${version}-Windows-Legacy-x64-Setup.exe`,
    `Lyceum-${version}-Linux-x86_64.AppImage`,
    `Lyceum-${version}-Linux-x86_64.deb`,
    `Lyceum-${version}-Linux-x86_64.rpm`,
    `Lyceum-${version}-macOS-universal.dmg`,
    `Lyceum-${version}-Android-arm64.apk`,
    `Lyceum-${version}-Android-universal.apk`,
    `Lyceum-${version}-Android-OTA.zip`,
    "latest.yml",
    "latest-arm64.yml",
    "latest-linux.yml",
    "latest-mac.yml",
    "lyceum-mobile-latest.json",
    "lyceum-mobile-ota.json",
  ];
}
