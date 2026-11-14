// @vitest-environment node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { convertViaLyceum } from "../lib/lyceum";
import { optimizeImageBytes, resolveImageSettings } from "../lib/lyceum/images/imageOptimizer";
import { KINDLE_IMAGE_PRESETS } from "../lib/lyceum/images/imagePresets";
import { renderConversionPreview, CONVERSION_PREVIEW_TEMP_PREFIX } from "../../electron/services/conversion-preview";

const tempDirs: string[] = [];

function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lyceum-img-opt-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

/** Colourful noise so compression differences are measurable. */
async function noiseImage(width: number, height: number, format: "png" | "jpeg", alpha = false) {
  const channels = alpha ? 4 : 3;
  const raw = Buffer.alloc(width * height * channels);
  let seed = 42;
  for (let index = 0; index < raw.length; index += 1) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    raw[index] = alpha && index % 4 === 3 ? 200 : (seed >> 16) & 0xff;
  }
  const image = sharp(raw, { raw: { width, height, channels } });
  return format === "png" ? image.png().toBuffer() : image.jpeg({ quality: 95 }).toBuffer();
}

async function writeCbz(dir: string, pages: Buffer[], extension: "png" | "jpg") {
  const zip = new JSZip();
  pages.forEach((page, index) => zip.file(`${String(index + 1).padStart(3, "0")}.${extension}`, page));
  const sourcePath = path.join(dir, "Manga.cbz");
  fs.writeFileSync(sourcePath, await zip.generateAsync({ type: "nodebuffer" }));
  return sourcePath;
}

describe("resolveImageSettings", () => {
  it("returns null when images are left untouched", () => {
    expect(resolveImageSettings(undefined)).toBeNull();
    expect(resolveImageSettings({})).toBeNull();
    expect(resolveImageSettings({ imagePreset: "original", imageGrayscale: false })).toBeNull();
  });

  it("supports grayscale without resizing", () => {
    expect(resolveImageSettings({ imagePreset: "original", imageGrayscale: true })).toMatchObject({
      maxWidth: null,
      maxHeight: null,
      grayscale: true,
    });
  });

  it("uses explicit values, falls back to the preset and clamps", () => {
    const preset = KINDLE_IMAGE_PRESETS["kindle-paperwhite"];
    expect(resolveImageSettings({ imagePreset: "kindle-paperwhite" })).toEqual({
      maxWidth: preset.maxWidth,
      maxHeight: preset.maxHeight,
      quality: preset.quality,
      grayscale: false,
    });
    expect(resolveImageSettings({ imagePreset: "custom", imageMaxWidth: 10, imageMaxHeight: 99999, imageQuality: 500 })).toMatchObject({
      maxWidth: 320,
      maxHeight: 8192,
      quality: 100,
    });
  });
});

describe("optimizeImageBytes", () => {
  it("fits the image inside the box without enlarging small images", async () => {
    const big = await noiseImage(2000, 3000, "jpeg");
    const result = await optimizeImageBytes(big, "image/jpeg", { maxWidth: 1000, maxHeight: 1000, quality: 80, grayscale: false });
    expect(result.width).toBeLessThanOrEqual(1000);
    expect(result.height).toBe(1000);

    const small = await noiseImage(200, 300, "jpeg");
    const kept = await optimizeImageBytes(small, "image/jpeg", { maxWidth: 1000, maxHeight: 1000, quality: 80, grayscale: false });
    expect(kept.width).toBe(200);
    expect(kept.height).toBe(300);
  });

  it("produces a single-channel JPEG in grayscale mode", async () => {
    const image = await noiseImage(400, 600, "png");
    const result = await optimizeImageBytes(image, "image/png", { maxWidth: null, maxHeight: null, quality: 80, grayscale: true });
    const meta = await sharp(result.data).metadata();
    expect(result.mediaType).toBe("image/jpeg");
    expect(meta.channels).toBe(1);
    expect(result.data.byteLength).toBeLessThan(image.byteLength);
  });

  it("lower quality yields fewer bytes", async () => {
    const image = await noiseImage(800, 1200, "jpeg");
    const high = await optimizeImageBytes(image, "image/jpeg", { maxWidth: 800, maxHeight: 800, quality: 95, grayscale: false });
    const low = await optimizeImageBytes(image, "image/jpeg", { maxWidth: 800, maxHeight: 800, quality: 40, grayscale: false });
    expect(low.data.byteLength).toBeLessThan(high.data.byteLength);
  });

  it("keeps PNG when the image has transparency", async () => {
    const image = await noiseImage(300, 300, "png", true);
    const result = await optimizeImageBytes(image, "image/png", { maxWidth: 200, maxHeight: 200, quality: 80, grayscale: false });
    expect(result.mediaType).toBe("image/png");
    expect((await sharp(result.data).metadata()).hasAlpha).toBe(true);
  });
});

describe("conversion with image optimization", () => {
  it("shrinks CBZ pages for EPUB and renames PNG resources to JPEG consistently", async () => {
    const dir = makeTempDir();
    const sourcePath = await writeCbz(dir, [await noiseImage(2400, 3400, "png"), await noiseImage(2400, 3400, "png")], "png");
    const plainOutput = path.join(dir, "plain.epub");
    const optimizedOutput = path.join(dir, "optimized.epub");

    await convertViaLyceum({ sourcePath, sourceFormat: "cbz", targetFormat: "epub", packageRoot: path.join(dir, "a.lyceum"), outputPath: plainOutput });
    await convertViaLyceum({
      sourcePath,
      sourceFormat: "cbz",
      targetFormat: "epub",
      packageRoot: path.join(dir, "b.lyceum"),
      outputPath: optimizedOutput,
      conversionOptions: { imagePreset: "kindle-paperwhite", imageMaxWidth: 1264, imageMaxHeight: 1680, imageQuality: 80, imageGrayscale: true },
    });

    expect(fs.statSync(optimizedOutput).size).toBeLessThan(fs.statSync(plainOutput).size / 2);

    const zip = await JSZip.loadAsync(fs.readFileSync(optimizedOutput));
    const imageEntries = Object.keys(zip.files).filter((name) => /\.(png|jpe?g)$/i.test(name));
    expect(imageEntries.length).toBeGreaterThanOrEqual(2);
    expect(imageEntries.every((name) => name.endsWith(".jpg"))).toBe(true);
    for (const name of imageEntries) {
      const meta = await sharp(await zip.file(name)!.async("nodebuffer")).metadata();
      expect(meta.width).toBeLessThanOrEqual(1264);
      expect(meta.height).toBeLessThanOrEqual(1680);
    }

    const opfName = Object.keys(zip.files).find((name) => name.endsWith(".opf"))!;
    const opf = await zip.file(opfName)!.async("string");
    expect(opf).not.toMatch(/\.png"/);
    const pageNames = Object.keys(zip.files).filter((name) => name.endsWith(".xhtml") && name.includes("page-"));
    for (const name of pageNames) {
      const xhtml = await zip.file(name)!.async("string");
      expect(xhtml).not.toMatch(/page-\d+\.png/);
    }
  });

  it("embeds the optimized pages in a comic PDF", async () => {
    const dir = makeTempDir();
    const sourcePath = await writeCbz(dir, [await noiseImage(2400, 3400, "jpeg")], "jpg");
    const outputPath = path.join(dir, "comic.pdf");
    await convertViaLyceum({
      sourcePath,
      sourceFormat: "cbz",
      targetFormat: "pdf",
      packageRoot: path.join(dir, "c.lyceum"),
      outputPath,
      conversionOptions: { imagePreset: "kindle-basic", imageMaxWidth: 1072, imageMaxHeight: 1448, imageQuality: 80, imageGrayscale: true },
    });
    const pdf = await PDFDocument.load(fs.readFileSync(outputPath));
    const [page] = pdf.getPages();
    expect(page.getWidth()).toBeLessThanOrEqual(1072);
    expect(page.getHeight()).toBeLessThanOrEqual(1448);
    expect(fs.statSync(outputPath).size).toBeLessThan(fs.statSync(sourcePath).size);
  });

  it("leaves images byte-identical when no image option is set", async () => {
    const dir = makeTempDir();
    const page = await noiseImage(500, 700, "jpeg");
    const sourcePath = await writeCbz(dir, [page], "jpg");
    const outputPath = path.join(dir, "same.epub");
    await convertViaLyceum({ sourcePath, sourceFormat: "cbz", targetFormat: "epub", packageRoot: path.join(dir, "d.lyceum"), outputPath, conversionOptions: { imagePreset: "original" } });
    const zip = await JSZip.loadAsync(fs.readFileSync(outputPath));
    const imageName = Object.keys(zip.files).find((name) => name.endsWith(".jpg"))!;
    expect(Buffer.compare(await zip.file(imageName)!.async("nodebuffer"), page)).toBe(0);
  });
});

describe("conversion preview", () => {
  it("renders the requested page and removes its temporary folder", async () => {
    const dir = makeTempDir();
    const tempRoot = path.join(dir, "tmp");
    const sourcePath = await writeCbz(dir, [await noiseImage(300, 400, "jpeg"), await noiseImage(2400, 3400, "png")], "png");

    const preview = await renderConversionPreview({
      sourcePath,
      sourceFormat: "cbz",
      pageIndex: 1,
      tempRoot,
      conversionOptions: { imagePreset: "kindle-paperwhite", imageMaxWidth: 1264, imageMaxHeight: 1680, imageQuality: 80, imageGrayscale: true },
    });

    expect(preview.pageIndex).toBe(1);
    expect(preview.pageCount).toBe(2);
    expect(preview.dataUrl.startsWith("data:image/jpeg;base64,")).toBe(true);
    expect(preview.height).toBeLessThanOrEqual(1680);
    expect(preview.bytes).toBeLessThan(preview.originalBytes);
    expect(preview.estimatedTotalBytes).toBeGreaterThan(0);
    expect(fs.readdirSync(tempRoot).filter((name) => name.startsWith(CONVERSION_PREVIEW_TEMP_PREFIX))).toEqual([]);
  });

  it("clamps an out-of-range page to the last one", async () => {
    const dir = makeTempDir();
    const sourcePath = await writeCbz(dir, [await noiseImage(100, 100, "jpeg")], "jpg");
    const preview = await renderConversionPreview({ sourcePath, sourceFormat: "cbz", pageIndex: 50, tempRoot: path.join(dir, "tmp") });
    expect(preview.pageIndex).toBe(0);
    expect(preview.optimized).toBe(false);
  });
});
