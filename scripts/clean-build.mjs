import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const targets = ["dist", "dist-electron"];

for (const target of targets) {
  const targetPath = path.join(root, target);
  fs.rmSync(targetPath, { force: true, recursive: true });
  console.log(`removed ${target}`);
}
