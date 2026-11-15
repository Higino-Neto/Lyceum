import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  buildApnx,
  buildPageMapString,
  computePageStarts,
  convertViaLyceum,
  groupsFromLabels,
  paginateTextual,
  readMobiBookText,
  resolvePageMap,
  validateAzw3File,
  writeApnxForMobiFile,
  type LyceumTextualContent,
} from "../lib/lyceum";
import { buildAzw3 } from "../lib/lyceum/mobi/azw3Writer";
import { validateXhtmlDocument } from "../lib/lyceum/epub/htmlSanitizer";
import { parseEpubBufferToTextual } from "../lib/lyceum/importers/epubImporter";
import { convertPdfToEpub } from "../lib/pdf-to-epub/pipeline";

function parseApnx(data: Uint8Array) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const contentLength = view.getUint32(8);
  const content = JSON.parse(new TextDecoder().decode(data.subarray(12, 12 + contentLength)));
  const section = 12 + contentLength;
  const pageHeaderLength = view.getUint16(section + 2);
  const pageCount = view.getUint16(section + 4);
  const pageHeader = JSON.parse(new TextDecoder().decode(data.subarray(section + 8, section + 8 + pageHeaderLength)));
  const offsets = Array.from({ length: pageCount }, (_, index) => view.getUint32(section + 8 + pageHeaderLength + index * 4));
  return {
    version: view.getUint32(0),
    sectionOffset: view.getUint32(4),
    contentLength,
    content,
    pageSectionVersion: view.getUint16(section),
    bits: view.getUint16(section + 6),
    pageHeader,
    pageCount,
    offsets,
    totalLength: data.length,
  };
}

function chapterXhtml(title: string, body: string) {
  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>${title}</title></head>
<body>${body}</body>
</html>`;
}

function longParagraphs(prefix: string, count: number) {
  return Array.from({ length: count }, (_, index) => (
    `<p>${prefix} paragrafo ${index + 1}. ${"Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(6)}</p>`
  )).join("\n");
}

function textualFixture(): LyceumTextualContent {
  const chapters = [
    { id: "c1", href: "text/c1.xhtml", title: "Um", xhtml: chapterXhtml("Um", `<h1>Um</h1>${longParagraphs("Primeiro", 20)}`) },
    { id: "c2", href: "text/c2.xhtml", title: "Dois", xhtml: chapterXhtml("Dois", `<h1>Dois</h1>${longParagraphs("Segundo", 20)}`) },
  ];
  return {
    chapters,
    spine: chapters.map((chapter) => ({ id: chapter.id, href: chapter.href, title: chapter.title })),
    toc: chapters.map((chapter) => ({ id: chapter.id, href: chapter.href, title: chapter.title, level: 1 })),
    fulltext: "",
    resources: [],
  };
}

describe("APNX writer", () => {
  it("writes the documented binary layout", () => {
    const data = buildApnx({
      asin: "LYCEUM-ABC",
      acr: "Meu Livro",
      contentGuid: "deadbeef",
      pageOffsets: [0, 1200, 2400, 3600],
    });
    const parsed = parseApnx(data);

    expect(parsed.version).toBe(65537);
    expect(parsed.sectionOffset).toBe(12 + parsed.contentLength);
    expect(parsed.content).toEqual({
      contentGuid: "deadbeef",
      asin: "LYCEUM-ABC",
      cdeType: "EBOK",
      format: "MOBI_8",
      fileRevisionId: "1",
      acr: "Meu Livro",
    });
    expect(parsed.pageSectionVersion).toBe(1);
    expect(parsed.bits).toBe(32);
    expect(parsed.pageHeader).toEqual({ asin: "LYCEUM-ABC", pageMap: "(1,a,1)" });
    expect(parsed.pageCount).toBe(4);
    expect(parsed.offsets).toEqual([0, 1200, 2400, 3600]);
    expect(parsed.totalLength).toBe(12 + parsed.contentLength + 8 + JSON.stringify(parsed.pageHeader).length + 16);
  });

  it("keeps headers ASCII and offsets non-decreasing", () => {
    const parsed = parseApnx(buildApnx({ asin: "X", acr: "Café", pageOffsets: [10, 5, 30] }));
    expect(parsed.content.acr).toBe("Café");
    expect(parsed.offsets).toEqual([10, 10, 30]);
  });

  it("compresses page labels into arabic/roman/custom groups", () => {
    const groups = groupsFromLabels(["i", "ii", "iii", "1", "2", "3", "A", "B"]);
    expect(buildPageMapString(groups)).toBe("(1,r,1),(4,a,1),(7,c,A|B)");
    expect(groupsFromLabels(["1", "2", "5", "6"])).toEqual([
      { style: "arabic", count: 2, first: 1 },
      { style: "arabic", count: 2, first: 5 },
    ]);
  });
});

describe("page start computation", () => {
  it("spreads a print page count over the text without getting stuck", () => {
    expect(computePageStarts(1000, { mode: "target-count", printPageCount: 4 })).toEqual([0, 250, 500, 750]);
    // More pages than characters: Calibre's integer step would loop forever.
    const tiny = computePageStarts(3, { mode: "target-count", printPageCount: 6 });
    expect(tiny).toHaveLength(6);
    expect(tiny.every((value, index) => index === 0 || value >= tiny[index - 1])).toBe(true);
  });

  it("handles empty input and estimates", () => {
    expect(computePageStarts(0, { mode: "estimate" })).toEqual([]);
    expect(computePageStarts(500, { mode: "target-count", printPageCount: 0 })).toEqual([]);
    expect(computePageStarts(3600, { mode: "estimate", charsPerPage: 1800 })).toEqual([0, 1800]);
    expect(computePageStarts(3601, { mode: "estimate", charsPerPage: 1800 })).toHaveLength(3);
  });
});

describe("paginateTextual", () => {
  it("inserts valid page anchors at word boundaries and is idempotent", () => {
    const paginated = paginateTextual(textualFixture(), { mode: "target-count", printPageCount: 12 });
    expect(paginated.pageMap?.source).toBe("target-count");
    expect(paginated.pageMap?.pages).toHaveLength(12);
    expect(paginated.pageMap?.printPageCount).toBe(12);

    for (const chapter of paginated.chapters) {
      expect(() => validateXhtmlDocument(chapter.xhtml)).not.toThrow();
    }
    const allXhtml = paginated.chapters.map((chapter) => chapter.xhtml).join("\n");
    for (const page of paginated.pageMap!.pages) {
      expect(allXhtml).toContain(`id="${page.anchorId}"`);
    }
    // Never splits a word: the character before every anchor is a space or markup.
    for (const match of allXhtml.matchAll(/(.)<span id="lyceum-pg-/g)) {
      expect(match[1]).toMatch(/[\s>]/);
    }

    const again = paginateTextual(paginated, { mode: "target-count", printPageCount: 5 });
    const againXhtml = again.chapters.map((chapter) => chapter.xhtml).join("\n");
    expect(again.pageMap?.pages).toHaveLength(5);
    expect(againXhtml.match(/epub:type="pagebreak"/g)).toHaveLength(5);
  });

  it("keeps publisher pages in auto mode and honours off", () => {
    const withPublisher: LyceumTextualContent = {
      ...textualFixture(),
      pageMap: { source: "publisher", pages: [{ label: "1", href: "text/c1.xhtml", anchorId: "" }] },
    };
    expect(resolvePageMap(withPublisher, { pageNumbers: "auto", printPageCount: 300 }).pageMap?.source).toBe("publisher");
    expect(resolvePageMap(withPublisher, { pageNumbers: "off" }).pageMap).toBeUndefined();
    expect(resolvePageMap(textualFixture(), { pageNumbers: "auto", printPageCount: 7 }).pageMap?.pages).toHaveLength(7);
    expect(resolvePageMap(textualFixture(), {}).pageMap?.source).toBe("estimate");
  });
});

describe("AZW3 page offsets", () => {
  it("points every APNX offset at its page anchor in the uncompressed text", () => {
    const textual = paginateTextual(textualFixture(), { mode: "target-count", printPageCount: 9 });
    const result = buildAzw3({ metadata: { title: "Paginas", language: "pt-BR", asin: "LYCEUM-TEST" }, textual });
    expect(result.pageOffsets).toHaveLength(9);
    // Only page 1 may be unresolved: its anchor sits in the leading heading.
    expect(result.stats.unresolvedPageCount).toBeLessThanOrEqual(1);

    const book = readMobiBookText(result.buffer);
    expect(book.asin).toBe("LYCEUM-TEST");
    expect(book.cdeType).toBe("EBOK");
    expect(book.mobiVersion).toBe(8);
    expect(book.pdbName).toBe(result.pdbName);

    result.pageOffsets.forEach((offset, index) => {
      const snippet = book.text.subarray(offset, offset + 80).toString("utf8");
      // Page 1 sits inside the first heading, which the writer replaces; it
      // falls back to the start of the chapter body.
      if (index === 0) return;
      expect(snippet.startsWith("<span")).toBe(true);
      expect(snippet).toContain(`lyceum-pg-${index + 1}"`);
    });
  });

  it("generates an estimated APNX for an existing AZW3", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lyceum-apnx-"));
    const bookPath = path.join(tempDir, "livro.azw3");
    const result = buildAzw3({ metadata: { title: "Sem paginas", language: "pt-BR", asin: "ASIN1" }, textual: textualFixture() });
    fs.writeFileSync(bookPath, Buffer.from(result.buffer));

    const written = writeApnxForMobiFile(bookPath, { charsPerPage: 1000 });
    expect(written.written).toBe(true);
    expect(written.apnxPath).toBe(path.join(tempDir, "livro.apnx"));
    const apnx = parseApnx(fs.readFileSync(written.apnxPath!));
    expect(apnx.content.asin).toBe("ASIN1");
    expect(apnx.pageCount).toBe(written.pageCount);
    expect(apnx.pageCount).toBeGreaterThan(5);
    expect(apnx.offsets[0]).toBe(0);

    const target = writeApnxForMobiFile(bookPath, { printPageCount: 42 });
    expect(target.pageCount).toBe(42);
    expect(writeApnxForMobiFile(bookPath, { pageNumbers: "off" }).written).toBe(false);
    expect(writeApnxForMobiFile(path.join(tempDir, "missing.azw3")).written).toBe(false);
  });
});

async function buildEpubWithPageList() {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file("META-INF/container.xml", `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`);
  zip.file("OEBPS/content.opf", `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="id">urn:uuid:12345678-1234-1234-1234-123456789012</dc:identifier>
    <dc:title>Livro com paginas</dc:title>
    <dc:language>pt-BR</dc:language>
    <meta property="dcterms:modified">2026-01-01T00:00:00Z</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="c1" href="text/c1.xhtml" media-type="application/xhtml+xml"/>
    <item id="c2" href="text/c2.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine><itemref idref="c1"/><itemref idref="c2"/></spine>
</package>`);
  zip.file("OEBPS/nav.xhtml", chapterXhtml("Nav", `
<nav epub:type="toc"><ol><li><a href="text/c1.xhtml">Um</a></li><li><a href="text/c2.xhtml">Dois</a></li></ol></nav>
<nav epub:type="page-list"><ol>
  <li><a href="text/c1.xhtml#pg1">1</a></li>
  <li><a href="text/c1.xhtml#pg2">2</a></li>
  <li><a href="text/c2.xhtml#pg3">3</a></li>
</ol></nav>`));
  zip.file("OEBPS/text/c1.xhtml", chapterXhtml("Um", `<h1>Um</h1><p><span epub:type="pagebreak" id="pg1"/>Texto da primeira pagina.</p><p>Mais texto <span epub:type="pagebreak" id="pg2"/>na segunda pagina.</p>`));
  zip.file("OEBPS/text/c2.xhtml", chapterXhtml("Dois", `<h1>Dois</h1><p><span epub:type="pagebreak" id="pg3"/>Terceira pagina.</p>`));
  return zip.generateAsync({ type: "nodebuffer" });
}

describe("publisher page-list", () => {
  it("is imported from the EPUB nav and becomes the APNX of the AZW3", async () => {
    const parsed = await parseEpubBufferToTextual(await buildEpubWithPageList());
    expect(parsed.textual.pageMap).toEqual({
      source: "publisher",
      pages: [
        { label: "1", href: "text/c1.xhtml", anchorId: "pg1" },
        { label: "2", href: "text/c1.xhtml", anchorId: "pg2" },
        { label: "3", href: "text/c2.xhtml", anchorId: "pg3" },
      ],
    });

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lyceum-pagelist-"));
    const sourcePath = path.join(tempDir, "source.epub");
    const outputPath = path.join(tempDir, "book.azw3");
    fs.writeFileSync(sourcePath, await buildEpubWithPageList());
    const result = await convertViaLyceum({
      sourcePath,
      sourceFormat: "epub",
      targetFormat: "azw3",
      packageRoot: path.join(tempDir, "book.lyceum"),
      outputPath,
      metadata: { title: "Livro com paginas", asin: "LYCEUM-PL" },
    });

    expect(validateAzw3File(outputPath).valid).toBe(true);
    expect(result.exportReport.stats.pageMapSource).toBe("publisher");
    expect(result.exportReport.stats.pageCount).toBe(3);
    const apnx = parseApnx(fs.readFileSync(path.join(tempDir, "book.apnx")));
    expect(apnx.pageCount).toBe(3);
    expect(apnx.content.asin).toBe("LYCEUM-PL");
    const text = readMobiBookText(fs.readFileSync(outputPath)).text;
    expect(text.subarray(apnx.offsets[1], apnx.offsets[1] + 60).toString("utf8")).toContain('id="pg2"');
    expect(text.subarray(apnx.offsets[2], apnx.offsets[2] + 60).toString("utf8")).toContain('id="pg3"');
  });
});

describe("PDF real pages", () => {
  it("writes one page marker per PDF page and a matching nav page-list", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.TimesRoman);
    for (let pageIndex = 0; pageIndex < 3; pageIndex += 1) {
      const page = pdf.addPage([400, 600]);
      for (let lineIndex = 0; lineIndex < 20; lineIndex += 1) {
        page.drawText(`Pagina ${pageIndex + 1} linha ${lineIndex + 1} com algum texto corrido`, {
          x: 40,
          y: 560 - lineIndex * 24,
          size: 11,
          font,
        });
      }
    }

    const result = await convertPdfToEpub(new Uint8Array(await pdf.save()).buffer, { title: "PDF paginado", mode: "reflow" });
    const zip = await JSZip.loadAsync(result.epub);
    const nav = await zip.file("OEBPS/toc.xhtml")!.async("text");
    expect(nav).toContain('epub:type="page-list"');
    expect(nav.match(/#lyceum-pg-\d+"/g)).toHaveLength(3);

    const parsed = await parseEpubBufferToTextual(result.epub);
    expect(parsed.textual.pageMap?.pages.map((page) => page.label)).toEqual(["1", "2", "3"]);
    const allXhtml = parsed.textual.chapters.map((chapter) => chapter.xhtml).join("\n");
    for (const label of ["1", "2", "3"]) expect(allXhtml).toContain(`id="lyceum-pg-${label}"`);
    // Page 2's marker sits right before page 2's first line.
    expect(allXhtml).toMatch(/lyceum-pg-2"[^>]*><\/span>Pagina 2 linha 1/);
  });
});

describe("Kindle conversion robustness", () => {
  it("rebuilds ligatures that PDFs expose as Private Use Area glyphs", async () => {
    const { buildGlyphRepairMap, applyGlyphRepair } = await import("../lib/pdf-to-epub/glyphRepair");
    const texts = [
      "e scythe left the room. ere was nothing aer that.",
      "en the scythe said the other thing was left after the storm.",
      "There is the after and the left. at was all. She le early.",
      "they said that then; there was the thing",
    ];
    const map = buildGlyphRepairMap(texts);
    expect(map.get("")).toBe("Th");
    expect(map.get("")).toBe("ft");
    expect(applyGlyphRepair("e next room. She le aer oer.", map))
      .toBe("The next room. She left after other.");
    expect(buildGlyphRepairMap(["no ligatures here at all"]).size).toBe(0);
  });

  it("keeps text PDFs reflowable in auto mode and preserves scanned ones as pages", async () => {
    const { choosePdfEpubMode } = await import("../lib/pdf-to-epub/pipeline");
    const render = async () => null;
    const text = Array.from({ length: 10 }, () => ({ requiresOcr: false }));
    const scanned = Array.from({ length: 10 }, (_, index) => ({ requiresOcr: index > 1 }));
    expect(choosePdfEpubMode(text, { renderImageAsset: render })).toBe("reflow");
    expect(choosePdfEpubMode(scanned, { renderImageAsset: render })).toBe("fixed-layout");
    expect(choosePdfEpubMode(scanned, {})).toBe("reflow");
    expect(choosePdfEpubMode(text, { mode: "fixed-layout", renderImageAsset: render })).toBe("fixed-layout");
  });

  it("writes preserved PDF pages without the hidden text layer or an injected heading", () => {
    const page = (n: number) => ({
      id: `page-${n}`,
      href: `text/page-${n}.xhtml`,
      title: `Pagina ${n}`,
      xhtml: chapterXhtml(`Pagina ${n}`, `<span id="lyceum-pg-${n}" epub:type="pagebreak"></span><img class="page-image" src="../images/p${n}.jpg" alt="Pagina ${n}"/><div class="page-text">${"palavra ".repeat(300)}</div>`),
    });
    const chapters = [page(1), page(2)];
    const result = buildAzw3({
      metadata: { title: "Paginas", language: "pt-BR" },
      textual: { chapters, spine: chapters, toc: chapters.map((chapter) => ({ ...chapter, level: 1 })), fulltext: "" },
    });
    const text = readMobiBookText(result.buffer).text.toString("utf8");
    expect(text).not.toContain("page-text");
    expect(text).not.toContain("palavra");
    expect(text).not.toMatch(/<h1[^>]*>Pagina 1<\/h1>/);
    expect(text).toContain("img.page-image");
  });

  it("references images with base-32 kindle:embed indices", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 0xff, 0xd9]);
    const images = Array.from({ length: 12 }, (_, index) => ({
      id: `img${index + 1}`, href: `images/i${index + 1}.jpg`, mediaType: "image/jpeg", data: jpeg,
    }));
    const body = images.map((image) => `<p><img src="../${image.href}" alt="x"/></p>`).join("");
    const chapter = { id: "c1", href: "text/c1.xhtml", title: "Imagens", xhtml: chapterXhtml("Imagens", body) };
    const result = buildAzw3({
      metadata: { title: "Imagens", language: "pt-BR" },
      textual: { chapters: [chapter], spine: [chapter], toc: [{ ...chapter, level: 1 }], fulltext: "", resources: images },
    });
    const text = readMobiBookText(result.buffer).text.toString("utf8");
    const refs = [...text.matchAll(/kindle:embed:([0-9A-V]{4})/g)].map((match) => match[1]);
    expect(refs).toContain("000A");
    expect(refs).toContain("000C");
    expect(refs).not.toContain("0010");
    expect(refs.every((ref) => Number.parseInt(ref, 32) <= 12)).toBe(true);
  });

  it("drops a chapter's own heading even inside a section wrapper", () => {
    const chapter = {
      id: "c1",
      href: "text/c1.xhtml",
      title: "ACKNOWLEDGMENTS",
      xhtml: chapterXhtml("ACKNOWLEDGMENTS", `<section epub:type="chapter"><span id="lyceum-pg-3" epub:type="pagebreak"></span><h1 id="chapter-1">ACKNOWLEDGMENTS</h1><p>Texto.</p></section>`),
    };
    const result = buildAzw3({
      metadata: { title: "Livro", language: "pt-BR" },
      textual: { chapters: [chapter], spine: [chapter], toc: [{ ...chapter, level: 1 }], fulltext: "" },
    });
    const text = readMobiBookText(result.buffer).text.toString("utf8");
    expect(text.match(/ACKNOWLEDGMENTS<\/h1>/g)).toHaveLength(1);
    expect(text).toContain('id="lyceum-pg-3"');
  });
});

describe("PDF book structure", () => {
  const box = (y: number, height = 20) => ({ x0: 50, y0: y, x1: 400, y1: y + height, width: 350, height });
  const heading = (type: "chapter" | "title" | "subtitle", text: string, page: number, y: number) => ({
    type, text, children: [], pageRange: { start: page, end: page }, bbox: box(y),
  });
  const paragraph = (text: string, page: number, y: number) => ({
    type: "paragraph" as const, text, children: [], pageRange: { start: page, end: page }, bbox: box(y, 12),
  });

  it("merges chapter numbers and wrapped title lines into one heading", async () => {
    const { mergeHeadingRuns, headingLines } = await import("../lib/pdf-to-epub/structure");
    const merged = mergeHeadingRuns([
      heading("subtitle", "24", 10, 100),
      heading("title", "An Embarrassment to Who and What We", 10, 130),
      heading("subtitle", "Are", 10, 155),
      paragraph("Texto.", 10, 220),
    ]);
    expect(merged).toHaveLength(2);
    expect(merged[0].text).toBe("24. An Embarrassment to Who and What We Are");
    expect(headingLines(merged[0])).toEqual(["24", "An Embarrassment to Who and What We Are"]);
  });

  it("nests numbered chapters under parts and keeps front matter untitled", async () => {
    const { buildOutlineSections, mergeHeadingRuns } = await import("../lib/pdf-to-epub/structure");
    const blocks = mergeHeadingRuns([
      paragraph("Dedicatoria.", 2, 100),
      heading("title", "ACKNOWLEDGMENTS", 3, 80),
      paragraph("Obrigado.", 3, 140),
      heading("chapter", "Part One", 5, 300),
      heading("title", "ROBE AND RING", 6, 80),
      paragraph("Epigrafe.", 6, 140),
      heading("subtitle", "1", 7, 80), heading("subtitle", "No Dimming of the Sun", 7, 110), paragraph("A.", 7, 200),
      heading("subtitle", "2", 9, 80), heading("subtitle", "Second", 9, 110), paragraph("B.", 9, 200),
      heading("subtitle", "3", 11, 80), heading("subtitle", "Third", 11, 110), paragraph("C.", 11, 200),
      heading("chapter", "Part Two", 13, 300),
      heading("subtitle", "4", 14, 80), heading("subtitle", "Fourth", 14, 110), paragraph("D.", 14, 200),
    ]);
    const sections = buildOutlineSections(blocks);
    expect(sections.map((section) => [section.title ?? null, section.level, Boolean(section.front)])).toEqual([
      [null, 1, true],
      ["ACKNOWLEDGMENTS", 1, false],
      ["Part One: ROBE AND RING", 1, false],
      ["1. No Dimming of the Sun", 2, false],
      ["2. Second", 2, false],
      ["3. Third", 2, false],
      ["Part Two", 1, false],
      ["4. Fourth", 2, false],
    ]);
  });

  it("opens PDF conversions on a text-free cover page with a nested TOC", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.TimesRoman);
    for (let index = 0; index < 3; index += 1) {
      const page = pdf.addPage([400, 600]);
      for (let line = 0; line < 20; line += 1) page.drawText(`Pagina ${index + 1} linha ${line + 1} com texto corrido`, { x: 40, y: 560 - line * 24, size: 11, font });
    }
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 0xff, 0xd9]);
    const result = await convertPdfToEpub(new Uint8Array(await pdf.save()).buffer, {
      title: "Livro com capa",
      mode: "reflow",
      renderImageAsset: async (candidate) => ({ href: `images/${candidate.id}.jpg`, mediaType: "image/jpeg", data: jpeg }),
    });
    const zip = await JSZip.loadAsync(result.epub);
    const opf = await zip.file("OEBPS/content.opf")!.async("text");
    const cover = await zip.file("OEBPS/text/cover.xhtml")!.async("text");
    expect(opf).toMatch(/<itemref idref="cover" \/>\s*<itemref/);
    expect(opf).toMatch(/properties="cover-image"/);
    expect(opf).toContain('<meta name="cover"');
    expect(cover).toContain('class="cover-image"');
    expect(cover).toContain('id="lyceum-pg-1"');
    const allText = (await Promise.all(Object.values(zip.files).filter((file) => file.name.endsWith(".xhtml")).map((file) => file.async("text")))).join("\n");
    expect(allText).not.toMatch(/>Inicio<|Imagem da pagina|<figcaption>/);
  });

  it("does not inject chapter titles into AZW3 bodies", () => {
    const chapter = { id: "c1", href: "text/c1.xhtml", title: "Capitulo 7", xhtml: chapterXhtml("Capitulo 7", "<p>Sem titulo proprio.</p>") };
    const result = buildAzw3({
      metadata: { title: "Livro", language: "pt-BR" },
      textual: { chapters: [chapter], spine: [chapter], toc: [{ ...chapter, level: 1 }], fulltext: "" },
    });
    const text = readMobiBookText(result.buffer).text.toString("utf8");
    expect(text).not.toMatch(/<h1[^>]*>Capitulo 7<\/h1>/);
    expect(text).toContain("Sem titulo proprio.");
  });
});

describe("real-world EPUB robustness for Kindle", () => {
  async function buildMessyEpub() {
    const zip = new JSZip();
    zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
    zip.file("META-INF/container.xml", `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`);
    zip.file("OEBPS/content.opf", `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="id">urn:uuid:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee</dc:identifier>
    <dc:title>Le Horla</dc:title><dc:language>fr</dc:language>
    <meta property="dcterms:modified">2026-01-01T00:00:00Z</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="css" href="style.css" media-type="text/css"/>
    <item id="cover-img" href="cover.jpg" media-type="image/jpeg" properties="cover-image"/>
    <item id="cover" href="cover.xhtml" media-type="application/xhtml+xml" properties="svg"/>
    <item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine toc="ncx"><itemref idref="cover"/><itemref idref="c1"/></spine>
</package>`);
    zip.file("OEBPS/nav.xhtml", chapterXhtml("Nav", `<nav epub:type="toc"><ol><li><a href="cover.xhtml">Couverture</a></li><li><a href="c1.xhtml">Le\u0002 Horla</a></li></ol></nav>`));
    zip.file("OEBPS/toc.ncx", `<?xml version="1.0" encoding="utf-8"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head/><docTitle><text>Le Horla</text></docTitle><navMap>
<navPoint id="n1" playOrder="1"><navLabel><text>Couverture</text></navLabel><content src="cover.xhtml"/></navPoint>
<navPoint id="n2" playOrder="2"><navLabel><text>Le Horla</text></navLabel><content src="c1.xhtml"/></navPoint></navMap></ncx>`);
    zip.file("OEBPS/style.css", `@font-face { font-family: X; src: url(fonts/missing.otf); } p { margin: 0; }`);
    zip.file("OEBPS/cover.jpg", new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 0xff, 0xd9]));
    zip.file("OEBPS/cover.xhtml", `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Cover</title></head>
<body><div class="cover"><svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 1600 2400" xmlns:xlink="http://www.w3.org/1999/xlink"><image width="1600" height="2400" xlink:href="cover.jpg"/></svg></div></body></html>`);
    zip.file("OEBPS/c1.xhtml", chapterXhtml("Le Horla", `<h1>Le Horla</h1><p>8 mai.\u000C Quelle journée admirable ! <a href="#nowhere">note</a> <a href="cover.xhtml#missing">x</a></p>${longParagraphs("Texte", 4)}`));
    return zip.generateAsync({ type: "nodebuffer" });
  }

  it("converts EPUBs with SVG covers, control characters, double TOCs and broken links", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lyceum-messy-"));
    const sourcePath = path.join(dir, "horla.epub");
    const outputPath = path.join(dir, "horla.azw3");
    fs.writeFileSync(sourcePath, await buildMessyEpub());

    const parsed = await parseEpubBufferToTextual(fs.readFileSync(sourcePath));
    // Control characters in TOC titles are dropped (they would break XML).
    expect(parsed.textual.toc.map((item) => item.title)).toEqual(["Couverture", "Le Horla"]);

    const result = await convertViaLyceum({
      sourcePath,
      sourceFormat: "epub",
      targetFormat: "azw3",
      packageRoot: path.join(dir, "pkg"),
      outputPath,
      metadata: { title: "Le Horla", asin: "LYCEUM-HORLA" },
      conversionOptions: { pageNumbers: "auto" },
    });
    expect(validateAzw3File(outputPath).valid).toBe(true);
    expect(result.exportReport.stats.pageCount).toBeGreaterThan(0);

    const book = readMobiBookText(fs.readFileSync(outputPath));
    const text = book.text.toString("utf8");
    expect(text).toContain('<img class="svg-image" src="kindle:embed:0001?mime=image"');
    expect(text).not.toContain("<svg");
    expect(text).not.toContain("\u000C");
    // The book's own language wins when none is given (EXTH 524).
    const { inspectKindleBook } = await import("../../electron/services/kindle-book-inspector");
    const inspected = await inspectKindleBook({ filePath: outputPath, fileType: "azw3", thumbnailPath: path.join(dir, "t.webp") });
    expect(inspected.details.language).toBe("fr");
    expect(inspected.details.title).toBe("Le Horla");
  });
});

describe("Kindle font sizes", () => {
  it("makes publisher sizes relative to the body text size", async () => {
    const { normalizeKindleFontSizes, detectBaseFontSizePt } = await import("../lib/lyceum/kindle/fontSizes");
    // Gutenberg-style stylesheet: 14pt body text.
    const css = [
      "* { font-family: times } p { text-indent: 1em; font-size: 14pt; margin-top: 0.75em }",
      "blockquote { margin-left: 2em; font-size: 14pt }",
      "h1 { font-size: 21pt } .small { font-size: 10.5pt } .note { font-size: small }",
      "html { font-size: 62.5% } body { font-size: 16px; margin: 0 }",
      ".rem { font-size: 1.4rem } .pct { font-size: 90% } .short { font: italic 7pt/1.2 serif }",
      "@media screen { body { margin-left: 10% } p.big { font-size: 28pt } }",
    ].join("\n");
    expect(detectBaseFontSizePt(css)).toBe(14);
    const out = normalizeKindleFontSizes(css);
    expect(out).toContain("font-size: 1em");
    expect(out).toContain("h1 { font-size: 1.5em }");
    expect(out).toContain(".small { font-size: 0.75em }");
    expect(out).toContain(".note { font-size: 0.89em }");
    expect(out).toContain(".rem { font-size: 1.4em }");
    expect(out).toContain(".pct { font-size: 90% }");
    expect(out).toContain("font: italic 0.6em/1.2 serif");
    expect(out).toContain("p.big { font-size: 2em }");
    expect(out).not.toMatch(/html \{[^}]*font-size/);
    expect(out).not.toMatch(/body \{[^}]*font-size/);
    expect(out).toContain("body { margin-left: 10% }");
    expect(out).not.toMatch(/\d(pt|px)\b/);
  });

  it("applies to AZW3 output unless the original sizes are requested", () => {
    const css = { id: "css", href: "style.css", mediaType: "text/css", data: new TextEncoder().encode("p { font-size: 14pt } h1 { font-size: 28pt }") };
    const chapter = { id: "c1", href: "c1.xhtml", title: "Um", xhtml: chapterXhtml("Um", "<h1>Um</h1><p>Texto.</p>") };
    const textual = { chapters: [chapter], spine: [chapter], toc: [{ ...chapter, level: 1 }], fulltext: "", resources: [css] };
    const kindle = readMobiBookText(buildAzw3({ metadata: { title: "x" }, textual }).buffer).text.toString("utf8");
    const original = readMobiBookText(buildAzw3({ metadata: { title: "x" }, textual, fontSizes: "original" }).buffer).text.toString("utf8");
    expect(kindle).toContain("h1 { font-size: 2em }");
    expect(kindle).not.toContain("14pt");
    expect(original).toContain("14pt");
  });
});
