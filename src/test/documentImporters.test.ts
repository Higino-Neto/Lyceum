// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import { afterEach, describe, expect, it } from "vitest";
import { convertViaLyceum, readLyceumPackage } from "../lib/lyceum";

const tempRoots: string[] = [];
afterEach(() => tempRoots.splice(0).forEach((root) => fs.rmSync(root, { recursive: true, force: true })));

function tempDir() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lyceum-docs-"));
  tempRoots.push(root);
  return root;
}

const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fe0dd8a5b10000000049454e44ae426082", "hex");

async function importToPackage(fileName: string, bytes: Buffer, sourceFormat: "docx" | "fb2" | "cbr") {
  const root = tempDir();
  const sourcePath = path.join(root, fileName);
  fs.writeFileSync(sourcePath, bytes);
  const result = await convertViaLyceum({
    sourcePath,
    sourceFormat,
    targetFormat: "epub",
    packageRoot: path.join(root, "pkg"),
    outputPath: path.join(root, "out.epub"),
  });
  expect(fs.existsSync(result.outputPath)).toBe(true);
  return { pkg: readLyceumPackage(result.packageRoot), result };
}

async function docxFixture() {
  const zip = new JSZip();
  const w = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"';
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8"?>
<w:document ${w}><w:body>
  <w:p><w:pPr><w:pStyle w:val="Ttulo1"/></w:pPr><w:r><w:t>Capítulo Um</w:t></w:r></w:p>
  <w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Negrito</w:t></w:r><w:r><w:t xml:space="preserve"> e normal</w:t></w:r><w:r><w:footnoteReference w:id="1"/></w:r></w:p>
  <w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>Item A</w:t></w:r></w:p>
  <w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>Item B</w:t></w:r></w:p>
  <w:p><w:r><w:drawing><wp:inline><wp:docPr id="1" name="img" descr="Figura"/><a:graphic><a:graphicData><a:blip r:embed="rIdImg"/></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>
  <w:p><w:pPr><w:pStyle w:val="Ttulo1"/></w:pPr><w:r><w:t>Capítulo Dois</w:t></w:r></w:p>
  <w:tbl><w:tr><w:tc><w:p><w:r><w:t>Célula</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
  <w:p><w:hyperlink r:id="rIdLink"><w:r><w:t>site</w:t></w:r></w:hyperlink></w:p>
</w:body></w:document>`);
  zip.file("word/styles.xml", `<?xml version="1.0"?><w:styles ${w}><w:style w:type="paragraph" w:styleId="Ttulo1"><w:name w:val="heading 1"/></w:style></w:styles>`);
  zip.file("word/numbering.xml", `<?xml version="1.0"?><w:numbering ${w}><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:numFmt w:val="decimal"/></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`);
  zip.file("word/footnotes.xml", `<?xml version="1.0"?><w:footnotes ${w}><w:footnote w:id="1"><w:p><w:r><w:t>Uma nota.</w:t></w:r></w:p></w:footnote></w:footnotes>`);
  zip.file("word/_rels/document.xml.rels", `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rIdImg" Type="image" Target="media/image1.png"/>
<Relationship Id="rIdLink" Type="hyperlink" Target="https://example.com" TargetMode="External"/></Relationships>`);
  zip.file("word/media/image1.png", PNG);
  zip.file("docProps/core.xml", `<?xml version="1.0"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Documento Word</dc:title><dc:creator>Fulana</dc:creator></cp:coreProperties>`);
  return zip.generateAsync({ type: "nodebuffer" });
}

describe("DOCX importer", () => {
  it("splits on headings and keeps formatting, lists, images, tables, links and notes", async () => {
    const { pkg } = await importToPackage("doc.docx", await docxFixture(), "docx");
    const chapters = pkg.textual!.chapters;

    expect(pkg.metadata.title).toBe("Documento Word");
    expect(pkg.metadata.author).toBe("Fulana");
    expect(chapters.map((chapter) => chapter.title)).toEqual(["Capítulo Um", "Capítulo Dois", "Notas"]);
    expect(chapters[0].xhtml).toContain("<strong>Negrito</strong>");
    expect(chapters[0].xhtml).toMatch(/<ol><li>Item A<\/li><li>Item B<\/li><\/ol>/);
    expect(chapters[0].xhtml).toContain('alt="Figura"');
    expect(chapters[0].xhtml).toContain("chapter-003.xhtml#note-footnote-1");
    expect(chapters[1].xhtml).toContain("<td><p>Célula</p></td>");
    expect(chapters[1].xhtml).toContain('href="https://example.com"');
    expect(chapters[2].xhtml).toContain("Uma nota.");
    expect(pkg.textual!.resources.some((resource) => resource.mediaType === "image/png")).toBe(true);
  });
});

describe("FB2 importer", () => {
  it("reads metadata, sections, notes and the cover image (windows-1251)", async () => {
    const xml = `<?xml version="1.0" encoding="windows-1251"?>
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0" xmlns:l="http://www.w3.org/1999/xlink">
<description><title-info><genre>prose</genre><author><first-name>Лев</first-name><last-name>Толстой</last-name></author>
<book-title>Повесть</book-title><lang>ru</lang><sequence name="Ciclo" number="2"/>
<coverpage><image l:href="#cover.png"/></coverpage></title-info></description>
<body><title><p>Повесть</p></title>
<section><title><p>Глава 1</p></title><p>Текст <emphasis>курсив</emphasis><a l:href="#n1" type="note">1</a></p></section>
<section><title><p>Глава 2</p></title><p>Конец</p></section></body>
<body name="notes"><section id="n1"><title><p>1</p></title><p>Примечание</p></section></body>
<binary id="cover.png" content-type="image/png">${PNG.toString("base64")}</binary>
</FictionBook>`;
    const { pkg } = await importToPackage("book.fb2", encode1251(xml), "fb2");
    const chapters = pkg.textual!.chapters;

    expect(pkg.metadata.title).toBe("Повесть");
    expect(pkg.metadata.author).toBe("Лев Толстой");
    expect(pkg.metadata.series).toBe("Ciclo");
    expect(pkg.metadata.seriesIndex).toBe("2");
    expect(pkg.metadata.coverResourceId).toBeTruthy();
    expect(chapters.map((chapter) => chapter.title)).toContain("Глава 1");
    const firstChapter = chapters.find((chapter) => chapter.title === "Глава 1")!;
    expect(firstChapter.xhtml).toContain("<em>курсив</em>");
    expect(firstChapter.xhtml).toMatch(/href="chapter-\d{3}\.xhtml#n1"/);
  });
});

describe("CBR importer", () => {
  it("opens CBR files that are really ZIP archives", async () => {
    const zip = new JSZip();
    zip.file("001.png", PNG);
    zip.file("002.png", PNG);
    const { pkg, result } = await importToPackage("comic.cbr", await zip.generateAsync({ type: "nodebuffer" }), "cbr");
    expect(result.importReport.sourceFormat).toBe("cbr");
    expect(pkg.comic?.pageCount).toBe(2);
  });
});

/** Minimal windows-1251 encoder for the Cyrillic fixture. */
function encode1251(text: string): Buffer {
  const bytes: number[] = [];
  for (const char of text) {
    const code = char.codePointAt(0)!;
    if (code < 0x80) bytes.push(code);
    else if (code >= 0x410 && code <= 0x44f) bytes.push(code - 0x410 + 0xc0);
    else if (code === 0x401) bytes.push(0xa8);
    else if (code === 0x451) bytes.push(0xb8);
    else bytes.push(0x3f);
  }
  return Buffer.from(bytes);
}
