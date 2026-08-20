import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { sanitizeCss } from "../lib/lyceum/epub/cssSanitizer";
import { sanitizeHtmlDocument, validateXhtmlDocument } from "../lib/lyceum/epub/htmlSanitizer";
import { validateEpubBuffer } from "../lib/lyceum/epub/epubValidator";

const HOSTILE_HTML = [
  '<html><body><p>Tag aberta<img src="x.png"><script>alert(1)</script></body>',
  '<!doctype html><html><head><link href="x.css"><meta charset="windows-1252"></head><body onload="bad()"><table><tr><td>A<td>B</table></body></html>',
  '<p>Entidades&nbsp;&copy;&ndash; e <ruby>漢<rt>kan</rt></ruby></p>',
  '<html><body><form><input value="segredo"></form><blockquote><strong>Texto</strong></blockquote></body></html>',
];

describe("conversion robustness corpus", () => {
  it.each(HOSTILE_HTML)("repairs malformed/active HTML into strict XHTML", (html) => {
    const result = sanitizeHtmlDocument(html, "Corpus");
    expect(validateXhtmlDocument(result.xhtml).valid).toBe(true);
    expect(result.xhtml).not.toMatch(/<(?:script|form|input)\b/i);
    expect(result.xhtml).not.toMatch(/\sonload=/i);
  });

  it("contains malformed CSS without throwing or leaking active values", () => {
    const corpus = [
      'p { color: red; background: url("javascript:alert(1)"); }',
      "@import url(missing.css); div { display: grid; position: fixed; margin: 1em; }",
      "a { color: blue; broken } } trailing",
    ];
    for (const css of corpus) {
      const result = sanitizeCss(css, { resolveImport: () => undefined, rewriteUrl: () => undefined });
      expect(result.css).not.toMatch(/javascript:|display:\s*grid|position:\s*fixed/i);
      expect(Array.isArray(result.warnings)).toBe(true);
    }
  });

  it("rejects broken cross-document anchors in an otherwise well-formed EPUB", async () => {
    const zip = new JSZip();
    zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
    zip.file("META-INF/container.xml", '<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OPS/book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
    zip.file("OPS/book.opf", '<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>T</dc:title></metadata><manifest><item id="a" href="a.xhtml" media-type="application/xhtml+xml"/><item id="b" href="b.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="a"/><itemref idref="b"/></spine></package>');
    zip.file("OPS/a.xhtml", '<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>A</title></head><body><a href="b.xhtml#missing">B</a></body></html>');
    zip.file("OPS/b.xhtml", '<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>B</title></head><body><h1 id="present">B</h1></body></html>');
    const validation = await validateEpubBuffer(await zip.generateAsync({ type: "uint8array" }));
    expect(validation.valid).toBe(false);
    expect(validation.errors.join("\n")).toContain("Anchor quebrado");
  });
});
