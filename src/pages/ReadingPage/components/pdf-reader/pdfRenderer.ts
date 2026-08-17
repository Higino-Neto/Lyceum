export type PdfRenderer = "pdfjs";

export const DEFAULT_PDF_RENDERER: PdfRenderer = "pdfjs";

const PDF_HASH_PATTERN = /^[a-f0-9]{64}$/i;

export function normalizePdfRenderer(value?: string | null): PdfRenderer {
  return "pdfjs";
}

export function createPdfJsSourceUrl(fileHash: string): string | null {
  if (!PDF_HASH_PATTERN.test(fileHash)) {
    return null;
  }

  return `lyceum-pdf://document/${fileHash}.pdf`;
}

export function createPdfJsViewerUrl(options: {
  fileHash: string;
  fileName?: string;
}): { viewerUrl: string; sourceUrl: string } | null {
  const sourceUrl = createPdfJsSourceUrl(options.fileHash);
  if (!sourceUrl) {
    return null;
  }

  const viewerUrl = new URL("lyceum-pdfjs://viewer/web/viewer.html");
  viewerUrl.searchParams.set("file", sourceUrl);
  viewerUrl.searchParams.set("disablehistory", "true");

  if (options.fileName) {
    viewerUrl.searchParams.set("title", options.fileName);
  }

  return {
    viewerUrl: viewerUrl.toString(),
    sourceUrl,
  };
}
