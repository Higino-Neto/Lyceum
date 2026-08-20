import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";
import type { ExportInput, ExportResult, LyceumConversionOptions, LyceumExporter, LyceumTextualResource } from "../schema/types";
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

function safeDocumentId(value: string) {
  return value.replace(/[^a-zA-Z0-9_.:-]/g, "-") || "chapter";
}

function decodeFragment(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

interface ChapterTarget {
  sectionId: string;
  anchorPrefix: string;
}

function internalTarget(
  chapterHref: string,
  href: string,
  chapterTargets: Map<string, ChapterTarget>,
  currentTarget: ChapterTarget,
) {
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href)) return null;
  const [pathAndQuery, fragment = ""] = href.split("#", 2);
  const pathname = pathAndQuery.split("?", 1)[0];
  const target = pathname
    ? chapterTargets.get((resolveChapterHref(chapterHref, pathname) || "").toLowerCase())
    : currentTarget;
  if (!target) return null;
  return fragment
    ? `#${target.anchorPrefix}--${safeDocumentId(decodeFragment(fragment))}`
    : `#${target.sectionId}`;
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

function rewriteChapterDocument(
  html: string,
  chapterHref: string,
  resourceLinks: Map<string, string>,
  chapterTargets: Map<string, ChapterTarget>,
  currentTarget: ChapterTarget,
) {
  const dom = new JSDOM(html, { contentType: "text/html" });
  const document = dom.window.document;
  for (const element of Array.from(document.querySelectorAll("[id], [name]"))) {
    for (const attribute of ["id", "name"]) {
      const value = element.getAttribute(attribute);
      if (value) element.setAttribute(attribute, `${currentTarget.anchorPrefix}--${safeDocumentId(value)}`);
    }
  }
  for (const element of Array.from(document.querySelectorAll("*"))) {
    for (const attribute of ["src", "href", "data", "poster", "xlink:href"]) {
      const href = element.getAttribute(attribute);
      if (!href) continue;
      if (attribute === "href") {
        const target = internalTarget(chapterHref, href, chapterTargets, currentTarget);
        if (target) {
          element.setAttribute(attribute, target);
          continue;
        }
      }
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
    hasHeading: Boolean(document.body.querySelector("h1, h2")),
  };
}

function clamp(value: number | undefined, fallback: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? Number(value) : fallback));
}

function printCss(options: LyceumConversionOptions = {}) {
  const top = clamp(options.pdfMarginTopMm, 16, 0, 60);
  const right = clamp(options.pdfMarginRightMm, 15, 0, 60);
  const bottom = clamp(options.pdfMarginBottomMm, 18, 0, 60);
  const left = clamp(options.pdfMarginLeftMm, 15, 0, 60);
  const lineHeight = clamp(options.pdfLineHeight, 1.45, 1, 2.4);
  const paragraphSpacing = clamp(options.pdfParagraphSpacingEm, 0.85, 0, 3);
  const fontSize = clamp(options.pdfFontSizePt, 11, 7, 24);
  const chapterBreak = options.pdfChapterPageBreaks === false ? "auto" : "page";
  return `
    @page { size: ${options.pdfPageSize || "A4"}; margin: ${top}mm ${right}mm ${bottom}mm ${left}mm; }
    html, body { background: white; color: black; }
    body { margin: 0; font-size: ${fontSize}pt; line-height: ${lineHeight}; }
    p { margin-top: 0 !important; margin-bottom: ${paragraphSpacing}em !important; line-height: ${lineHeight} !important; }
    li, blockquote, figcaption { line-height: ${lineHeight}; }
    .lyceum-toc { break-after: page; }
    .lyceum-toc ol { list-style: none; margin: 0; padding: 0; }
    .lyceum-toc li { margin: 0 0 0.45em; }
    .lyceum-toc-level-2 { padding-left: 1.25em; }
    .lyceum-toc-level-3, .lyceum-toc-level-4 { padding-left: 2.5em; }
    .lyceum-chapter { display: flow-root; }
    .lyceum-chapter + .lyceum-chapter { break-before: ${chapterBreak}; }
    img, svg, table, pre { max-width: 100%; }
    img { height: auto; }
    table { break-inside: avoid; border-collapse: collapse; }
    h1, h2, h3 { break-after: avoid; }
    figure, blockquote, pre { break-inside: avoid; }
  `;
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
    const options = input.conversionOptions || {};
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

    const chapterTargets = new Map(input.package.textual.chapters.map((chapter) => {
      const anchorPrefix = `lyceum-${safeDocumentId(chapter.id)}`;
      return [normalizeHref(chapter.href).toLowerCase(), { sectionId: anchorPrefix, anchorPrefix }];
    }));
    const chapterDocuments = input.package.textual.chapters.map((chapter) => ({
      chapter,
      target: chapterTargets.get(normalizeHref(chapter.href).toLowerCase())!,
      document: rewriteChapterDocument(
        chapter.xhtml,
        chapter.href,
        resourceLinks,
        chapterTargets,
        chapterTargets.get(normalizeHref(chapter.href).toLowerCase())!,
      ),
    }));
    const stylesheetLinks = (input.package.textual.resources || [])
      .filter((resource) => resource.mediaType === "text/css")
      .map((resource) => resourceLinks.get(normalizeHref(resource.href).toLowerCase()))
      .filter((href): href is string => Boolean(href))
      .map((href) => `  <link rel="stylesheet" href="${escapeXml(href)}" />`)
      .join("\n");
    const inlineStyles = chapterDocuments.flatMap((item) => item.document.styles).join("\n");
    const includeToc = options.pdfIncludeToc ?? options.htmlIncludeToc ?? true;
    const toc = includeToc && input.package.textual.toc.length
      ? `<nav class="lyceum-toc" aria-labelledby="lyceum-toc-title">
  <h1 id="lyceum-toc-title">Sumario</h1>
  <ol>
${input.package.textual.toc.map((item) => {
  const [tocPath, fragment = ""] = item.href.split("#", 2);
  const target = chapterTargets.get(normalizeHref(tocPath).toLowerCase());
  if (!target) return "";
  const href = fragment
    ? `#${target.anchorPrefix}--${safeDocumentId(decodeFragment(fragment))}`
    : `#${target.sectionId}`;
  return `    <li class="lyceum-toc-level-${Math.min(4, Math.max(1, item.level))}"><a href="${escapeXml(href)}">${escapeXml(item.title)}</a></li>`;
}).filter(Boolean).join("\n")}
  </ol>
</nav>`
      : "";
    const body = chapterDocuments
      .map(({ chapter, document, target }) => `<section class="lyceum-chapter" id="${escapeXml(target.sectionId)}" data-lyceum-chapter="${escapeXml(chapter.id)}">\n${document.hasHeading ? "" : `<h1>${escapeXml(chapter.title)}</h1>`}\n${document.body}\n</section>`)
      .join("\n");
    const html = `<!doctype html>
<html lang="${escapeXml(metadata.language || "pt-BR")}">
<head>
  <meta charset="utf-8" />
  <title>${escapeXml(metadata.title)}</title>
${stylesheetLinks}
${inlineStyles}
  <style>
${printCss(options)}
  </style>
</head>
<body>
${toc}
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
          tocItemCount: input.package.textual.toc.length,
          internalLinkMapping: true,
        },
      },
    };
  }
}
