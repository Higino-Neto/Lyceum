import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const version = process.env.MOBILE_RELEASE_VERSION || packageJson.version;
const versionCode = Number.parseInt(process.env.MOBILE_VERSION_CODE || "", 10);

if (!Number.isFinite(versionCode) || versionCode <= 0) {
  throw new Error("MOBILE_VERSION_CODE must be a positive integer");
}

const artifactDir = path.join(root, "release-mobile");
const apkName = `lyceum-mobile-${version}.apk`;
const apkPath = path.join(artifactDir, "android", apkName);
const manifestPath = path.join(artifactDir, "lyceum-mobile-latest.json");
const releaseBaseUrl = `https://github.com/Higino-Neto/Lyceum/releases/download/mobile-v${version}`;
const apkBytes = readFileSync(apkPath);
const sha256 = createHash("sha256").update(apkBytes).digest("hex");
const sizeBytes = statSync(apkPath).size;

mkdirSync(artifactDir, { recursive: true });

const manifest = {
  version,
  versionCode,
  apkUrl: `${releaseBaseUrl}/${apkName}`,
  sha256,
  sizeBytes,
  notes: `Lyceum Mobile ${version}`,
  publishedAt: new Date().toISOString(),
  minSdk: 24,
  mandatory: false,
};

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ ...manifest, apkPath, manifestPath }, null, 2));
