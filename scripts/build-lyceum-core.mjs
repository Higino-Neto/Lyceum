// Bundles the pure, testable PDF.js core (src/core/pdf-reader-core) into an ESM
// file the iframe overlay can import at runtime, so the desktop viewer and the
// React host share exactly one implementation of the protocol and the geometry /
// text-model logic. The output is committed so the vendored viewer build stays
// self-contained and import graphs are resolvable even before a build runs.
import esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const entry = path.join(rootDir, "src", "core", "pdf-reader-core", "index.ts");
const outfile = path.join(rootDir, "resources", "pdfjs-viewer", "lyceum-core.mjs");

if (!fs.existsSync(entry)) {
  throw new Error(`PDF.js core entry not found: ${entry}`);
}

await esbuild.build({
  entryPoints: [entry],
  outfile,
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2022",
  legalComments: "none",
  logLevel: "silent",
  banner: {
    js: "// GENERATED FILE - do not edit. Built by scripts/build-lyceum-core.mjs from src/core/pdf-reader-core.",
  },
});

const relativeTarget = path.relative(rootDir, outfile);
console.log(`[build-lyceum-core] ${path.relative(rootDir, entry)} -> ${relativeTarget}`);