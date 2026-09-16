import { constants, copyFileSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";

const sourceDir = path.resolve(process.argv[2] || "downloaded-artifacts");
const targetDir = path.resolve(process.argv[3] || "release-assets");
mkdirSync(targetDir, { recursive: true });

function copyTree(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const source = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      copyTree(source);
      continue;
    }
    const target = path.join(targetDir, entry.name);
    try {
      copyFileSync(source, target, constants.COPYFILE_EXCL);
    } catch (error) {
      throw new Error(`Duplicate artifact filename while flattening: ${entry.name}`, { cause: error });
    }
  }
}

copyTree(sourceDir);
console.log(`Collected release assets in ${targetDir}`);
