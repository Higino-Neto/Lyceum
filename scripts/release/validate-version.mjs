import { appendFileSync } from "node:fs";
import { androidVersionCode, assertStableVersion, readProductVersion } from "./release-config.mjs";

const tag = process.argv[2] || process.env.RELEASE_TAG || process.env.GITHUB_REF_NAME || "";
if (!/^v\d+\.\d+\.\d+$/.test(tag)) {
  throw new Error(`Release tag must use vX.Y.Z, received: ${tag || "<empty>"}`);
}

const version = readProductVersion();
assertStableVersion(version);
if (tag !== `v${version}`) {
  throw new Error(`Tag ${tag} does not match package.json version ${version}`);
}

const versionCode = androidVersionCode(version);
const githubOutput = process.env.GITHUB_OUTPUT;
if (githubOutput) {
  appendFileSync(githubOutput, `version=${version}\ntag=${tag}\nandroid_version_code=${versionCode}\n`);
}
console.log(`Validated Lyceum ${version} (${tag}); Android versionCode=${versionCode}`);
