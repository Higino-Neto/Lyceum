import fs from "node:fs";
import path from "node:path";
import type { ExportInput, ExportResult, LyceumExporter, LyceumTextualResource } from "../schema/types";
import { mergeDefinedBookMetadata } from "../schema/manifest";
import { escapeXml, extractBodyHtml } from "../textual";
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

function rewriteResourceLinks(html: string, chapterHref: string, resourceLinks: Map<string, string>) {
  return html
    .replace(/\b(src|href)\s*=\s*(["'])([^"']+)\2/gi, (match, attr, quote, href) => {
      const resolved = resolveChapterHref(chapterHref, href);
      const replacement = resolved ? resourceLinks.get(resolved.toLowerCase()) : undefined;
      return replacement ? `${attr}=${quote}${escapeXml(replacement)}${quote}` : match;
    })
    .replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi, (match, quote, href) => {
      const resolved = resolveChapterHref(chapterHref, href);
      const replacement = resolved ? resourceLinks.get(resolved.toLowerCase()) : undefined;
      return replacement ? `url(${quote}${replacement}${quote})` : match;
    });
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

    const body = input.package.textual.chapters
      .map((chapter) => `<section data-lyceum-chapter="${escapeXml(chapter.id)}">\n${rewriteResourceLinks(extractBodyHtml(chapter.xhtml), chapter.href, resourceLinks)}\n</section>`)
      .join("\n");
    const html = `<!doctype html>
<html lang="${escapeXml(metadata.language || "pt-BR")}">
<head>
  <meta charset="utf-8" />
  <title>${escapeXml(metadata.title)}</title>
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
        },
      },
    };
  }
}
