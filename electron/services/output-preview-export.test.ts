// @vitest-environment node

import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import AdmZip from "adm-zip";
import { afterEach, describe, expect, it } from "vitest";
import { exportOutputPreview } from "./output-preview-export";

const require = createRequire(import.meta.url);
const sharp = require("sharp") as typeof import("sharp");
let tempDir: string | null = null;

function makeTempDir() {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lyceum-output-preview-"));
  return tempDir;
}

afterEach(() => {
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  tempDir = null;
});

function writeEpub(dir: string) {
  const chapters = [1, 2, 3].map((n) => ({
    id: `c${n}`,
    href: `chapter${n}.xhtml`,
    body: `<h1>Capitulo ${n}</h1><p>Texto exclusivo do capitulo ${n}.</p>`,
  }));
  const zip = new AdmZip();
  zip.addFile("mimetype", Buffer.from("application/epub+zip"));
  zip.addFile("META-INF/container.xml", Buffer.from('<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'));
  zip.addFile("OEBPS/content.opf", Buffer.from(`<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">urn:uuid:test</dc:identifier><dc:title>Livro</dc:title><dc:language>pt</dc:language><meta property="dcterms:modified">2026-01-01T00:00:00Z</meta></metadata>
  <manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>${chapters.map((c) => `<item id="${c.id}" href="${c.href}" media-type="application/xhtml+xml"/>`).join("")}</manifest>
  <spine>${chapters.map((c) => `<itemref idref="${c.id}"/>`).join("")}</spine>
</package>`));
  zip.addFile("OEBPS/nav.xhtml", Buffer.from(`<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>nav</title></head><body><nav epub:type="toc"><ol>${chapters.map((c, i) => `<li><a href="${c.href}">Capitulo ${i + 1}</a></li>`).join("")}</ol></nav></body></html>`));
  for (const c of chapters) {
    zip.addFile(`OEBPS/${c.href}`, Buffer.from(`<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${c.id}</title></head><body>${c.body}</body></html>`));
  }
  const filePath = path.join(dir, "book.epub");
  zip.writeZip(filePath);
  return filePath;
}

describe("exportOutputPreview", () => {
  it("exports only the requested chapter, for both PDF (via HTML) and EPUB targets", async () => {
    const dir = makeTempDir();
    const sourcePath = writeEpub(dir);
    const cacheRoot = path.join(dir, "cache");

    const forPdf = await exportOutputPreview({ sourcePath, sourceFormat: "epub", targetFormat: "pdf", segmentIndex: 1, cacheRoot, outputDir: path.join(dir, "a") });
    expect(forPdf).toMatchObject({ kind: "html", segmentKind: "chapter", segmentIndex: 1 });
    expect(forPdf.segmentCount).toBeGreaterThanOrEqual(3);
    const html = fs.readFileSync(forPdf.outputPath, "utf8");
    expect(html).toContain("exclusivo do capitulo 2");
    expect(html).not.toContain("exclusivo do capitulo 1");

    const forEpub = await exportOutputPreview({ sourcePath, sourceFormat: "epub", targetFormat: "azw3", segmentIndex: 99, cacheRoot, outputDir: path.join(dir, "b") });
    expect(forEpub.kind).toBe("epub");
    expect(forEpub.segmentIndex).toBe(forEpub.segmentCount - 1);
    const entries = new AdmZip(forEpub.outputPath).getEntries().map((entry) => entry.getData().toString("utf8")).join("\n");
    expect(entries).toContain("exclusivo do capitulo 3");
    expect(entries).not.toContain("exclusivo do capitulo 2");

    // The import is cached on disk and reused.
    expect(fs.readdirSync(cacheRoot)).toHaveLength(1);
  });

  it("previews a single comic page as a PDF", async () => {
    const dir = makeTempDir();
    const zip = new AdmZip();
    for (const n of [1, 2]) {
      zip.addFile(`00${n}.png`, await sharp({ create: { width: 40, height: 60, channels: 3, background: "#336699" } }).png().toBuffer());
    }
    const sourcePath = path.join(dir, "comic.cbz");
    zip.writeZip(sourcePath);
    const result = await exportOutputPreview({ sourcePath, sourceFormat: "cbz", targetFormat: "pdf", segmentIndex: 1, cacheRoot: path.join(dir, "cache"), outputDir: path.join(dir, "out") });
    expect(result).toMatchObject({ kind: "pdf", segmentKind: "page", segmentIndex: 1, segmentCount: 2, fixedLayout: true });
    expect(fs.existsSync(result.outputPath)).toBe(true);
  });
});
