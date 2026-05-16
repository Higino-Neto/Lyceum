import fs from "node:fs";
import path from "node:path";
import type { ExportInput, ExportResult, LyceumExporter } from "../schema/types";
import { mergeDefinedBookMetadata } from "../schema/manifest";
import { escapeXml, extractBodyHtml } from "../textual";

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
    const body = input.package.textual.chapters
      .map((chapter) => `<section data-lyceum-chapter="${escapeXml(chapter.id)}">\n${extractBodyHtml(chapter.xhtml)}\n</section>`)
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

    await fs.promises.mkdir(path.dirname(input.outputPath), { recursive: true });
    await fs.promises.writeFile(input.outputPath, html, "utf8");

    return {
      outputPath: input.outputPath,
      outputFormat: "html",
      report: {
        outputFormat: "html",
        warnings: [],
        stats: {
          chapterCount: input.package.textual.chapters.length,
        },
      },
    };
  }
}
