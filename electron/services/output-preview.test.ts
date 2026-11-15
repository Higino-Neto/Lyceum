// @vitest-environment node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OutputPreviewService, type OutputPreviewDependencies } from "./output-preview";

let tempDir: string | null = null;

afterEach(() => {
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  tempDir = null;
});

function setup() {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lyceum-output-preview-service-"));
  const source = path.join(tempDir, "book.epub");
  fs.writeFileSync(source, "epub");
  const exportSlice = vi.fn(async (input: Parameters<OutputPreviewDependencies["exportSlice"]>[0]) => {
    await fs.promises.mkdir(input.outputDir, { recursive: true });
    const outputPath = path.join(input.outputDir, "preview.html");
    await fs.promises.writeFile(outputPath, "<p>chapter</p>");
    return { kind: "html" as const, outputPath, segmentKind: "chapter" as const, segmentIndex: Math.min(input.segmentIndex, 4), segmentCount: 5, segmentTitle: "Capitulo", fixedLayout: false };
  });
  const printHtmlToPdf = vi.fn(async (_html: string, outputPath: string) => {
    const pdf = await PDFDocument.create();
    pdf.addPage();
    pdf.addPage();
    pdf.addPage();
    await fs.promises.writeFile(outputPath, await pdf.save());
  });
  const renderPdfPage = vi.fn(async (_pdf: string, page: number) => ({ dataUrl: `data:page-${page}`, width: 100, height: 140 }));
  const service = new OutputPreviewService({
    tempRoot: tempDir,
    exportSlice,
    printHtmlToPdf,
    renderPdfPage,
    createWindow: () => { throw new Error("not used for PDF"); },
    previewSession: () => { throw new Error("not used for PDF"); },
  });
  return { service, source, exportSlice, printHtmlToPdf, renderPdfPage };
}

describe("OutputPreviewService (PDF target)", () => {
  it("prints the chapter once, clamps the page and reuses the slice while paging", async () => {
    const { service, source, exportSlice, printHtmlToPdf, renderPdfPage } = setup();

    const first = await service.render(source, "epub", { targetFormat: "pdf", segmentIndex: 2, page: 1 });
    expect(first).toMatchObject({ page: 1, pageCount: 3, segmentIndex: 2, segmentCount: 5, dataUrl: "data:page-1", viewport: { label: "A4" } });

    const last = await service.render(source, "epub", { targetFormat: "pdf", segmentIndex: 2, page: 9 });
    expect(last.page).toBe(3);
    expect(renderPdfPage).toHaveBeenLastCalledWith(expect.stringMatching(/preview\.pdf$/), 3);
    expect(exportSlice).toHaveBeenCalledTimes(1);
    expect(printHtmlToPdf).toHaveBeenCalledTimes(1);

    // Changing an option produces a new slice.
    await service.render(source, "epub", { targetFormat: "pdf", segmentIndex: 2, page: 1, conversionOptions: { pdfFontSizePt: 14 } });
    expect(exportSlice).toHaveBeenCalledTimes(2);
    service.dispose();
  });

  it("refuses the .lyceum target", async () => {
    const { service, source } = setup();
    await expect(service.render(source, "epub", { targetFormat: "lyceum", segmentIndex: 0, page: 1 })).rejects.toThrow();
  });
});
