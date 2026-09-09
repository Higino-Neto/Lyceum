// @vitest-environment node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { create } from "tar";
import { afterEach, describe, expect, it } from "vitest";
import { extractNestedTarArchives } from "./dictionary-archive";

let tempDir: string | null = null;

afterEach(() => {
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  tempDir = null;
});

describe("dictionary archives", () => {
  it("extracts nested tar files without 7-Zip or shell commands", async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lyceum-dictionary-"));
    const sourceDir = path.join(tempDir, "source");
    const destinationDir = path.join(tempDir, "dictionary");
    fs.mkdirSync(sourceDir);
    fs.mkdirSync(destinationDir);
    fs.writeFileSync(path.join(sourceDir, "entries.dict"), "hello\tola");
    const archivePath = path.join(destinationDir, "payload.tar");
    await create({ cwd: sourceDir, file: archivePath }, ["entries.dict"]);

    await expect(extractNestedTarArchives(destinationDir)).resolves.toBe(1);
    expect(fs.readFileSync(path.join(destinationDir, "entries.dict"), "utf8")).toBe("hello\tola");
    expect(fs.existsSync(archivePath)).toBe(false);
  });
});
