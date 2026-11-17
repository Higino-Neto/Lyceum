import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findThumbnailByHash, pruneOrphanThumbnails } from "./document-processing";

let dir: string;
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);
const DAY = 24 * 60 * 60 * 1000;

function write(name: string, ageMs = 2 * DAY) {
  const file = path.join(dir, name);
  fs.writeFileSync(file, "x");
  const time = new Date(Date.now() - ageMs);
  fs.utimesSync(file, time, time);
  return file;
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "lyceum-thumbs-"));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("thumbnail maintenance", () => {
  it("finds a thumbnail by hash through the known file name or a scan", () => {
    const webp = write(`${HASH_A}-thumb.webp`);
    const custom = write(`${HASH_B}-custom.jpeg`);
    expect(findThumbnailByHash(dir, HASH_A)).toBe(webp);
    expect(findThumbnailByHash(dir, HASH_B)).toBe(custom);
    expect(findThumbnailByHash(dir, HASH_C)).toBeNull();
  });

  it("removes only old thumbnails that nothing references", async () => {
    const referenced = write(`${HASH_A}-thumb.webp`);
    write(`${HASH_B}-thumb.webp`); // kept: its hash still belongs to a document
    write(`${HASH_C}-thumb.webp`); // orphan
    write(`${"d".repeat(64)}-thumb.webp`, 60 * 1000); // orphan, but too recent
    write("notes.txt"); // not a thumbnail

    const result = await pruneOrphanThumbnails({ thumbnailsDir: dir, referencedPaths: [referenced, `${HASH_B}-*`, null] });

    expect(result.removed).toBe(1);
    expect(fs.readdirSync(dir).sort()).toEqual([
      `${HASH_A}-thumb.webp`,
      `${HASH_B}-thumb.webp`,
      `${"d".repeat(64)}-thumb.webp`,
      "notes.txt",
    ]);
  });

  it("is a no-op when the folder does not exist", async () => {
    await expect(pruneOrphanThumbnails({ thumbnailsDir: path.join(dir, "missing"), referencedPaths: [] }))
      .resolves.toEqual({ removed: 0, freedBytes: 0, kept: 0 });
  });
});
