import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  convertViaLyceum,
  listTargetsForSourceFormat,
  normalizeHtmlEntitiesForXhtml,
  readLyceumPackage,
  validateAzw3File,
  KfxExporter,
  validateKfxFile,
  inspectKpfArchive,
  type LyceumPackage,
} from "../lib/lyceum";

function buildMinimalLyceumPackage(tempDir: string): LyceumPackage {
  return {
    rootPath: tempDir,
    manifest: {
      schemaVersion: 1,
      packageId: "test-package",
      title: "KFX Test",
      sourceFormat: "epub",
      originalFileName: "test.epub",
      primaryContentKind: "textual",
      contentKinds: ["textual"],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    metadata: {
      title: "KFX Test",
      language: "pt-BR",
    },
    textual: {
      chapters: [
        {
          id: "chap1",
          href: "chap1.xhtml",
          title: "Capitulo",
          xhtml: "<html><body><p>Teste KFX.</p></body></html>",
        },
      ],
      spine: [{ id: "chap1", href: "chap1.xhtml", title: "Capitulo" }],
      toc: [{ id: "chap1", href: "chap1.xhtml", title: "Capitulo", level: 1 }],
      fulltext: "Teste KFX.",
    },
  };
}

function readPdbRecord(buffer: Buffer, index: number, recordCount: number) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const start = view.getUint32(78 + index * 8, false);
  const end = index + 1 < recordCount ? view.getUint32(78 + (index + 1) * 8, false) : buffer.byteLength;
  return buffer.subarray(start, end);
}

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

async function buildPlaceholderTitleEpub() {
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
          <dc:title>Livro com Sumario</dc:title>
          <dc:language>pt-BR</dc:language>
        </metadata>
        <manifest>
          <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
          <item id="chap1" href="text/ch1.xhtml" media-type="application/xhtml+xml"/>
        </manifest>
        <spine>
          <itemref idref="chap1"/>
        </spine>
      </package>`,
  );
  zip.file("OEBPS/nav.xhtml", "<html><body><nav epub:type=\"toc\"><ol><li><a href=\"text/ch1.xhtml\">Nome Real do Capitulo</a></li></ol></nav></body></html>");
  zip.file("OEBPS/text/ch1.xhtml", "<html><head><title>Desconhecido</title></head><body><h1>Desconhecido</h1><p>Texto&nbsp;com entidade.</p></body></html>");

  return zip.generateAsync({ type: "uint8array", mimeType: "application/epub+zip" });
}

async function buildRichEpub() {
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
          <dc:title>Livro Rico</dc:title>
          <dc:creator>Autora Visual</dc:creator>
          <dc:language>pt-BR</dc:language>
        </metadata>
        <manifest>
          <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
          <item id="css" href="styles/book.css" media-type="text/css"/>
          <item id="img" href="images/pixel.png" media-type="image/png"/>
          <item id="chap1" href="text/ch1.xhtml" media-type="application/xhtml+xml"/>
          <item id="chap2" href="text/ch2.xhtml" media-type="application/xhtml+xml"/>
        </manifest>
        <spine>
          <itemref idref="chap1"/>
          <itemref idref="chap2"/>
        </spine>
      </package>`,
  );
  zip.file(
    "OEBPS/nav.xhtml",
    `<html><body><nav epub:type="toc"><ol>
      <li><a href="text/ch1.xhtml">Parte Um</a>
        <ol><li><a href="text/ch2.xhtml">Subcapitulo Visual</a></li></ol>
      </li>
    </ol></nav></body></html>`,
  );
  zip.file("OEBPS/styles/book.css", "body { color: #222; } img { max-width: 100%; }");
  zip.file("OEBPS/images/pixel.png", Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]));
  zip.file(
    "OEBPS/text/ch1.xhtml",
    `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Parte Um</title><link rel="stylesheet" href="../styles/book.css" /></head>
    <body><h1>Parte Um</h1><p>Texto com <strong>formato</strong>.</p><img src="../images/pixel.png" alt="Pixel" /></body></html>`,
  );
  zip.file(
    "OEBPS/text/ch2.xhtml",
    `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Subcapitulo Visual</title></head>
    <body><ul><li>Item preservado</li></ul><table><tr><td>Celula preservada</td></tr></table></body></html>`,
  );

  return zip.generateAsync({ type: "uint8array", mimeType: "application/epub+zip" });
}

async function buildInternalLinksEpub() {
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
          <dc:title>Livro com Links</dc:title>
          <dc:creator>Autora Link</dc:creator>
          <dc:language>pt-BR</dc:language>
        </metadata>
        <manifest>
          <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
          <item id="chap1" href="text/ch1.xhtml" media-type="application/xhtml+xml"/>
          <item id="chap2" href="text/ch2.xhtml" media-type="application/xhtml+xml"/>
        </manifest>
        <spine>
          <itemref idref="chap1"/>
          <itemref idref="chap2"/>
        </spine>
      </package>`,
  );
  zip.file(
    "OEBPS/nav.xhtml",
    `<html><body><nav epub:type="toc"><ol>
      <li><a href="text/ch1.xhtml">Inicio</a></li>
      <li><a href="text/ch2.xhtml#destino">Destino</a></li>
    </ol></nav></body></html>`,
  );
  zip.file(
    "OEBPS/text/ch1.xhtml",
    `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Inicio</title></head>
    <body><h1>Inicio</h1><p>Texto com <a href="#nota-local">nota local</a> e <a href="ch2.xhtml#destino">link interno</a>.</p>
    <aside id="nota-local"><p>Nota local preservada.</p></aside></body></html>`,
  );
  zip.file(
    "OEBPS/text/ch2.xhtml",
    `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Destino</title></head>
    <body><h1 id="destino">Destino</h1><p>Capitulo de destino.</p></body></html>`,
  );

  return zip.generateAsync({ type: "uint8array", mimeType: "application/epub+zip" });
}

describe("lyceum conversion core", () => {
  it("normalizes non-XML HTML entities for XHTML output", () => {
    expect(normalizeHtmlEntitiesForXhtml("<p>A&nbsp;B &amp; C&ndash;D</p>")).toBe("<p>A&#160;B &amp; C&#8211;D</p>");
  });

  it("lists reusable targets for an EPUB importer", () => {
    expect(listTargetsForSourceFormat("epub").map((target) => target.format)).toEqual([
      "pdf",
      "txt",
      "html",
      "azw3",
      "kfx",
      "lyceum",
    ]);
  });

  it("materializes KFX only when Kindle Previewer returns a KFX file", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lyceum-kfx-"));
    const outputPath = path.join(tempDir, "book.kfx");
    const fakeKfx = Buffer.concat([Buffer.from("CONT"), Buffer.from([2, 0, 0, 0, 0, 0, 0, 0])]);
    const exporter = new KfxExporter(async ({ inputPath, outputDir }) => {
      expect(fs.existsSync(inputPath)).toBe(true);
      fs.mkdirSync(outputDir, { recursive: true });
      const generatedPath = path.join(outputDir, "book.kfx");
      fs.writeFileSync(generatedPath, fakeKfx);
      return {
        executablePath: "fake-kindle-previewer",
        generatedFiles: [
          {
            path: generatedPath,
            format: "kfx",
            size: fs.statSync(generatedPath).size,
          },
        ],
        primaryOutputPath: generatedPath,
        primaryOutputFormat: "kfx",
        stdout: "",
        stderr: "",
        logs: [],
      };
    });

    const result = await exporter.export({
      package: buildMinimalLyceumPackage(tempDir),
      outputPath,
    });
    const validation = await validateKfxFile(outputPath);

    expect(result.outputFormat).toBe("kfx");
    expect(validation.valid).toBe(true);
    expect(fs.readFileSync(outputPath).subarray(0, 4).toString("ascii")).toBe("CONT");
    expect(result.report.stats.backend).toBe("kindle-previewer");
  });

  it("assembles KFX when Kindle Previewer returns a real KPF", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lyceum-kpf-"));
    const outputPath = path.join(tempDir, "book.kfx");
    let receivedMetadataTitle = "";
    const exporter = new KfxExporter(
      async ({ outputDir }) => {
        fs.mkdirSync(outputDir, { recursive: true });
        const kpfPath = path.join(outputDir, "book.kpf");
        const zip = new JSZip();
        zip.file("resources/book.kdf", "previewer data");
        zip.file("metadata.json", JSON.stringify({ title: "KPF Test" }));
        fs.writeFileSync(kpfPath, await zip.generateAsync({ type: "nodebuffer" }));
        return {
          executablePath: "fake-kindle-previewer",
          generatedFiles: [
            {
              path: kpfPath,
              format: "kpf",
              size: fs.statSync(kpfPath).size,
            },
          ],
          primaryOutputPath: kpfPath,
          primaryOutputFormat: "kpf",
          stdout: "",
          stderr: "",
          logs: [],
        };
      },
      async (_inputKpfPath, outputKfxPath, options) => {
        receivedMetadataTitle = options?.metadata?.title || "";
        fs.writeFileSync(outputKfxPath, Buffer.concat([Buffer.from("CONT"), Buffer.from([2, 0, 0, 0, 0, 0, 0, 0])]));
        return {
          outputPath: outputKfxPath,
          bytes: fs.statSync(outputKfxPath).size,
          assembler: "test-kpf-assembler",
          kfxlibRoot: "test",
          pythonCommand: "test",
          stdout: "",
          stderr: "",
          warnings: ["assembled from test KPF"],
        };
      },
    );

    const result = await exporter.export({
      package: buildMinimalLyceumPackage(tempDir),
      outputPath,
    });

    expect(result.outputFormat).toBe("kfx");
    expect(result.report.stats.backend).toBe("kindle-previewer+kpf-assembler");
    expect(result.report.stats.assembler).toBe("test-kpf-assembler");
    expect(receivedMetadataTitle).toBe("KFX Test");
    expect(fs.readFileSync(outputPath).subarray(0, 4).toString("ascii")).toBe("CONT");
  });

  it("inspects KPF archives and flags renamed EPUB containers", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lyceum-kpf-inspect-"));
    const kpfPath = path.join(tempDir, "book.kpf");
    const epubRenamedPath = path.join(tempDir, "renamed.kpf");
    const kpfZip = new JSZip();
    kpfZip.file("book.kdf", "previewer data");
    fs.writeFileSync(kpfPath, await kpfZip.generateAsync({ type: "nodebuffer" }));

    const epubZip = new JSZip();
    epubZip.file("mimetype", "application/epub+zip");
    epubZip.file("META-INF/container.xml", "<container />");
    fs.writeFileSync(epubRenamedPath, await epubZip.generateAsync({ type: "nodebuffer" }));

    const kpfInspection = await inspectKpfArchive(kpfPath);
    const epubInspection = await inspectKpfArchive(epubRenamedPath);

    expect(kpfInspection.isZip).toBe(true);
    expect(kpfInspection.likelyKpf).toBe(true);
    expect(kpfInspection.metadataEntries).toContain("book.kdf");
    expect(epubInspection.isEpubZip).toBe(true);
    expect(epubInspection.likelyKpf).toBe(false);
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

  it("preserves EPUB markup, resources and nested TOC levels on round-trip", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lyceum-test-"));
    const sourcePath = path.join(tempDir, "rich.epub");
    const packageRoot = path.join(tempDir, "rich.lyceum");
    const outputPath = path.join(tempDir, "rich-roundtrip.epub");
    fs.writeFileSync(sourcePath, Buffer.from(await buildRichEpub()));

    const result = await convertViaLyceum({
      sourcePath,
      sourceFormat: "epub",
      targetFormat: "epub",
      packageRoot,
      outputPath,
    });
    const pkg = readLyceumPackage(result.packageRoot);
    const zip = await JSZip.loadAsync(fs.readFileSync(outputPath));
    const chapterOne = await zip.file("OEBPS/text/ch1.xhtml")?.async("text");
    const chapterTwo = await zip.file("OEBPS/text/ch2.xhtml")?.async("text");

    expect(pkg.textual?.resources?.map((resource) => resource.href).sort()).toEqual([
      "images/pixel.png",
      "styles/book.css",
    ]);
    expect(pkg.textual?.toc.map((item) => item.level)).toEqual([1, 2]);
    expect(chapterOne).toContain("<strong>formato</strong>");
    expect(chapterOne).toContain("../images/pixel.png");
    expect(chapterTwo).toContain("<ul>");
    expect(chapterTwo).toContain("<table>");
    expect(zip.file("OEBPS/styles/book.css")).toBeTruthy();
    expect(zip.file("OEBPS/images/pixel.png")).toBeTruthy();
    expect(result.importReport.stats.resourceCount).toBe(2);
    expect(result.exportReport.stats.resourceCount).toBe(2);
  });

  it("produces correct rawTextLength and textRecordCount for a long book", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lyceum-long-"));
    const sourcePath = path.join(tempDir, "long.epub");
    const packageRoot = path.join(tempDir, "long.lyceum");
    const outputPath = path.join(tempDir, "long.azw3");

    const zip = new JSZip();
    zip.file("mimetype", "application/epub+zip");
    zip.file(
      "META-INF/container.xml",
      `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`,
    );
    const chapterCount = 6;
    const paragraphsPerChapter = 180;
    const manifestLines: string[] = [];
    const spineLines: string[] = [];
    for (let i = 1; i <= chapterCount; i += 1) {
      const id = `chap${String(i).padStart(3, "0")}`;
      manifestLines.push(`<item id="${id}" href="text/${id}.xhtml" media-type="application/xhtml+xml"/>`);
      spineLines.push(`<itemref idref="${id}"/>`);
    }
    zip.file(
      "OEBPS/content.opf",
      `<?xml version="1.0" encoding="UTF-8"?>
      <package version="3.0" xmlns="http://www.idpf.org/2007/opf">
        <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
          <dc:title>Livro Longo</dc:title>
          <dc:creator>Teste</dc:creator>
          <dc:language>pt-BR</dc:language>
        </metadata>
        <manifest>${manifestLines.join("\n")}</manifest>
        <spine>${spineLines.join("\n")}</spine>
      </package>`,
    );
    for (let i = 1; i <= chapterCount; i += 1) {
      const id = `chap${String(i).padStart(3, "0")}`;
      const paragraphs: string[] = [];
      for (let p = 1; p <= paragraphsPerChapter; p += 1) {
        paragraphs.push(`<p>Paragrafo ${p} do capitulo ${i}. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>`);
      }
      zip.file(
        `OEBPS/text/${id}.xhtml`,
        `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Capitulo ${i}</title></head><body><h1>Capitulo ${i}</h1>${paragraphs.join("\n")}</body></html>`,
      );
    }
    fs.writeFileSync(sourcePath, Buffer.from(await zip.generateAsync({ type: "uint8array", mimeType: "application/epub+zip" })));

    const result = await convertViaLyceum({
      sourcePath,
      sourceFormat: "epub",
      targetFormat: "azw3",
      packageRoot,
      outputPath,
    });
    const validation = validateAzw3File(outputPath);
    const azw3Buffer = fs.readFileSync(outputPath);
    const view = new DataView(azw3Buffer.buffer, azw3Buffer.byteOffset, azw3Buffer.byteLength);
    const recordZeroOffset = view.getUint32(78, false);
    const palmDocTextLength = view.getUint32(recordZeroOffset + 4, false);
    const palmDocRecordCount = view.getUint16(recordZeroOffset + 8, false);

    expect(validation.valid).toBe(true);
    expect(palmDocTextLength).toBeGreaterThan(10000);
    expect(palmDocRecordCount).toBeGreaterThan(1);
    expect(palmDocRecordCount).toBe(result.exportReport.stats.textRecordCount);
    expect(validation.metadata.decompressedTextLength).toBe(palmDocTextLength);
    expect(result.exportReport.stats.fragmentCount).toBeGreaterThan(chapterCount);
    expect(result.exportReport.stats.maxFragmentLength).toBeLessThanOrEqual(8192);
    expect(result.exportReport.stats.extraDataFlags).toBe(3);
    expect(result.exportReport.stats.tbsRecordCount).toBeGreaterThan(0);
    expect(result.exportReport.stats.estimatedLocationCount).toBeGreaterThan(4);
  });

  it("exports textual packages only through a validated real AZW3 backend", async () => {
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
    const validation = validateAzw3File(outputPath);
    const azw3Buffer = fs.readFileSync(outputPath);
    const view = new DataView(azw3Buffer.buffer, azw3Buffer.byteOffset, azw3Buffer.byteLength);
    const recordZeroOffset = view.getUint32(78, false);
    const mobiOffset = recordZeroOffset + 16;
    const recordOffset = (index: number) => view.getUint32(78 + index * 8, false);
    const recordView = (index: number) => new DataView(
      azw3Buffer.buffer,
      azw3Buffer.byteOffset + recordOffset(index),
      (index + 1 < (validation.metadata.recordCount || 0) ? recordOffset(index + 1) : azw3Buffer.byteLength) - recordOffset(index),
    );

    expect(validation.valid).toBe(true);
    expect(validation.metadata.compression).toBe(2);
    expect(validation.metadata.mobiVersion).toBe(8);
    expect(validation.metadata.firstNonTextRecord).toBe(result.exportReport.stats.fragmentIndexRecord);
    expect(validation.metadata.firstResourceRecord).toBe(0xffffffff);
    expect(validation.metadata.hasExth).toBe(true);
    expect(validation.metadata.hasFdst).toBe(true);
    expect(validation.metadata.hasFlis).toBe(true);
    expect(validation.metadata.hasFcis).toBe(true);
    expect(validation.metadata.hasDatp).toBe(true);
    expect(validation.metadata.hasIndx).toBe(true);
    expect(validation.metadata.hasEof).toBe(true);
    expect(view.getUint32(recordZeroOffset + 128, false) & 0x40).toBe(0x40);
    expect(view.getUint32(mobiOffset + 224, false)).toBe(3);
    expect(view.getUint32(mobiOffset + 176, false)).toBe(result.exportReport.stats.fdstRecord);
    expect(view.getUint32(mobiOffset + 180, false)).toBe(1);
    expect(validation.metadata.fdstRecord).toBe(result.exportReport.stats.fdstRecord);
    expect(validation.metadata.fdstCount).toBe(1);
    expect(validation.metadata.fcisRecord).toBe(result.exportReport.stats.fcisRecord);
    expect(validation.metadata.flisRecord).toBe(result.exportReport.stats.flisRecord);
    expect(validation.metadata.decompressedTextLength).toBe(validation.metadata.textLength);
    expect(result.exportReport.stats.tbsRecordCount).toBeGreaterThan(0);
    expect(recordView(validation.metadata.flisRecord!).getUint32(4, false)).toBe(8);
    expect(recordView(validation.metadata.fcisRecord!).getUint32(4, false)).toBe(20);
    expect(recordView(validation.metadata.fcisRecord!).getUint32(12, false)).toBe(2);
    // EXTH 121 (KF8 boundary) should be 0 for KF8-only output
    const exthOffset = mobiOffset + view.getUint32(mobiOffset + 4, false);
    const exthRecordCount = view.getUint32(exthOffset + 8, false);
    let foundExth121 = false;
    let exthCursor = exthOffset + 12;
    for (let recordIndex = 0; recordIndex < exthRecordCount; recordIndex += 1) {
      const exthType = view.getUint32(exthCursor, false);
      const exthSize = view.getUint32(exthCursor + 4, false);
      if (exthType === 121) {
        expect(view.getUint32(exthCursor + 8, false)).toBe(0);
        foundExth121 = true;
      }
      exthCursor += exthSize;
    }
    expect(foundExth121).toBe(true);
    expect(result.exportReport.stats.chapterCount).toBe(2);
    expect(result.exportReport.stats.fragmentCount).toBe(2);
    expect(result.exportReport.stats.backend).toBe("lyceum-manual");
  });

  it("uses navigation titles instead of placeholder EPUB titles before AZW3 export", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lyceum-test-"));
    const sourcePath = path.join(tempDir, "placeholder.epub");
    const packageRoot = path.join(tempDir, "placeholder.lyceum");
    const outputPath = path.join(tempDir, "placeholder.azw3");
    fs.writeFileSync(sourcePath, Buffer.from(await buildPlaceholderTitleEpub()));

    const result = await convertViaLyceum({
      sourcePath,
      sourceFormat: "epub",
      targetFormat: "azw3",
      packageRoot,
      outputPath,
    });
    const pkg = readLyceumPackage(result.packageRoot);
    const validation = validateAzw3File(outputPath);

    expect(pkg.textual?.chapters[0].title).toBe("Nome Real do Capitulo");
    expect(pkg.textual?.chapters[0].xhtml).not.toContain("&nbsp;");
    expect(validation.valid).toBe(true);
    expect(validation.metadata.compression).toBe(2);
    expect(result.exportReport.stats.backend).toBe("lyceum-manual");
  });

  it("writes Calibre-like NCX hierarchy tags for nested AZW3 navigation", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lyceum-ncx-"));
    const sourcePath = path.join(tempDir, "rich.epub");
    const packageRoot = path.join(tempDir, "rich.lyceum");
    const outputPath = path.join(tempDir, "rich.azw3");
    fs.writeFileSync(sourcePath, Buffer.from(await buildRichEpub()));

    const result = await convertViaLyceum({
      sourcePath,
      sourceFormat: "epub",
      targetFormat: "azw3",
      packageRoot,
      outputPath,
    });
    const validation = validateAzw3File(outputPath);
    const azw3Buffer = fs.readFileSync(outputPath);
    const ncxPrimary = readPdbRecord(
      azw3Buffer,
      validation.metadata.ncxIndexRecord!,
      validation.metadata.recordCount!,
    );
    const tagxOffset = ncxPrimary.readUInt32BE(180);
    const tagxLength = ncxPrimary.readUInt32BE(tagxOffset + 4);
    const tagxBody = ncxPrimary.subarray(tagxOffset + 12, tagxOffset + tagxLength);

    expect(validation.valid).toBe(true);
    expect(result.exportReport.stats.maxTocDepth).toBe(2);
    expect(result.exportReport.stats.extraDataFlags).toBe(3);
    expect(result.exportReport.stats.tbsRecordCount).toBeGreaterThan(0);
    expect(Array.from(tagxBody)).toEqual([
      1, 1, 1, 0,
      2, 1, 2, 0,
      3, 1, 4, 0,
      4, 1, 8, 0,
      21, 1, 16, 0,
      22, 1, 32, 0,
      23, 1, 64, 0,
      6, 2, 128, 0,
      0, 0, 0, 1,
    ]);
  });

  it("rewrites EPUB internal links to Kindle position links before AZW3 export", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lyceum-links-"));
    const sourcePath = path.join(tempDir, "links.epub");
    const packageRoot = path.join(tempDir, "links.lyceum");
    const outputPath = path.join(tempDir, "links.azw3");
    fs.writeFileSync(sourcePath, Buffer.from(await buildInternalLinksEpub()));

    const result = await convertViaLyceum({
      sourcePath,
      sourceFormat: "epub",
      targetFormat: "azw3",
      packageRoot,
      outputPath,
    });
    const validation = validateAzw3File(outputPath);

    expect(validation.valid).toBe(true);
    expect(validation.metadata.rawInternalHrefCount).toBe(0);
    expect(validation.metadata.kindlePositionLinkCount).toBeGreaterThanOrEqual(2);
    expect(result.exportReport.stats.rawInternalHrefCount).toBe(0);
    expect(result.exportReport.stats.kindlePositionLinkCount).toBeGreaterThanOrEqual(2);
    expect(result.exportReport.stats.unresolvedInternalLinkCount).toBe(0);
  });
});
