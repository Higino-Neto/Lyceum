import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const artifactDir = path.resolve(process.argv[2] || "release-assets");
const outputPath = path.join(artifactDir, "SHA256SUMS.txt");
const files = readdirSync(artifactDir, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name !== "SHA256SUMS.txt")
  .map((entry) => entry.name)
  .sort((left, right) => left.localeCompare(right));

const lines = files.map((name) => {
  const digest = createHash("sha256").update(readFileSync(path.join(artifactDir, name))).digest("hex");
  return `${digest}  ${name}`;
});
writeFileSync(outputPath, `${lines.join("\n")}\n`);
console.log(`Wrote ${files.length} checksums to ${outputPath}`);
