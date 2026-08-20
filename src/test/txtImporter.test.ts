import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { convertViaLyceum, readLyceumPackage } from "../lib/lyceum";

const tempRoots: string[] = [];
afterEach(() => tempRoots.splice(0).forEach((root) => fs.rmSync(root, { recursive: true, force: true })));

describe("TXT fidelity", () => {
  it("detects UTF-16 without BOM, splits chapter headings and preserves line breaks on TXT round-trip", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "lyceum-txt-"));
    tempRoots.push(root);
    const text = "CAPITULO 1\r\nPrimeira linha\r\nSegunda linha\r\n\r\nCAPITULO 2\r\nUltima linha";
    const sourcePath = path.join(root, "book.txt");
    const bytes = Buffer.from(text, "utf16le");
    fs.writeFileSync(sourcePath, bytes);
    const outputPath = path.join(root, "roundtrip.txt");
    const packageRoot = path.join(root, "book.lyceum");

    const result = await convertViaLyceum({
      sourcePath,
      sourceFormat: "txt",
      targetFormat: "txt",
      packageRoot,
      outputPath,
    });
    const pkg = readLyceumPackage(packageRoot);

    expect(pkg.textual?.chapters).toHaveLength(2);
    expect(pkg.textual?.chapters[0].xhtml).toContain("Primeira linha<br />Segunda linha");
    expect(fs.readFileSync(outputPath, "utf8")).toBe(text);
    expect(result.importReport.stats).toMatchObject({ preservedLineBreaks: true, chapterCount: 2 });
  });
});
