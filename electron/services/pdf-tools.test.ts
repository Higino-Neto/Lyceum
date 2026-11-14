// @vitest-environment node

import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import AdmZip from "adm-zip";
import { PDFDocument, degrees } from "pdf-lib";
import { afterEach, describe, expect, it } from "vitest";
import { imagesToCbz, imagesToPdf, mergePdfs, organizePdf } from "./pdf-tools";

const require = createRequire(import.meta.url);
const sharp = require("sharp") as typeof import("sharp");

let tempDir: string | null = null;

function makeTempDir() {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lyceum-pdf-tools-"));
  return tempDir;
}

afterEach(() => {
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  tempDir = null;
});

async function writeImage(dir: string, name: string, width: number, height: number, alpha = false) {
  const filePath = path.join(dir, name);
  await sharp({ create: { width, height, channels: alpha ? 4 : 3, background: alpha ? { r: 255, g: 0, b: 0, alpha: 0.5 } : "#3366cc" } })
    .toFile(filePath);
  return filePath;
}

async function writePdf(dir: string, name: string, pageSizes: Array<[number, number]>) {
  const pdf = await PDFDocument.create();
  for (const size of pageSizes) pdf.addPage(size);
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, await pdf.save());
  return filePath;
}

describe("pdf tools", () => {
  it("builds a PDF from images, fitting fixed page sizes by orientation", async () => {
    const dir = makeTempDir();
    const portrait = await writeImage(dir, "a.jpg", 300, 600);
    const landscape = await writeImage(dir, "b.png", 800, 400, true);
    const outputPath = path.join(dir, "out.pdf");

    const result = await imagesToPdf({ imagePaths: [portrait, landscape], outputPath, pageSize: "A4", marginMm: 10, title: "Scans" });
    expect(result.pageCount).toBe(2);

    const pdf = await PDFDocument.load(fs.readFileSync(outputPath));
    expect(pdf.getTitle()).toBe("Scans");
    const [first, second] = pdf.getPages();
    expect(first!.getWidth()).toBeLessThan(first!.getHeight());
    expect(second!.getWidth()).toBeGreaterThan(second!.getHeight());
  });

  it("uses the image size for image-sized pages", async () => {
    const dir = makeTempDir();
    const image = await writeImage(dir, "a.webp", 150, 300);
    const outputPath = path.join(dir, "out.pdf");
    await imagesToPdf({ imagePaths: [image], outputPath, pageSize: "image" });
    const page = (await PDFDocument.load(fs.readFileSync(outputPath))).getPage(0);
    expect(page.getWidth()).toBeCloseTo(72, 0);
    expect(page.getHeight()).toBeCloseTo(144, 0);
  });

  it("packs images into a CBZ in list order with ComicInfo", async () => {
    const dir = makeTempDir();
    const second = await writeImage(dir, "z.png", 10, 10);
    const first = await writeImage(dir, "a.tiff", 10, 10);
    const outputPath = path.join(dir, "out.cbz");
    await imagesToCbz({ imagePaths: [second, first], outputPath, title: "Comic" });
    const names = new AdmZip(outputPath).getEntries().map((entry) => entry.entryName).sort();
    expect(names).toEqual(["001.png", "002.jpg", "ComicInfo.xml"]);
  });

  it("merges PDFs in order", async () => {
    const dir = makeTempDir();
    const a = await writePdf(dir, "a.pdf", [[100, 100]]);
    const b = await writePdf(dir, "b.pdf", [[200, 200], [300, 300]]);
    const outputPath = path.join(dir, "merged.pdf");
    const result = await mergePdfs({ inputPaths: [b, a], outputPath });
    expect(result.pageCount).toBe(3);
    const widths = (await PDFDocument.load(fs.readFileSync(outputPath))).getPages().map((page) => page.getWidth());
    expect(widths).toEqual([200, 300, 100]);
  });

  it("reorders, drops and rotates pages without touching the source", async () => {
    const dir = makeTempDir();
    const source = await writePdf(dir, "src.pdf", [[100, 100], [200, 200], [300, 300]]);
    const before = fs.readFileSync(source);
    const outputPath = path.join(dir, "organized.pdf");
    await organizePdf({ inputPath: source, outputPath, pages: [{ index: 2, rotation: 90 }, { index: 0, rotation: 0 }] });

    const pages = (await PDFDocument.load(fs.readFileSync(outputPath))).getPages();
    expect(pages.map((page) => page.getWidth())).toEqual([300, 100]);
    expect(pages[0]!.getRotation()).toEqual(degrees(90));
    expect(fs.readFileSync(source).equals(before)).toBe(true);
  });

  it("rejects invalid page selections", async () => {
    const dir = makeTempDir();
    const source = await writePdf(dir, "src.pdf", [[100, 100]]);
    await expect(organizePdf({ inputPath: source, outputPath: path.join(dir, "o.pdf"), pages: [{ index: 3, rotation: 0 }] })).rejects.toThrow();
    await expect(organizePdf({ inputPath: source, outputPath: path.join(dir, "o.pdf"), pages: [] })).rejects.toThrow();
  });
});
