// @vitest-environment node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PDFDocument, rgb } from "pdf-lib";
import { afterEach, describe, expect, it } from "vitest";
import { renderPdfPageToPng } from "./pdf-page-renderer";

let tempDir: string | null = null;

afterEach(() => {
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  tempDir = null;
});

describe("PDF page renderer", () => {
  it("renders a PDF page without a platform-specific Poppler binary", async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lyceum-pdf-render-"));
    const pdfPath = path.join(tempDir, "pagina-com-acentuacao.pdf");
    const document = await PDFDocument.create();
    const page = document.addPage([320, 480]);
    page.drawRectangle({ x: 20, y: 20, width: 280, height: 440, color: rgb(0.2, 0.4, 0.8) });
    fs.writeFileSync(pdfPath, await document.save());

    const rendered = await renderPdfPageToPng(pdfPath, 1, { scale: 1, maxDimension: 1000 });

    expect(rendered.width).toBe(320);
    expect(rendered.height).toBe(480);
    expect(rendered.data.subarray(1, 4).toString("ascii")).toBe("PNG");
  });
});
