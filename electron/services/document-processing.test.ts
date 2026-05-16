// @vitest-environment node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import AdmZip from "adm-zip";
import { afterEach, describe, expect, it } from "vitest";
import {
  findThumbnailByHash,
  formatPdfDate,
  getEpubChapterCount,
} from "./document-processing";

let tempDir: string | null = null;

function makeTempDir() {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lyceum-document-processing-"));
  return tempDir;
}

afterEach(() => {
  if (tempDir) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

describe("document processing helpers", () => {
  it("normalizes PDF metadata dates", () => {
    expect(formatPdfDate(undefined)).toBeUndefined();
    expect(formatPdfDate("D:20240102030405")).toBe("2024-01-02T03:04:05");
    expect(formatPdfDate("D:2024")).toBe("2024-01-01T00:00:00");
    expect(formatPdfDate("not-a-pdf-date")).toBe("not-a-pdf-date");
  });

  it("finds an existing thumbnail by hash", () => {
    const dir = makeTempDir();
    const thumbnailPath = path.join(dir, "abc123-thumb.webp");
    fs.writeFileSync(thumbnailPath, "");
    fs.writeFileSync(path.join(dir, "other-thumb.webp"), "");

    expect(findThumbnailByHash(dir, "abc123")).toBe(thumbnailPath);
    expect(findThumbnailByHash(dir, "missing")).toBeNull();
  });

  it("counts EPUB html chapters", async () => {
    const dir = makeTempDir();
    const epubPath = path.join(dir, "book.epub");
    const zip = new AdmZip();
    zip.addFile("OPS/chapter-1.xhtml", Buffer.from("<html></html>"));
    zip.addFile("OPS/chapter-2.html", Buffer.from("<html></html>"));
    zip.addFile("OPS/image.jpg", Buffer.from(""));
    zip.writeZip(epubPath);

    await expect(getEpubChapterCount(epubPath)).resolves.toBe(2);
  });
});
