/* global Buffer, process */
// Static regression checks for the semantic design-token system.
//
// Run with `node scripts/check-design-tokens.mjs`. The checks are intentionally
// source-based: they catch drift between the TypeScript token source, the
// Tailwind mapping, the pre-paint fallbacks, the isolated PDF viewer and the
// temporary legacy compatibility layer without booting a browser.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Every user-visible source module must consume semantic utilities. The scan
// skips tests and the theme implementation itself (which defines the tokens and
// the legacy accent bridge), but it intentionally covers mobile, Electron-facing
// renderer code, isolated readers, and every page/component.
const SOURCE_ROOT = "src";
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);
const SOURCE_EXCLUDED_PREFIXES = ["src/test/", "src/theme/"];

// Palette families that the legacy compatibility layer still remaps. Fully
// migrated files must not introduce new uses of any of them; status colors
// belong behind semantic utilities such as text-destructive or text-info.
const PALETTE_FAMILY =
  "zinc|green|yellow|amber|orange|red|rose|pink|fuchsia|purple|violet|indigo|blue|sky|cyan|teal|emerald|lime|slate|gray|neutral|stone";
const CLASS_PREFIX =
  "bg|text|border|from|via|to|ring|ring-offset|outline|fill|stroke|shadow|divide|placeholder|decoration|accent|caret";

const LEGACY_COLOR_CLASS = new RegExp(
  `\\b(?:${CLASS_PREFIX})-(?:${PALETTE_FAMILY})-\\d{2,3}(?:/\\d+)?\\b`,
);
const LEGACY_SELECTOR = new RegExp(
  `\\.(?:${CLASS_PREFIX})-(?:${PALETTE_FAMILY})-\\d{2,3}(?:/\\d+)?`,
);

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

async function loadTokenModule() {
  const result = await esbuild.build({
    entryPoints: [path.join(rootDir, "src/theme/tokens.ts")],
    bundle: true,
    write: false,
    format: "esm",
    platform: "neutral",
    target: "es2022",
    logLevel: "silent",
  });
  const code = result.outputFiles?.[0]?.text;
  if (!code) {
    throw new Error("Could not bundle src/theme/tokens.ts for inspection.");
  }
  const dataUrl = `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
  return import(dataUrl);
}

function extractBlock(source, startMarker, endMarker, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker);
  if (start === -1 || end === -1 || end <= start) {
    return { error: `${label}: expected "${startMarker}" before "${endMarker}".` };
  }
  if (source.indexOf(startMarker, start + startMarker.length) !== -1) {
    return { error: `${label}: duplicate "${startMarker}" marker.` };
  }
  if (source.indexOf(endMarker, end + endMarker.length) !== -1) {
    return { error: `${label}: duplicate "${endMarker}" marker.` };
  }
  return {
    before: source.slice(0, start),
    block: source.slice(start, end + endMarker.length),
    after: source.slice(end + endMarker.length),
  };
}

function checkTokens(tokens, errors) {
  const names = tokens.SEMANTIC_TOKEN_NAMES;
  if (!Array.isArray(names) || names.length === 0) {
    errors.push("src/theme/tokens.ts must export a non-empty SEMANTIC_TOKEN_NAMES.");
    return;
  }

  for (const [theme, values] of [
    ["dark", tokens.DARK_TOKENS],
    ["light", tokens.LIGHT_TOKENS],
  ]) {
    for (const name of names) {
      const value = values?.[name];
      if (typeof value !== "string" || value.trim() === "") {
        errors.push(`Missing ${theme} token value for "--${name}".`);
      }
    }
  }

  if (tokens.DARK_TOKENS?.background !== "#09090b") {
    errors.push(`Unexpected dark background token: ${tokens.DARK_TOKENS?.background}`);
  }
  if (tokens.LIGHT_TOKENS?.background !== "#eef0f3") {
    errors.push(`Unexpected light background token: ${tokens.LIGHT_TOKENS?.background}`);
  }
}

function checkTailwindMapping(css, names, errors) {
  const match = css.match(/@theme\s+inline\s*\{([\s\S]*?)\n\}/);
  if (!match) {
    errors.push("src/index.css must contain an @theme inline block.");
    return;
  }

  const block = match[1];
  for (const name of names) {
    const expected = `--color-${name}: var(--${name});`;
    if (!block.includes(expected)) {
      errors.push(`src/index.css @theme inline is missing "${expected}".`);
    }
  }

  const mapped = [...block.matchAll(/--color-([a-z][a-z0-9-]*)\s*:/g)].map(
    (entry) => entry[1],
  );
  for (const name of mapped) {
    if (!names.includes(name)) {
      errors.push(
        `src/index.css maps "--color-${name}", but it is not a semantic token.`,
      );
    }
  }
}

function checkPrePaintFallbacks(html, tokens, errors) {
  const htmlBlocks = [...html.matchAll(/<html([^>]*)>([\s\S]*?)\/html>/g)];
  if (htmlBlocks.length === 0) {
    errors.push("index.html must contain the root html element.");
  }

  const darkFallback = /html\s*\{[^}]*background-color:\s*([^;]+);/.exec(html);
  const lightFallback =
    /html\.lyceum-theme-light\s*\{[^}]*background-color:\s*([^;]+);/.exec(html);

  if (!darkFallback) {
    errors.push("index.html must declare a dark pre-paint background-color.");
  } else if (darkFallback[1].trim() !== tokens.DARK_TOKENS.background) {
    errors.push(
      `index.html dark fallback is ${darkFallback[1].trim()}, expected ${tokens.DARK_TOKENS.background}.`,
    );
  }

  if (!lightFallback) {
    errors.push(
      "index.html must declare a light pre-paint background-color for .lyceum-theme-light.",
    );
  } else if (lightFallback[1].trim() !== tokens.LIGHT_TOKENS.background) {
    errors.push(
      `index.html light fallback is ${lightFallback[1].trim()}, expected ${tokens.LIGHT_TOKENS.background}.`,
    );
  }

  if (!html.includes("lyceum:app-settings")) {
    errors.push("index.html must read the persisted appearance from localStorage.");
  }
  if (!html.includes("prefers-color-scheme: light")) {
    errors.push("index.html must resolve the system theme before paint.");
  }

  const bootIndex = html.indexOf("src/theme/boot.ts");
  const mainIndex = html.indexOf("src/main.tsx");
  if (bootIndex === -1) {
    errors.push("index.html must load src/theme/boot.ts before the React entry point.");
  } else if (mainIndex !== -1 && bootIndex > mainIndex) {
    errors.push("index.html must load src/theme/boot.ts before src/main.tsx.");
  }
}

function checkElectron(electronSource, errors) {
  if (!electronSource.includes("DARK_TOKENS.background")) {
    errors.push("electron/main.ts must use DARK_TOKENS.background.");
  }
  if (!electronSource.includes("LIGHT_TOKENS.background")) {
    errors.push("electron/main.ts must use LIGHT_TOKENS.background.");
  }
  if (/backgroundColor:\s*["']#09090b["']/.test(electronSource)) {
    errors.push(
      "electron/main.ts must not hardcode the dark background; use the token source.",
    );
  }
  if (!/ready-to-show/.test(electronSource)) {
    errors.push("electron/main.ts must wait for ready-to-show before showing the window.");
  }
}

function collectMigratedFiles(directory = SOURCE_ROOT) {
  const files = [];
  for (const entry of fs.readdirSync(path.join(rootDir, directory), {
    withFileTypes: true,
  })) {
    const relativePath = path.posix.join(directory, entry.name);
    if (
      SOURCE_EXCLUDED_PREFIXES.some((prefix) => relativePath.startsWith(prefix))
    ) {
      continue;
    }
    if (entry.isDirectory()) {
      files.push(...collectMigratedFiles(relativePath));
      continue;
    }
    if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(relativePath);
    }
  }
  return files.sort();
}

function checkMigratedFiles(errors) {
  const migratedFiles = collectMigratedFiles();
  if (migratedFiles.length === 0) {
    errors.push("No user-visible source files were found for the token scan.");
    return;
  }

  for (const relativePath of migratedFiles) {
    const source = read(relativePath);
    const match = LEGACY_COLOR_CLASS.exec(source);
    if (match) {
      errors.push(
        `${relativePath} still uses legacy color class "${match[0]}"; use a semantic utility instead.`,
      );
    }
    if (source.includes("var(--ui-")) {
      errors.push(
        `${relativePath} still reads a legacy "--ui-*" variable; use a semantic token.`,
      );
    }
    if (source.includes("var(--accent-")) {
      errors.push(
        `${relativePath} still reads a legacy "--accent-*" variable; use a semantic token.`,
      );
    }
  }
}

function checkLegacyIsolation(css, errors) {
  const extracted = extractBlock(
    css,
    "LEGACY COLOR REMAP START",
    "LEGACY COLOR REMAP END",
    "src/index.css",
  );
  if (extracted.error) {
    errors.push(extracted.error);
    return;
  }

  for (const [label, outside] of [
    ["before", extracted.before],
    ["after", extracted.after],
  ]) {
    const lines = outside.split(/\r?\n/);
    lines.forEach((line) => {
      if (LEGACY_SELECTOR.test(line) && line.includes("!important")) {
        errors.push(
          `src/index.css has a legacy !important remap ${label} the compatibility marker: ${line.trim()}`,
        );
      }
    });
  }

  if (!/TEMPORARY COMPATIBILITY LAYER/.test(extracted.block)) {
    errors.push("The legacy remap block must be documented as temporary.");
  }
}

function checkIsolatedViewers(errors) {
  const pdfCore = read("resources/pdfjs-viewer/lyceum-core.mjs");
  if (!pdfCore.includes("CMD_SET_THEME") || !pdfCore.includes("isPdfViewerTheme")) {
    errors.push(
      "resources/pdfjs-viewer/lyceum-core.mjs is stale; run node scripts/build-lyceum-core.mjs.",
    );
  }

  const pdfTheme = read("resources/pdfjs-viewer/features/theme/index.mjs");
  if (!pdfTheme.includes("CMD_SET_THEME") || !pdfTheme.includes("--lyceum-")) {
    errors.push(
      "resources/pdfjs-viewer/features/theme/index.mjs must apply host tokens as --lyceum-* variables.",
    );
  }

  const pdfEntry = read("resources/pdfjs-viewer/index.mjs");
  if (!pdfEntry.includes("installThemeFeature")) {
    errors.push("resources/pdfjs-viewer/index.mjs must install the theme feature.");
  }

  const pdfCss = read("resources/pdfjs-viewer/lyceum-pdfjs.css");
  if (!pdfCss.includes("--lyceum-background") || pdfCss.includes("var(--ui-")) {
    errors.push(
      "resources/pdfjs-viewer/lyceum-pdfjs.css must consume --lyceum-* tokens only.",
    );
  }

  const epubTheme = read(
    "src/pages/ReadingPage/components/epub-reader/theme.ts",
  );
  if (/var\(--ui-/.test(epubTheme)) {
    errors.push(
      "EPUB content theme must use explicit colors; its iframe does not inherit host CSS variables.",
    );
  }
}

export async function checkDesignTokens() {
  const errors = [];
  const tokens = await loadTokenModule();
  const css = read("src/index.css");
  const html = read("index.html");
  const electronSource = read("electron/main.ts");

  checkTokens(tokens, errors);
  checkTailwindMapping(css, tokens.SEMANTIC_TOKEN_NAMES, errors);
  checkPrePaintFallbacks(html, tokens, errors);
  checkElectron(electronSource, errors);
  checkMigratedFiles(errors);
  checkLegacyIsolation(css, errors);
  checkIsolatedViewers(errors);

  return errors;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const errors = await checkDesignTokens();
    if (errors.length > 0) {
      console.error("[check-design-tokens] Failed:");
      for (const error of errors) {
        console.error(`  - ${error}`);
      }
      process.exitCode = 1;
    } else {
      console.log(
        `[check-design-tokens] OK (${collectMigratedFiles().length} source files checked)`,
      );
    }
  } catch (error) {
    console.error("[check-design-tokens] Unexpected failure:", error);
    process.exitCode = 1;
  }
}
