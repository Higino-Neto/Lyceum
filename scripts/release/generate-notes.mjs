import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { assertStableVersion, readProductVersion } from "./release-config.mjs";

const version = process.argv[2] || readProductVersion();
const outputPath = path.resolve(process.argv[3] || "release-notes.md");
const changelogPath = process.argv[4];
assertStableVersion(version);

const changelog = changelogPath
  ? readFileSync(path.resolve(changelogPath), "utf8").trim()
  : "See the automatically generated GitHub changelog for this version.";

const notes = `# Lyceum ${version}

## What's new

${changelog}

## Downloads

### Windows 10/11

| File | Architecture |
|---|---|
| \`Lyceum-${version}-Windows-x64-Setup.exe\` | x64 |
| \`Lyceum-${version}-Windows-arm64-Setup.exe\` | ARM64 |

### Windows 7/8/8.1 — Legacy

| File | Architecture |
|---|---|
| \`Lyceum-${version}-Windows-Legacy-x64-Setup.exe\` | x64 |

> The Legacy build uses Electron 22 for compatibility with older Windows versions. This runtime is end-of-life upstream and does not receive current Electron/Chromium security fixes. Automatic updates are disabled for this build to prevent it from installing the incompatible modern package.

### Linux

| File | Recommended for |
|---|---|
| \`Lyceum-${version}-Linux-x86_64.AppImage\` | Generic Linux distributions |
| \`Lyceum-${version}-Linux-x86_64.deb\` | Debian, Ubuntu and derivatives |
| \`Lyceum-${version}-Linux-x86_64.rpm\` | Fedora, RHEL and derivatives |

### macOS

| File | Architecture |
|---|---|
| \`Lyceum-${version}-macOS-universal.dmg\` | Intel and Apple silicon |

### Android

| File | Architecture |
|---|---|
| \`Lyceum-${version}-Android-arm64.apk\` | ARM64 |
| \`Lyceum-${version}-Android-universal.apk\` | Universal |

Verify downloaded files against \`SHA256SUMS.txt\`.

## System requirements

- Windows 10/11 for the recommended desktop build.
- Windows 7/8/8.1 for the compatibility-limited Legacy build.
- A 64-bit x86 Linux distribution for the Linux packages.
- macOS on Intel or Apple silicon for the universal desktop package.
- Android 7.0 (API 24) or newer for Android.
`;

writeFileSync(outputPath, notes);
console.log(`Wrote release notes to ${outputPath}`);
