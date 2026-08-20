import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { HtmlExporter } from "../lib/lyceum/exporters/htmlExporter";
import type { LyceumPackage } from "../lib/lyceum/schema/types";

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("HTML print export", () => {
  it("preserves linked CSS, inline styles and chapter resources for Chromium printing", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "lyceum-html-print-"));
    tempRoots.push(root);
    const outputPath = path.join(root, "book.html");
    const pkg: LyceumPackage = {
      rootPath: root,
      manifest: {
        schemaVersion: 1,
        packageId: "print-test",
        title: "Livro",
        sourceFormat: "epub",
        originalFileName: "book.epub",
        primaryContentKind: "textual",
        contentKinds: ["textual"],
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
      },
      metadata: { title: "Livro", language: "pt-BR" },
      textual: {
        chapters: [{
          id: "chapter-1",
          href: "text/chapter.xhtml",
          title: "Capitulo",
          xhtml: '<html><head><style>.special { color: red; }</style><link rel="stylesheet" href="../styles/book.css" /></head><body><h1>Capitulo</h1><img src="../images/cover.png" /></body></html>',
        }],
        spine: [{ id: "chapter-1", href: "text/chapter.xhtml", title: "Capitulo" }],
        toc: [{ id: "chapter-1", href: "text/chapter.xhtml", title: "Capitulo", level: 1 }],
        fulltext: "Capitulo",
        resources: [
          { id: "css", href: "styles/book.css", mediaType: "text/css", data: new TextEncoder().encode("body { font-family: serif; }") },
          { id: "cover", href: "images/cover.png", mediaType: "image/png", data: new Uint8Array([1, 2, 3]) },
        ],
      },
    };

    const result = await new HtmlExporter().export({ package: pkg, outputPath });
    const html = fs.readFileSync(outputPath, "utf8");

    expect(html).toContain('href="book_files/styles/book.css"');
    expect(html).toContain('src="book_files/images/cover.png"');
    expect(html).toContain(".special { color: red; }");
    expect(html).toContain("break-before: page");
    expect(result.report.stats).toMatchObject({ printReady: true, stylesheetCount: 1 });
  });
});
