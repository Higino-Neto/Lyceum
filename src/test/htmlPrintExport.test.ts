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
          xhtml: '<html><head><style>.special { color: red; }</style><link rel="stylesheet" href="../styles/book.css" /></head><body><h1 id="start">Capitulo</h1><p>Primeiro paragrafo.</p><a href="second.xhtml#details">Proximo</a><img src="../images/cover.png" /></body></html>',
        }, {
          id: "chapter-2",
          href: "text/second.xhtml",
          title: "Secao seguinte",
          xhtml: '<html><body><h1 id="details">Secao seguinte</h1><a href="chapter.xhtml#start">Voltar</a><p>Segundo paragrafo.</p></body></html>',
        }],
        spine: [
          { id: "chapter-1", href: "text/chapter.xhtml", title: "Capitulo" },
          { id: "chapter-2", href: "text/second.xhtml", title: "Secao seguinte" },
        ],
        toc: [
          { id: "chapter-1", href: "text/chapter.xhtml#start", title: "Capitulo", level: 1 },
          { id: "chapter-2", href: "text/second.xhtml#details", title: "Secao seguinte", level: 2 },
        ],
        fulltext: "Capitulo",
        resources: [
          { id: "css", href: "styles/book.css", mediaType: "text/css", data: new TextEncoder().encode("body { font-family: serif; }") },
          { id: "cover", href: "images/cover.png", mediaType: "image/png", data: new Uint8Array([1, 2, 3]) },
        ],
      },
    };

    const result = await new HtmlExporter().export({
      package: pkg,
      outputPath,
      conversionOptions: {
        pdfPageSize: "Letter",
        pdfMarginTopMm: 20,
        pdfMarginRightMm: 21,
        pdfMarginBottomMm: 22,
        pdfMarginLeftMm: 23,
        pdfLineHeight: 1.7,
        pdfParagraphSpacingEm: 1.1,
      },
    });
    const html = fs.readFileSync(outputPath, "utf8");

    expect(html).toContain('href="book_files/styles/book.css"');
    expect(html).toContain('src="book_files/images/cover.png"');
    expect(html).toContain(".special { color: red; }");
    expect(html).toContain("break-before: page");
    expect(html).toContain("@page { size: Letter; margin: 20mm 21mm 22mm 23mm; }");
    expect(html).toContain("margin-bottom: 1.1em !important");
    expect(html).toContain('href="#lyceum-chapter-2--details"');
    expect(html).toContain('id="lyceum-chapter-2--details"');
    expect(html).not.toContain('class="lyceum-toc"');
    expect(html).not.toContain(">Sumario<");
    expect(html.match(/>Capitulo<\/h1>/g)).toHaveLength(1);
    expect(result.report.stats).toMatchObject({ printReady: true, stylesheetCount: 1, tocItemCount: 2, internalLinkMapping: true });
  });

  it("does not invent a heading for cover or headingless chapters", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "lyceum-html-cover-"));
    tempRoots.push(root);
    const outputPath = path.join(root, "book.html");
    const pkg: LyceumPackage = {
      rootPath: root,
      manifest: {
        schemaVersion: 1, packageId: "cover-test", title: "Livro", sourceFormat: "epub",
        originalFileName: "book.epub", primaryContentKind: "textual", contentKinds: ["textual"],
        createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString(),
      },
      metadata: { title: "Livro", language: "pt-BR" },
      textual: {
        chapters: [{ id: "cover", href: "cover.xhtml", title: "Cover", xhtml: "<html><body><img src=\"cover.jpg\" /></body></html>" }],
        spine: [{ id: "cover", href: "cover.xhtml", title: "Cover" }],
        toc: [], fulltext: "", resources: [{ id: "cover-image", href: "cover.jpg", mediaType: "image/jpeg", data: new Uint8Array([1]) }],
      },
    };

    await new HtmlExporter().export({ package: pkg, outputPath });
    const html = fs.readFileSync(outputPath, "utf8");
    expect(html).not.toContain(">Cover</h1>");
    expect(html).toContain('<img src="book_files/cover.jpg">');
  });
});
