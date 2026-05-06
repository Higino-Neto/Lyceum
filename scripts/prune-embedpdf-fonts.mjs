import { rm, readdir } from "node:fs/promises";
import { join } from "node:path";

const FONTS = [
  "fonts-arabic",
  "fonts-hebrew",
  "fonts-jp",
  "fonts-kr",
  "fonts-latin",
  "fonts-sc",
  "fonts-tc",
];

const EMBEDPDF_DIR = join("node_modules", "@embedpdf");

try {
  const entries = await readdir(EMBEDPDF_DIR, { withFileTypes: true });
  const dirs = new Set(entries.filter(e => e.isDirectory()).map(e => e.name));
  let removed = 0;
  for (const pkg of FONTS) {
    if (dirs.has(pkg)) {
      await rm(join(EMBEDPDF_DIR, pkg), { recursive: true, force: true });
      removed++;
    }
  }
  if (removed > 0) {
    console.log(`[postinstall] Removed ${removed} unused @embedpdf font packages (~144 MB freed)`);
  }
} catch {
  // node_modules/@embedpdf does not exist yet (fresh install), skip
}
