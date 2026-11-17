import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { readEpubChapters, readTextChapters, resolveZipPath } from "../../features/language-learning/browser/sourceChapters";
import { analyzeBook } from "../../features/language-learning/browser/analyzeBook";

async function buildEpub() {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip");
  zip.file("META-INF/container.xml", `<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`);
  zip.file("OEBPS/content.opf", `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Le Petit Livre</dc:title><dc:language>pt</dc:language></metadata>
  <manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="c1" href="text/c1.xhtml" media-type="application/xhtml+xml"/><item id="c2" href="text/c2.xhtml" media-type="application/xhtml+xml"/><item id="css" href="style.css" media-type="text/css"/></manifest>
  <spine><itemref idref="c1"/><itemref idref="c2"/></spine></package>`);
  zip.file("OEBPS/nav.xhtml", `<html xmlns:epub="http://www.idpf.org/2007/ops"><body><nav epub:type="toc"><ol><li><a href="text/c1.xhtml">Premier chapitre</a></li><li><a href="text/c2.xhtml#part">Deuxième chapitre</a></li></ol></nav></body></html>`);
  const french = "Le chat dort dans la maison. Il fait beau aujourd'hui et nous allons à la plage avec les enfants. Je ne sais pas pourquoi elle est partie si tôt ce matin.";
  zip.file("OEBPS/text/c1.xhtml", `<html><body><h1>Premier chapitre</h1><p>${french}</p><p>${french}</p></body></html>`);
  zip.file("OEBPS/text/c2.xhtml", `<html><body><h1>Deuxième</h1><p>${french} Les maisons sont grandes.</p></body></html>`);
  return zip.generateAsync({ type: "uint8array" });
}

describe("browser learning preparation", () => {
  it("resolves zip paths safely", () => {
    expect(resolveZipPath("OEBPS/", "text/../text/c1.xhtml#x")).toBe("OEBPS/text/c1.xhtml");
    expect(resolveZipPath("OEBPS/", "../../etc%20x.xhtml")).toBe("etc x.xhtml");
  });

  it("reads an EPUB 3 in spine order with nav titles, and detects the language from the text", async () => {
    const book = await readEpubChapters(await buildEpub(), "fallback");
    expect(book.title).toBe("Le Petit Livre");
    expect(book.chapters.map((chapter) => [chapter.id, chapter.title])).toEqual([["c1", "Premier chapitre"], ["c2", "Deuxième chapitre"]]);

    const result = analyzeBook({ documentId: "mobile:x", book });
    // The OPF says "pt" (a common import default); the text is French.
    expect(result.metadataLanguage).toBe("pt");
    expect(result.document.language).toBe("fr");
    expect(result.document.chapters).toHaveLength(2);
    expect(result.document.totals.tokens).toBeGreaterThan(60);
  });

  it("splits plain text into chapters", () => {
    const text = "Chapitre 1\n\nLe chat dort.\n\nChapitre 2\n\nIl fait beau.";
    const book = readTextChapters(new TextEncoder().encode(text), "Livre");
    expect(book.chapters.map((chapter) => chapter.title)).toEqual(["Chapitre 1", "Chapitre 2"]);
  });
});

describe("language codes", () => {
  it("maps ISO 639-2/3 codes and names to the code vocabulary is filed under", async () => {
    const { normalizeLanguageCode } = await import("../../core/language-learning/languages/registry");
    expect(["fre", "fra", "FR-ca", "French", "français"].map(normalizeLanguageCode)).toEqual(["fr", "fr", "fr", "fr", "fr"]);
    expect(["pt-BR", "por", "ger", "deu", "und", ""].map(normalizeLanguageCode)).toEqual(["pt", "pt", "de", "de", "und", "und"]);
  });
});
