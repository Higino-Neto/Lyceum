import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { convertEpubToPdf } from "../lib/epub-to-pdf";

const ONE_PIXEL_PNG = Uint8Array.from(Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
));

async function buildEpub(files: Record<string, string | Uint8Array>, opf?: string) {
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
    opf || `<?xml version="1.0" encoding="UTF-8"?>
      <package version="3.0" xmlns="http://www.idpf.org/2007/opf">
        <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
          <dc:title>Livro Robusto</dc:title>
          <dc:creator>Autora Teste</dc:creator>
          <dc:language>pt-BR</dc:language>
        </metadata>
        <manifest>
          <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
          <item id="chap1" href="text/ch1.xhtml" media-type="application/xhtml+xml"/>
          <item id="chap2" href="text/ch2.xhtml" media-type="application/xhtml+xml"/>
          <item id="pixel" href="images/pixel.png" media-type="image/png"/>
        </manifest>
        <spine>
          <itemref idref="nav"/>
          <itemref idref="chap1"/>
          <itemref idref="chap2"/>
        </spine>
      </package>`,
  );

  for (const [path, content] of Object.entries(files)) {
    zip.file(path, content);
  }

  return zip.generateAsync({ type: "uint8array", mimeType: "application/epub+zip" });
}

describe("epub-to-pdf pipeline", () => {
  it("uses the EPUB spine order, skips nav documents, and produces a readable PDF", async () => {
    const epub = await buildEpub({
      "OEBPS/nav.xhtml": "<html><body><nav epub:type=\"toc\"><ol><li>TOC</li></ol></nav></body></html>",
      "OEBPS/text/ch1.xhtml": "<html><body><h1>Capítulo 1</h1><p>Primeiro parágrafo com acentuação &amp; entidades.</p></body></html>",
      "OEBPS/text/ch2.xhtml": "<html><body><h2>Capítulo 2</h2><ul><li>Item importante</li></ul><p>Texto final.</p></body></html>",
      "OEBPS/images/pixel.png": ONE_PIXEL_PNG,
    });

    const result = await convertEpubToPdf(epub);
    const pdf = await PDFDocument.load(result.pdf);

    expect(result.report.chapterCount).toBe(2);
    expect(result.report.wordCount).toBeGreaterThan(8);
    expect(result.report.warnings).toEqual([]);
    expect(pdf.getPageCount()).toBe(result.report.pageCount);
  });

  it("embeds supported images and reports missing images without failing", async () => {
    const epub = await buildEpub({
      "OEBPS/nav.xhtml": "<html><body><nav epub:type=\"toc\"><ol><li>TOC</li></ol></nav></body></html>",
      "OEBPS/text/ch1.xhtml": '<html><body><p>Antes da imagem.</p><img src="../images/pixel.png" /><img src="../images/missing.jpg" /></body></html>',
      "OEBPS/text/ch2.xhtml": "<html><body><p>Depois da imagem.</p></body></html>",
      "OEBPS/images/pixel.png": ONE_PIXEL_PNG,
    });

    const result = await convertEpubToPdf(epub);

    expect(result.report.imageCount).toBe(1);
    expect(result.report.skippedImageCount).toBe(1);
    expect(result.report.warnings.some((warning) => warning.includes("Imagem não encontrada"))).toBe(true);
  });

  it("falls back to manifest HTML documents when the spine is empty", async () => {
    const opf = `<?xml version="1.0" encoding="UTF-8"?>
      <package version="3.0" xmlns="http://www.idpf.org/2007/opf">
        <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
          <dc:title>Sem Spine</dc:title>
        </metadata>
        <manifest>
          <item id="chap1" href="text/ch1.xhtml" media-type="application/xhtml+xml"/>
        </manifest>
        <spine />
      </package>`;
    const epub = await buildEpub({
      "OEBPS/text/ch1.xhtml": "<html><body><p>Conteúdo recuperado pelo manifesto.</p></body></html>",
    }, opf);

    const result = await convertEpubToPdf(epub);

    expect(result.report.chapterCount).toBe(1);
    expect(result.report.warnings).toContain("Spine ausente ou vazio; usando documentos HTML do manifesto.");
  });
});
