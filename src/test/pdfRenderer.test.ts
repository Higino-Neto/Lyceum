import {
  createPdfJsSourceUrl,
  createPdfJsViewerUrl,
  normalizePdfRenderer,
} from "../pages/ReadingPage/components/pdf-reader/pdfRenderer";

describe("pdfRenderer utilities", () => {
  const fileHash = "a".repeat(64);

  it("normalizes unsupported renderer values to EmbedPDF", () => {
    expect(normalizePdfRenderer("pdfjs")).toBe("pdfjs");
    expect(normalizePdfRenderer("embedpdf")).toBe("embedpdf");
    expect(normalizePdfRenderer("file:///tmp/book.pdf")).toBe("embedpdf");
    expect(normalizePdfRenderer(null)).toBe("embedpdf");
  });

  it("creates controlled PDF.js source and viewer URLs from a document hash", () => {
    expect(createPdfJsSourceUrl(fileHash)).toBe(`lyceum-pdf://document/${fileHash}.pdf`);

    const urls = createPdfJsViewerUrl({
      fileHash,
      fileName: "Livro.pdf",
    });

    expect(urls?.sourceUrl).toBe(`lyceum-pdf://document/${fileHash}.pdf`);
    expect(urls?.viewerUrl).toContain("lyceum-pdfjs://viewer/web/viewer.html");
    expect(urls?.viewerUrl).toContain(encodeURIComponent(`lyceum-pdf://document/${fileHash}.pdf`));
    expect(urls?.viewerUrl).toContain("disablehistory=true");
  });

  it("rejects non-hash source identifiers", () => {
    expect(createPdfJsSourceUrl("C:/Users/test/book.pdf")).toBeNull();
    expect(createPdfJsViewerUrl({ fileHash: "../book.pdf" })).toBeNull();
  });
});
