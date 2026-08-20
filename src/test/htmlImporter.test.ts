import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { convertViaLyceum, readLyceumPackage } from "../lib/lyceum";
import { validateEpubBuffer } from "../lib/lyceum/epub/epubValidator";

const tempRoots: string[] = [];
afterEach(() => tempRoots.splice(0).forEach((root) => fs.rmSync(root, { recursive: true, force: true })));

describe("HTML importer resources", () => {
  it("packages linked styles, imported CSS, background images, fonts and srcset", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "lyceum-html-import-"));
    tempRoots.push(root);
    fs.mkdirSync(path.join(root, "styles"));
    fs.mkdirSync(path.join(root, "images"));
    fs.mkdirSync(path.join(root, "fonts"));
    fs.writeFileSync(path.join(root, "book.html"), `<!doctype html><html><head><title>HTML rico</title><link rel="stylesheet" href="styles/book.css"></head><body><h1>Capitulo</h1><img src="images/a.png" srcset="images/a.png 1x, images/b.png 2x"></body></html>`);
    fs.writeFileSync(path.join(root, "styles", "book.css"), '@import "extra.css"; body { background: url("../images/b.png"); }');
    fs.writeFileSync(path.join(root, "styles", "extra.css"), '@font-face { font-family: Local; src: url("../fonts/local.woff2"); }');
    fs.writeFileSync(path.join(root, "images", "a.png"), Buffer.from([1, 2, 3]));
    fs.writeFileSync(path.join(root, "images", "b.png"), Buffer.from([4, 5, 6]));
    fs.writeFileSync(path.join(root, "fonts", "local.woff2"), Buffer.from([7, 8, 9]));
    const packageRoot = path.join(root, "package");
    const outputPath = path.join(root, "converted.epub");

    const result = await convertViaLyceum({
      sourcePath: path.join(root, "book.html"),
      sourceFormat: "html",
      targetFormat: "epub",
      packageRoot,
      outputPath,
    });
    const pkg = readLyceumPackage(packageRoot);

    expect(pkg.textual?.resources?.map((resource) => resource.href)).toEqual(expect.arrayContaining([
      "resources/styles/book.css",
      "resources/styles/extra.css",
      "resources/images/a.png",
      "resources/images/b.png",
      "resources/fonts/local.woff2",
    ]));
    expect(result.importReport.stats).toMatchObject({ packageValidated: true, resourceCount: 5 });
    expect((await validateEpubBuffer(fs.readFileSync(outputPath))).valid).toBe(true);
  });
});
