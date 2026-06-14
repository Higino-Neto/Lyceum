// @vitest-environment node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  convertViaLyceum,
  listTargetsForSourceFormat,
  parseCbzBuffer,
  readLyceumPackage,
  validateAzw3File,
} from "../lib/lyceum";

async function imageBuffer(format: "jpeg" | "png" | "webp" = "jpeg") {
  const image = sharp({
    create: {
      width: 8,
      height: 10,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  });

  if (format === "png") return image.png().toBuffer();
  if (format === "webp") return image.webp().toBuffer();
  return image.jpeg().toBuffer();
}

async function buildCbz(entries: Array<{ name: string; data: Buffer | string }>) {
  const zip = new JSZip();
  for (const entry of entries) {
    zip.file(entry.name, entry.data);
  }
  return zip.generateAsync({ type: "nodebuffer" });
}

describe("CBZ importer", () => {
  it("imports a valid CBZ with numbered pages into the Lyceum package", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lyceum-cbz-"));
    const sourcePath = path.join(tempDir, "Manga Test.cbz");
    const packageRoot = path.join(tempDir, "manga.lyceum");
    const outputPath = path.join(tempDir, "manga.epub");
    const jpg = await imageBuffer("jpeg");
    const png = await imageBuffer("png");
    fs.writeFileSync(sourcePath, await buildCbz([
      { name: "1.jpg", data: jpg },
      { name: "2.png", data: png },
    ]));

    const result = await convertViaLyceum({
      sourcePath,
      sourceFormat: "cbz",
      targetFormat: "epub",
      packageRoot,
      outputPath,
    });
    const pkg = readLyceumPackage(packageRoot);

    expect(result.importReport.sourceFormat).toBe("cbz");
    expect(pkg.manifest.sourceFormat).toBe("cbz");
    expect(pkg.manifest.primaryContentKind).toBe("comic");
    expect(pkg.metadata.title).toBe("Manga Test");
    expect(pkg.comic?.pageCount).toBe(2);
    expect(pkg.textual?.chapters).toHaveLength(2);
    expect(pkg.textual?.resources?.[0].properties).toContain("cover-image");
    expect(pkg.metadata.coverHref).toBe("images/page-0001.jpg");
    expect(pkg.metadata.coverPageHref).toBe("pages/page-0001.xhtml");
    expect(fs.existsSync(outputPath)).toBe(true);
  });

  it("converts CBZ through .lyceum into the reusable output formats", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lyceum-cbz-targets-"));
    const sourcePath = path.join(tempDir, "Comic.cbz");
    const jpg = await imageBuffer("jpeg");
    fs.writeFileSync(sourcePath, await buildCbz([
      { name: "page 1.jpg", data: jpg },
      { name: "page 2.jpg", data: jpg },
    ]));

    const targets = ["lyceum", "epub", "html", "txt", "pdf", "azw3"] as const;
    for (const targetFormat of targets) {
      const outputPath = path.join(tempDir, `comic.${targetFormat}`);
      const result = await convertViaLyceum({
        sourcePath,
        sourceFormat: "cbz",
        targetFormat,
        packageRoot: path.join(tempDir, `${targetFormat}.lyceum`),
        outputPath,
      });

      expect(result.importReport.stats.pageCount).toBe(2);
      expect(fs.existsSync(outputPath)).toBe(true);

      if (targetFormat === "lyceum") {
        expect(fs.statSync(outputPath).isDirectory()).toBe(true);
        expect(readLyceumPackage(outputPath).comic?.pageCount).toBe(2);
      } else if (targetFormat === "html") {
        const html = fs.readFileSync(outputPath, "utf8");
        expect(html).toContain("comic_files/images/page-0001.jpg");
        expect(fs.existsSync(path.join(tempDir, "comic_files", "images", "page-0001.jpg"))).toBe(true);
      } else if (targetFormat === "txt") {
        expect(fs.readFileSync(outputPath, "utf8")).toContain("Pagina 1");
      } else if (targetFormat === "pdf") {
        expect(fs.readFileSync(outputPath).subarray(0, 4).toString("ascii")).toBe("%PDF");
      } else if (targetFormat === "azw3") {
        const validation = validateAzw3File(outputPath);
        expect(validation.valid).toBe(true);
        expect(result.exportReport.stats.imageResourceCount).toBe(3);
        expect(result.exportReport.stats.thumbnailGenerated).toBe(true);
      } else {
        const zip = await JSZip.loadAsync(fs.readFileSync(outputPath));
        expect(zip.file("OEBPS/images/page-0001.jpg")).toBeTruthy();
        expect(await zip.file("OEBPS/content.opf")?.async("text")).toContain('name="cover"');
      }
    }
  });

  it("prepares non-Kindle CBZ images before AZW3 export", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lyceum-cbz-webp-"));
    const sourcePath = path.join(tempDir, "Web Comic.cbz");
    const outputPath = path.join(tempDir, "web-comic.azw3");
    fs.writeFileSync(sourcePath, await buildCbz([
      { name: "1.webp", data: await imageBuffer("webp") },
    ]));

    const result = await convertViaLyceum({
      sourcePath,
      sourceFormat: "cbz",
      targetFormat: "azw3",
      packageRoot: path.join(tempDir, "web-comic.lyceum"),
      outputPath,
    });
    const validation = validateAzw3File(outputPath);

    expect(validation.valid).toBe(true);
    expect(result.exportReport.stats.convertedImageCount).toBe(1);
    expect(result.exportReport.stats.thumbnailGenerated).toBe(true);
  });

  it("sorts pages with natural ordering", async () => {
    const jpg = await imageBuffer("jpeg");
    const parsed = await parseCbzBuffer(await buildCbz([
      { name: "10.jpg", data: jpg },
      { name: "2.jpg", data: jpg },
      { name: "1.jpg", data: jpg },
    ]));

    expect(parsed.comic.pages.map((page) => page.originalPath)).toEqual([
      "1.jpg",
      "2.jpg",
      "10.jpg",
    ]);
  });

  it("ignores non-image and metadata entries", async () => {
    const jpg = await imageBuffer("jpeg");
    const parsed = await parseCbzBuffer(await buildCbz([
      { name: "__MACOSX/._1.jpg", data: "metadata" },
      { name: ".DS_Store", data: "metadata" },
      { name: "Thumbs.db", data: "metadata" },
      { name: "notes.txt", data: "ignore me" },
      { name: "1.jpg", data: jpg },
    ]));

    expect(parsed.comic.pageCount).toBe(1);
    expect(parsed.ignoredEntryCount).toBe(4);
  });

  it("rejects an empty CBZ without supported images", async () => {
    await expect(parseCbzBuffer(await buildCbz([
      { name: "readme.txt", data: "no pages" },
    ]))).rejects.toThrow(/nenhuma imagem suportada/i);
  });

  it("rejects invalid or corrupted ZIP input", async () => {
    await expect(parseCbzBuffer(Buffer.from("not a zip"))).rejects.toThrow(/corrompido|zip/i);
  });

  it("blocks path traversal entries", async () => {
    const jpg = await imageBuffer("jpeg");
    await expect(parseCbzBuffer(await buildCbz([
      { name: "../evil.jpg", data: jpg },
    ]))).rejects.toThrow(/caminho inseguro/i);
  });

  it("preserves natural order for pages inside subfolders", async () => {
    const jpg = await imageBuffer("jpeg");
    const parsed = await parseCbzBuffer(await buildCbz([
      { name: "chapter 2/1.jpg", data: jpg },
      { name: "chapter 1/10.jpg", data: jpg },
      { name: "chapter 1/2.jpg", data: jpg },
      { name: "chapter 1/1.jpg", data: jpg },
    ]));

    expect(parsed.comic.pages.map((page) => page.originalPath)).toEqual([
      "chapter 1/1.jpg",
      "chapter 1/2.jpg",
      "chapter 1/10.jpg",
      "chapter 2/1.jpg",
    ]);
  });

  it("rejects image entries whose signature does not match the extension", async () => {
    await expect(parseCbzBuffer(await buildCbz([
      { name: "1.jpg", data: "plain text with jpg extension" },
    ]))).rejects.toThrow(/assinatura/i);
  });

  it("keeps existing EPUB conversion targets available", () => {
    expect(listTargetsForSourceFormat("epub").map((target) => target.format)).toEqual([
      "pdf",
      "txt",
      "html",
      "azw3",
      "kfx",
      "lyceum",
    ]);
    expect(listTargetsForSourceFormat("cbz").map((target) => target.format)).toContain("epub");
    expect(listTargetsForSourceFormat("cbz").map((target) => target.format)).toContain("lyceum");
  });
});
