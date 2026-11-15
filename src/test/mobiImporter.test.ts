// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { convertViaLyceum, readLyceumPackage, type LyceumTextualContent } from "../lib/lyceum";
import { buildAzw3 } from "../lib/lyceum/mobi/azw3Writer";
import { readMobiBook } from "../lib/lyceum/mobi/mobiReader";
import { parseImportErrorCode } from "../lib/lyceum/importers/importErrors";

const tempRoots: string[] = [];
afterEach(() => tempRoots.splice(0).forEach((root) => fs.rmSync(root, { recursive: true, force: true })));

function tempDir() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lyceum-mobi-"));
  tempRoots.push(root);
  return root;
}

function chapterXhtml(title: string, body: string) {
  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>${title}</title></head>
<body>${body}</body>
</html>`;
}

function paragraphs(prefix: string, count: number) {
  return Array.from({ length: count }, (_, index) => (
    `<p>${prefix} paragrafo ${index + 1}. ${"Texto de exemplo com acentuação e pontuação. ".repeat(8)}</p>`
  )).join("\n");
}

function textualFixture(): LyceumTextualContent {
  const chapters = [
    {
      id: "c1",
      href: "text/c1.xhtml",
      title: "Primeiro",
      xhtml: chapterXhtml("Primeiro", `<h1>Primeiro</h1>${paragraphs("Um", 30)}<p><a href="c2.xhtml#alvo">Ir ao alvo</a></p>`),
    },
    {
      id: "c2",
      href: "text/c2.xhtml",
      title: "Segundo",
      xhtml: chapterXhtml("Segundo", `<h1>Segundo</h1>${paragraphs("Dois", 30)}<p id="alvo">Alvo do link</p>`),
    },
  ];
  return {
    chapters,
    spine: chapters.map((chapter) => ({ id: chapter.id, href: chapter.href, title: chapter.title })),
    toc: chapters.map((chapter) => ({ id: chapter.id, href: chapter.href, title: chapter.title, level: 1 })),
    fulltext: "",
    resources: [],
  };
}

function writePdb(name: string, records: Buffer[]) {
  const headerLength = 78 + records.length * 8 + 2;
  const header = Buffer.alloc(headerLength);
  header.write(name, 0, "latin1");
  header.write("BOOKMOBI", 60, "ascii");
  header.writeUInt16BE(records.length, 76);
  let offset = headerLength;
  records.forEach((record, index) => {
    header.writeUInt32BE(offset, 78 + index * 8);
    header.writeUInt32BE(index * 2, 78 + index * 8 + 4);
    offset += record.length;
  });
  return Buffer.concat([header, ...records]);
}

function mobi6Fixture(html: string, options: { encryption?: number; image?: Buffer } = {}) {
  const text = Buffer.from(html, "utf8");
  const textRecords: Buffer[] = [];
  for (let start = 0; start < text.length; start += 4096) textRecords.push(text.subarray(start, start + 4096));
  const record0 = Buffer.alloc(16 + 232);
  record0.writeUInt16BE(1, 0); // no compression
  record0.writeUInt32BE(text.length, 4);
  record0.writeUInt16BE(textRecords.length, 8);
  record0.writeUInt16BE(4096, 10);
  record0.writeUInt16BE(options.encryption ?? 0, 12);
  record0.write("MOBI", 16, "ascii");
  record0.writeUInt32BE(232, 20);
  record0.writeUInt32BE(2, 24);
  record0.writeUInt32BE(65001, 28);
  record0.writeUInt32BE(6, 36);
  record0.writeUInt32BE(0xffffffff, 0xf4);
  const firstImage = options.image ? 1 + textRecords.length : 0xffffffff;
  record0.writeUInt32BE(firstImage, 0x6c);
  const records = [record0, ...textRecords];
  if (options.image) records.push(options.image);
  return writePdb("Mobi6", records);
}

describe("MOBI/AZW3 reader", () => {
  it("reads back an AZW3 written by Lyceum: chapters, cross-chapter links and metadata", () => {
    const azw3 = buildAzw3({
      metadata: { title: "Livro de Teste", author: "Autora Exemplo", language: "pt-BR", publisher: "Editora" },
      textual: textualFixture(),
    });
    const book = readMobiBook(Buffer.from(azw3.buffer));

    expect(book.metadata.title).toBe("Livro de Teste");
    expect(book.metadata.author).toBe("Autora Exemplo");
    expect(book.stats?.kf8).toBe(true);
    expect(book.chapters.length).toBeGreaterThanOrEqual(2);
    const all = book.chapters.map((chapter) => chapter.html).join("\n");
    expect(all).toContain("Um paragrafo 30.");
    expect(all).toContain("Dois paragrafo 1.");
    expect(all).toContain("acentuação");
    expect(all).not.toContain("kindle:pos");
    expect(all).toMatch(/lyceum-chapter:\d+/);
  });

  it("converts an AZW3 into a readable EPUB", async () => {
    const root = tempDir();
    const sourcePath = path.join(root, "book.azw3");
    fs.writeFileSync(sourcePath, Buffer.from(buildAzw3({
      metadata: { title: "Conversao", language: "pt-BR" },
      textual: textualFixture(),
    }).buffer));

    const result = await convertViaLyceum({
      sourcePath,
      sourceFormat: "azw3",
      targetFormat: "epub",
      packageRoot: path.join(root, "pkg"),
      outputPath: path.join(root, "book.epub"),
    });
    const pkg = readLyceumPackage(result.packageRoot);

    expect(fs.existsSync(result.outputPath)).toBe(true);
    expect(pkg.metadata.title).toBe("Conversao");
    expect(pkg.textual?.fulltext).toContain("Alvo do link");
  });

  it("reads MOBI 6 text, filepos links, page breaks and images", () => {
    const png = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fe0dd8a5b10000000049454e44ae426082", "hex");
    const body = "<html><head><guide></guide></head><body><h1>Capitulo 1</h1><p><a filepos=0000000000>topo</a></p>"
      + "<img recindex=\"00001\" /><mbp:pagebreak/><h1>Capitulo 2</h1><p>Fim</p></body></html>";
    // Point the link at the second chapter heading.
    const target = Buffer.from(body.slice(0, body.indexOf("<h1>Capitulo 2")), "utf8").length;
    const html = body.replace("filepos=0000000000", `filepos=${String(target).padStart(10, "0")}`);
    const book = readMobiBook(mobi6Fixture(html, { image: png }));

    expect(book.chapters).toHaveLength(2);
    expect(book.chapters[0].html).toContain("href=\"#filepos");
    expect(book.chapters[1].html).toContain(`id="filepos${target}"`);
    expect(book.chapters[0].html).toContain("../images/image-00001.png");
    expect(book.resources).toHaveLength(1);
    expect(book.resources[0].mediaType).toBe("image/png");
  });

  it("refuses DRM-protected books with a typed error", () => {
    expect.assertions(1);
    try {
      readMobiBook(mobi6Fixture("<p>secreto</p>", { encryption: 2 }));
    } catch (error) {
      expect(parseImportErrorCode(error)).toBe("drm");
    }
  });
});
