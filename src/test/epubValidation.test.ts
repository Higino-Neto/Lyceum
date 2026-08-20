import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { sanitizeHtmlDocument, validateXhtmlDocument } from "../lib/lyceum/epub/htmlSanitizer";
import { validateEpubBuffer } from "../lib/lyceum/epub/epubValidator";

describe("EPUB XHTML validation", () => {
  it("serializes HTML void elements as valid XML", () => {
    const result = sanitizeHtmlDocument(
      '<html><head><link rel="stylesheet" href="book.css"><meta charset="utf-8"></head><body><img src="cover.jpg"></body></html>',
      "Livro",
    );

    expect(validateXhtmlDocument(result.xhtml)).toEqual({ valid: true });
    expect(result.xhtml).toMatch(/<link[^>]+\/>/);
    expect(result.xhtml).toMatch(/<meta[^>]+\/>/);
    expect(result.xhtml).toMatch(/<img[^>]+\/>/);
  });

  it("rejects the link/head mismatch reported by XML readers", () => {
    const invalid = '<html xmlns="http://www.w3.org/1999/xhtml"><head><link href="book.css"></head><body></body></html>';
    expect(validateXhtmlDocument(invalid).valid).toBe(false);
  });

  it("finds missing manifest resources and broken XHTML references", async () => {
    const zip = new JSZip();
    zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
    zip.file("META-INF/container.xml", '<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
    zip.file("OEBPS/content.opf", '<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Teste</dc:title></metadata><manifest><item id="c" href="c.xhtml" media-type="application/xhtml+xml"/><item id="missing" href="missing.jpg" media-type="image/jpeg"/></manifest><spine><itemref idref="c"/></spine></package>');
    zip.file("OEBPS/c.xhtml", '<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Teste</title></head><body><img src="other.jpg" /></body></html>');

    const result = await validateEpubBuffer(await zip.generateAsync({ type: "uint8array" }));
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.stringContaining("missing.jpg"),
      expect.stringContaining("other.jpg"),
    ]));
  });
});
