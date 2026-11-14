// @vitest-environment node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import AdmZip from "adm-zip";
import { PDFDocument } from "pdf-lib";
import { afterEach, describe, expect, it } from "vitest";
import { readBookMetadataFromFile, writeBookMetadataToFile } from "./book-file-metadata";
import {
  readComicInfo,
  readOpfMetadata,
  readXmpMetadata,
  sanitizePdfFields,
  writeComicInfo,
  writeOpfMetadata,
  buildXmpPacket,
} from "./book-metadata-formats";
import { parsePageRanges } from "../../src/core/pdf/page-ranges";

let tempDir: string | null = null;

function makeTempDir() {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lyceum-book-metadata-"));
  return tempDir;
}

afterEach(() => {
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  tempDir = null;
});

const EPUB3_OPF = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">urn:uuid:1234</dc:identifier>
    <dc:title id="t1">Old Title</dc:title>
    <dc:creator id="c1">Jane Doe</dc:creator>
    <meta refines="#c1" property="file-as">Doe, Jane</meta>
    <dc:creator id="c2">John Roe</dc:creator>
    <meta refines="#c2" property="role" scheme="marc:relators">aut</meta>
    <dc:language>en</dc:language>
    <dc:subject>9780000000000</dc:subject>
    <meta property="dcterms:modified">2020-01-01T00:00:00Z</meta>
  </metadata>
  <manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/></manifest>
  <spine><itemref idref="nav"/></spine>
</package>`;

describe("OPF metadata", () => {
  it("keeps the package identifier id and refinement targets when editing", () => {
    const opf = writeOpfMetadata(EPUB3_OPF, {
      title: "New Title",
      author: "Jane Doe & Richard Poe",
      identifier: "urn:uuid:9999",
      isbn: "978-3-16-148410-0",
      subject: "Fiction, Classics",
      series: "Saga",
      seriesIndex: "2",
      publisher: "ACME",
      language: "pt-BR",
    }, new Date("2026-01-02T03:04:05Z"));

    expect(opf).toContain('<dc:identifier id="bookid">urn:uuid:9999</dc:identifier>');
    expect(opf).toContain('<dc:title id="t1">New Title</dc:title>');
    expect(opf).toContain('<dc:creator id="c1">Jane Doe</dc:creator>');
    expect(opf).toContain('<dc:creator id="c2">Richard Poe</dc:creator>');
    expect(opf).toContain("urn:isbn:9783161484100");
    expect(opf).not.toContain("<dc:subject>9780000000000</dc:subject>");
    expect(opf).toContain('property="belongs-to-collection" id="lyceum-series">Saga</meta>');
    expect(opf).toContain('<meta property="dcterms:modified">2026-01-02T03:04:05Z</meta>');

    const read = readOpfMetadata(opf);
    expect(read).toMatchObject({
      title: "New Title",
      author: "Jane Doe & Richard Poe",
      identifier: "urn:uuid:9999",
      isbn: "9783161484100",
      subject: "Fiction, Classics",
      series: "Saga",
      seriesIndex: "2",
      publisher: "ACME",
      language: "pt-BR",
      authorSort: "Doe, Jane",
    });
  });

  it("drops extra author creators together with their refinements", () => {
    const opf = writeOpfMetadata(EPUB3_OPF, { author: "Solo Author" });
    expect(opf).toContain('<dc:creator id="c1">Solo Author</dc:creator>');
    expect(opf).not.toContain('id="c2"');
    expect(opf).not.toContain('refines="#c2"');
  });

  it("never removes required title or language when they are blank", () => {
    const opf = writeOpfMetadata(EPUB3_OPF, { title: "", language: "" });
    expect(opf).toContain("Old Title");
    expect(opf).toContain("<dc:language>en</dc:language>");
  });

  it("is idempotent", () => {
    const metadata = { title: "T", author: "A & B", isbn: "9783161484100", series: "S", seriesIndex: "1", asin: "B000TEST" };
    const once = writeOpfMetadata(EPUB3_OPF, metadata, new Date(0));
    expect(writeOpfMetadata(once, metadata, new Date(0))).toBe(once);
  });
});

describe("XMP and ComicInfo", () => {
  it("round-trips XMP fields", () => {
    const xmp = buildXmpPacket({ title: "Livro & Cia", author: "A & B", publisher: "P", isbn: "0306406152", series: "S", seriesIndex: "3", subject: "x, y", language: "pt" });
    expect(readXmpMetadata(xmp)).toMatchObject({
      title: "Livro & Cia", author: "A & B", publisher: "P", isbn: "0306406152", series: "S", seriesIndex: "3", subject: "x, y", language: "pt",
    });
  });

  it("ignores placeholder PDF titles and authors", () => {
    expect(sanitizePdfFields({ title: "Microsoft Word - draft.docx", author: "Owner" })).toEqual({ title: undefined, author: undefined });
    expect(sanitizePdfFields({ title: "Dom Casmurro", author: "Machado de Assis" })).toMatchObject({ title: "Dom Casmurro" });
  });

  it("updates ComicInfo while keeping unknown elements and Pages last", () => {
    const existing = `<?xml version="1.0"?>\n<ComicInfo>\n  <Title>Old</Title>\n  <Inker>Someone</Inker>\n  <Pages><Page Image="0"/></Pages>\n</ComicInfo>`;
    const xml = writeComicInfo(existing, { title: "New", series: "Saga", seriesIndex: "4", publishDate: "2021-07-09", author: "A & B" });
    expect(xml).toContain("<Inker>Someone</Inker>");
    expect(xml.indexOf("<Series>")).toBeLessThan(xml.indexOf("<Pages>"));
    expect(readComicInfo(xml)).toMatchObject({ title: "New", series: "Saga", seriesIndex: "4", publishDate: "2021-07-09", author: "A & B" });
  });
});

describe("embedded metadata on disk", () => {
  it("writes and reads back PDF metadata, including XMP-only fields", async () => {
    const dir = makeTempDir();
    const filePath = path.join(dir, "book.pdf");
    const pdf = await PDFDocument.create();
    pdf.addPage();
    fs.writeFileSync(filePath, await pdf.save());

    const result = await writeBookMetadataToFile(filePath, "pdf", {
      title: "Memórias Póstumas",
      author: "Machado de Assis",
      publisher: "Garnier",
      isbn: "9788535910663",
      series: "Clássicos",
      seriesIndex: "1",
      language: "pt-BR",
    });
    expect(result).toMatchObject({ success: true });
    expect(await readBookMetadataFromFile(filePath, "pdf")).toMatchObject({
      title: "Memórias Póstumas",
      author: "Machado de Assis",
      publisher: "Garnier",
      isbn: "9788535910663",
      series: "Clássicos",
      seriesIndex: "1",
      language: "pt-BR",
    });
  });

  it("writes and reads back EPUB and CBZ metadata", async () => {
    const dir = makeTempDir();
    const epubPath = path.join(dir, "book.epub");
    const epub = new AdmZip();
    epub.addFile("mimetype", Buffer.from("application/epub+zip"));
    epub.addFile("META-INF/container.xml", Buffer.from('<container><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>'));
    epub.addFile("OEBPS/content.opf", Buffer.from(EPUB3_OPF));
    epub.writeZip(epubPath);
    expect(await writeBookMetadataToFile(epubPath, "epub", { title: "EPUB Title", author: "Someone" })).toMatchObject({ success: true });
    expect(await readBookMetadataFromFile(epubPath, "epub")).toMatchObject({ title: "EPUB Title", author: "Someone", identifier: "urn:uuid:1234" });

    const cbzPath = path.join(dir, "comic.cbz");
    const cbz = new AdmZip();
    cbz.addFile("001.jpg", Buffer.from([0xff, 0xd8, 0xff]));
    cbz.writeZip(cbzPath);
    expect(await writeBookMetadataToFile(cbzPath, "cbz", { title: "Comic", series: "Run", seriesIndex: "7" })).toMatchObject({ success: true });
    expect(await readBookMetadataFromFile(cbzPath, "cbz")).toMatchObject({ title: "Comic", series: "Run", seriesIndex: "7" });
  });
});

describe("parsePageRanges", () => {
  it("parses ranges in typed order", () => {
    expect(parsePageRanges("1-3, 7, 9-", 10)).toEqual([0, 1, 2, 6, 8, 9]);
    expect(parsePageRanges("3-1", 5)).toEqual([2, 1, 0]);
    expect(parsePageRanges("-2", 5)).toEqual([0, 1]);
  });

  it("rejects malformed or out-of-range input", () => {
    expect(() => parsePageRanges("0", 5)).toThrow();
    expect(() => parsePageRanges("2-9", 5)).toThrow();
    expect(() => parsePageRanges("abc", 5)).toThrow();
    expect(() => parsePageRanges(" , ", 5)).toThrow();
  });
});
