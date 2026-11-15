// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { extractBlocksFromXhtml, prepareLearningDocument, readLinguisticIndex } from "../../lib/lyceum/linguistic";

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "lyceum-ll-"));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

function hashTree(directory: string): string {
  const hash = crypto.createHash("sha256");
  const visit = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(current, entry.name);
      hash.update(path.relative(directory, full));
      if (entry.isDirectory()) visit(full);
      else hash.update(fs.readFileSync(full));
    }
  };
  visit(directory);
  return hash.digest("hex");
}

describe("extractBlocksFromXhtml", () => {
  it("keeps block structure and flattens inline markup", () => {
    const blocks = extractBlocksFromXhtml(`<?xml version="1.0"?><html><head><title>T</title><style>p{}</style></head>
      <body><h2>Kapitel <em>eins</em></h2><p>Er <b>ging</b> nach&nbsp;Hause.</p><ul><li>Eins</li></ul>
      <blockquote><p>Zitat</p></blockquote><p><ruby>漢<rt>kan</rt></ruby></p></body></html>`);
    expect(blocks).toEqual([
      { kind: "heading", level: 2, text: "Kapitel eins" },
      { kind: "paragraph", text: "Er ging nach Hause." },
      { kind: "list-item", text: "Eins" },
      { kind: "quote", text: "Zitat" },
      { kind: "paragraph", text: "漢" },
    ]);
  });
});

describe("prepareLearningDocument", () => {
  it("imports a TXT source into the managed cache and reuses the index", async () => {
    const source = path.join(root, "buch.txt");
    const original = "Der Hund läuft schnell.\n\nDer Hund schläft jetzt. Die Hunde laufen.";
    fs.writeFileSync(source, original, "utf8");
    const cacheRoot = path.join(root, "cache");

    const first = await prepareLearningDocument({ sourcePath: source, sourceFormat: "txt", cacheRoot, cacheKey: "abc", language: "de" });
    expect(first.reused).toBe(false);
    expect(first.language).toBe("de");
    expect(first.packageRoot.startsWith(cacheRoot)).toBe(true);

    const document = await readLinguisticIndex(first.indexPath);
    expect(document?.lexicon.find((entry) => entry.key === "Hund")?.count).toBe(3);

    const second = await prepareLearningDocument({ sourcePath: source, sourceFormat: "txt", cacheRoot, cacheKey: "abc", language: "de" });
    expect(second.reused).toBe(true);
    // Original source untouched.
    expect(fs.readFileSync(source, "utf8")).toBe(original);

    // Changing the language re-analyzes with the other module.
    const english = await prepareLearningDocument({ sourcePath: source, sourceFormat: "txt", cacheRoot, cacheKey: "abc", language: "en" });
    expect(english.reused).toBe(false);
    expect((await readLinguisticIndex(english.indexPath))?.analyzer.module).toBe("en-rules");
  });

  it("never modifies a library .lyceum package (index goes to a sidecar)", async () => {
    const source = path.join(root, "buch.txt");
    fs.writeFileSync(source, "Ich gehe. Du gehst.", "utf8");
    const cacheRoot = path.join(root, "cache");
    const imported = await prepareLearningDocument({ sourcePath: source, sourceFormat: "txt", cacheRoot, cacheKey: "src", language: "de" });

    const libraryPackage = path.join(root, "library", "Buch.lyceum");
    fs.mkdirSync(path.dirname(libraryPackage), { recursive: true });
    fs.cpSync(imported.packageRoot, libraryPackage, { recursive: true });
    fs.rmSync(path.join(libraryPackage, "indexes", "linguistic"), { recursive: true, force: true });
    const before = hashTree(libraryPackage);

    const result = await prepareLearningDocument({ sourcePath: libraryPackage, sourceFormat: "lyceum", cacheRoot, cacheKey: "lib", language: "de" });
    expect(result.indexPath.startsWith(cacheRoot)).toBe(true);
    expect(hashTree(libraryPackage)).toBe(before);
  });
});
