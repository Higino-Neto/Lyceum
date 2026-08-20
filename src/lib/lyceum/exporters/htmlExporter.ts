import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";
import type { ExportInput, ExportResult, LyceumExporter, LyceumTextualResource } from "../schema/types";
import { mergeDefinedBookMetadata } from "../schema/manifest";
import { escapeXml } from "../textual";
import { textualResourcePath } from "../package/paths";

function normalizeHref(value: string) {
  const withoutQuery = value.split("#")[0].split("?")[0];
  const decoded = (() => {
    try {
      return decodeURIComponent(withoutQuery);
    } catch {
      return withoutQuery;
    }
  })();
  return path.posix.normalize(decoded.replace(/\\/g, "/")).replace(/^(\.\.\/)+/, "").replace(/^\.\//, "");
}

function resolveChapterHref(chapterHref: string, href: string) {
  if (/^(?:[a-z]+:|#)/i.test(href)) return null;
  const chapterDir = path.posix.dirname(chapterHref.replace(/\\/g, "/"));
  return normalizeHref(path.posix.join(chapterDir === "." ? "" : chapterDir, href));
}

function resourceData(resource: LyceumTextualResource, rootPath: string) {
  if (resource.data instanceof ArrayBuffer) return Buffer.from(resource.data);
  if (resource.data) return Buffer.from(resource.data.buffer, resource.data.byteOffset, resource.data.byteLength);
  return fs.readFileSync(textualResourcePath(rootPath, resource.href));
}

function rewriteCssUrls(css: string, chapterHref: string, resourceLinks: Map<string, string>) {
  return css.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi, (match, quote, href) => {
    const resolved = resolveChapterHref(chapterHref, href);
    const replacement = resolved ? resourceLinks.get(resolved.toLowerCase()) : undefined;
    return replacement ? `url(${quote}${replacement}${quote})` : match;
  });
}

function rewriteChapterDocument(html: string, chapterHref: string, resourceLinks: Map<string, string>) {
  const dom = new JSDOM(html, { contentType: "text/html" });
  const document = dom.window.document;
  for (const element of Array.from(document.querySelectorAll("*"))) {
    for (const attribute of ["src", "href", "data", "poster", "xlink:href"]) {
      const href = element.getAttribute(attribute);
      if (!href) continue;
      const resolved = resolveChapterHref(chapterHref, href);
      const replacement = resolved ? resourceLinks.get(resolved.toLowerCase()) : undefined;
      if (replacement) element.setAttribute(attribute, replacement);
    }
    const srcset = element.getAttribute("srcset");
    if (srcset) {
      element.setAttribute("srcset", srcset.split(",").map((candidate) => {
        const [href, descriptor] = candidate.trim().split(/\s+/, 2);
        const resolved = resolveChapterHref(chapterHref, href);
        const replacement = resolved ? resourceLinks.get(resolved.toLowerCase()) : undefined;
        return `${replacement || href}${descriptor ? ` ${descriptor}` : ""}`;
      }).join(", "));
    }
    const style = element.getAttribute("style");
    if (style) element.setAttribute("style", rewriteCssUrls(style, chapterHref, resourceLinks));
  }
  for (const style of Array.from(document.querySelectorAll("style"))) {
    style.textContent = rewriteCssUrls(style.textContent || "", chapterHref, resourceLinks);
  }
  return {
    body: document.body.innerHTML,
    styles: Array.from(document.head.querySelectorAll("style")).map((style) => style.outerHTML),
  };
}

export class HtmlExporter implements LyceumExporter {
  outputFormat = "html" as const;

  canExport(pkg: ExportInput["package"]) {
    return pkg.textual
      ? { supported: true }
      : { supported: false, reason: "O pacote .lyceum nao possui conteudo textual." };
  }

  async export(input: ExportInput): Promise<ExportResult> {
    if (!input.package.textual) {
      throw new Error("O pacote .lyceum nao possui conteudo textual exportavel para HTML.");
    }

    const metadata = mergeDefinedBookMetadata(input.package.metadata, input.metadata);
    const outputDir = path.dirname(input.outputPath);
    const filesDirName = `${path.basename(input.outputPath, path.extname(input.outputPath))}_files`;
    const filesDir = path.join(outputDir, filesDirName);
    const resourceLinks = new Map<string, string>();

    for (const resource of input.package.textual.resources || []) {
      const safeHref = normalizeHref(resource.href);
      const targetPath = path.join(filesDir, ...safeHref.split("/"));
      await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.promises.writeFile(targetPath, resourceData(resource, input.package.rootPath));
      resourceLinks.set(safeHref.toLowerCase(), `${filesDirName}/${safeHref}`);
    }

    const chapterDocuments = input.package.textual.chapters.map((chapter) => ({
      chapter,
      document: rewriteChapterDocument(chapter.xhtml, chapter.href, resourceLinks),
    }));
    const stylesheetLinks = (input.package.textual.resources || [])
      .filter((resource) => resource.mediaType === "text/css")
      .map((resource) => resourceLinks.get(normalizeHref(resource.href).toLowerCase()))
      .filter((href): href is string => Boolean(href))
      .map((href) => `  <link rel="stylesheet" href="${escapeXml(href)}" />`)
      .join("\n");
    const inlineStyles = chapterDocuments.flatMap((item) => item.document.styles).join("\n");
    const body = chapterDocuments
      .map(({ chapter, document }) => `<section class="lyceum-chapter" id="lyceum-${escapeXml(chapter.id)}" data-lyceum-chapter="${escapeXml(chapter.id)}">\n${document.body}\n</section>`)
      .join("\n");
    const html = `<!doctype html>
<html lang="${escapeXml(metadata.language || "pt-BR")}">
<head>
  <meta charset="utf-8" />
  <title>${escapeXml(metadata.title)}</title>
${stylesheetLinks}
${inlineStyles}
  <style>
    @page { margin: 16mm 15mm 18mm; }
    html, body { background: white; color: black; }
    body { margin: 0; }
    .lyceum-chapter { display: flow-root; }
    .lyceum-chapter + .lyceum-chapter { break-before: page; }
    img, svg, table, pre { max-width: 100%; }
    img { height: auto; }
    table { break-inside: avoid; border-collapse: collapse; }
    h1, h2, h3 { break-after: avoid; }
    figure, blockquote, pre { break-inside: avoid; }
  </style>
</head>
<body>
${body}
</body>
</html>`;

    await fs.promises.mkdir(outputDir, { recursive: true });
    await fs.promises.writeFile(input.outputPath, html, "utf8");

    return {
      outputPath: input.outputPath,
      outputFormat: "html",
      report: {
        outputFormat: "html",
        warnings: [],
        stats: {
          chapterCount: input.package.textual.chapters.length,
          resourceCount: resourceLinks.size,
          stylesheetCount: (input.package.textual.resources || []).filter((resource) => resource.mediaType === "text/css").length,
          printReady: true,
        },
      },
    };
  }
}
