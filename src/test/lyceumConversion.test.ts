import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  convertViaLyceum,
  listTargetsForSourceFormat,
  readLyceumPackage,
} from "../lib/lyceum";

async function buildEpub() {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip");
  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0"?>
    <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
      <rootfiles>
        <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
      </rootfiles>
    </container>`,
  );
  zip.file(
    "OEBPS/content.opf",
    `<?xml version="1.0" encoding="UTF-8"?>
      <package version="3.0" xmlns="http://www.idpf.org/2007/opf">
        <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
          <dc:title>Livro Lyceum</dc:title>
          <dc:creator>Autora Teste</dc:creator>
          <dc:language>pt-BR</dc:language>
        </metadata>
        <manifest>
          <item id="chap1" href="text/ch1.xhtml" media-type="application/xhtml+xml"/>
          <item id="chap2" href="text/ch2.xhtml" media-type="application/xhtml+xml"/>
        </manifest>
        <spine>
          <itemref idref="chap1"/>
          <itemref idref="chap2"/>
        </spine>
      </package>`,
  );
  zip.file("OEBPS/text/ch1.xhtml", "<html><head><title>Inicio</title></head><body><h1>Inicio</h1><p>Primeiro texto canonico.</p></body></html>");
  zip.file("OEBPS/text/ch2.xhtml", "<html><head><title>Fim</title></head><body><h1>Fim</h1><p>Segundo texto canonico.</p></body></html>");

  return zip.generateAsync({ type: "uint8array", mimeType: "application/epub+zip" });
}

describe("lyceum conversion core", () => {
  it("lists reusable targets for an EPUB importer", () => {
    expect(listTargetsForSourceFormat("epub").map((target) => target.format)).toEqual([
      "pdf",
      "txt",
      "html",
      "azw3",
    ]);
  });

  it("imports EPUB into .lyceum and exports TXT through the canonical package", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lyceum-test-"));
    const sourcePath = path.join(tempDir, "source.epub");
    const packageRoot = path.join(tempDir, "book.lyceum");
    const outputPath = path.join(tempDir, "book.txt");
    fs.writeFileSync(sourcePath, Buffer.from(await buildEpub()));

    const result = await convertViaLyceum({
      sourcePath,
      sourceFormat: "epub",
      targetFormat: "txt",
      packageRoot,
      outputPath,
    });
    const pkg = readLyceumPackage(result.packageRoot);
    const txt = fs.readFileSync(outputPath, "utf8");

    expect(pkg.manifest.sourceFormat).toBe("epub");
    expect(pkg.manifest.primaryContentKind).toBe("textual");
    expect(pkg.textual?.chapters).toHaveLength(2);
    expect(txt).toContain("Primeiro texto canonico");
    expect(txt).toContain("Segundo texto canonico");
  });

  it("imports TXT into .lyceum and exports EPUB", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lyceum-test-"));
    const sourcePath = path.join(tempDir, "notes.txt");
    const packageRoot = path.join(tempDir, "notes.lyceum");
    const outputPath = path.join(tempDir, "notes.epub");
    fs.writeFileSync(sourcePath, "Primeiro paragrafo.\n\nSegundo paragrafo.", "utf8");

    await convertViaLyceum({
      sourcePath,
      sourceFormat: "txt",
      targetFormat: "epub",
      packageRoot,
      outputPath,
      metadata: { title: "Notas" },
    });

    const zip = await JSZip.loadAsync(fs.readFileSync(outputPath));

    expect(zip.file("OEBPS/content.opf")).toBeTruthy();
    expect(await zip.file("OEBPS/text/chapter-001.xhtml")?.async("text")).toContain("Primeiro paragrafo");
  });

  it("exports textual packages as a real KF8/AZW3 Palm database", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lyceum-test-"));
    const sourcePath = path.join(tempDir, "source.epub");
    const packageRoot = path.join(tempDir, "book.lyceum");
    const outputPath = path.join(tempDir, "book.azw3");
    fs.writeFileSync(sourcePath, Buffer.from(await buildEpub()));

    const result = await convertViaLyceum({
      sourcePath,
      sourceFormat: "epub",
      targetFormat: "azw3",
      packageRoot,
      outputPath,
    });
    const azw3 = fs.readFileSync(outputPath);
    const view = new DataView(azw3.buffer, azw3.byteOffset, azw3.byteLength);
    const text = new TextDecoder().decode(azw3);
    const firstRecordOffset = view.getUint32(78, false);
    const mobiOffset = firstRecordOffset + 16;
    const textRecordOffset = view.getUint32(86, false);
    const textRecordEnd = view.getUint32(94, false);
    const textRecord = azw3.subarray(textRecordOffset, textRecordEnd).toString("utf8");

    expect(azw3.subarray(60, 68).toString("ascii")).toBe("BOOKMOBI");
    expect(view.getUint16(76, false)).toBeGreaterThanOrEqual(4);
    expect(azw3.subarray(mobiOffset, mobiOffset + 4).toString("ascii")).toBe("MOBI");
    expect(view.getUint32(mobiOffset + 20, false)).toBe(8);
    expect(view.getUint32(mobiOffset + 128, false) & 0x40).toBe(0x40);
    expect(result.exportReport.stats.chapterCount).toBe(2);
    expect(text).toContain("EXTH");
    expect(textRecord).toContain("<html");
    expect(textRecord).toContain("Primeiro texto canonico");
    expect(textRecord).toContain("Segundo texto canonico");
  });
});
