import fs from "node:fs";
import path from "node:path";
import type { ExportInput, ExportResult, LyceumExporter } from "../schema/types";
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

    const title = input.metadata?.title || input.package.metadata.title;
    const body = input.package.textual.chapters
      .map((chapter) => `<section data-lyceum-chapter="${escapeXml(chapter.id)}">\n${extractBodyHtml(chapter.xhtml)}\n</section>`)
      .join("\n");
    const html = `<!doctype html>
<html lang="${escapeXml(input.package.metadata.language || "pt-BR")}">
<head>
  <meta charset="utf-8" />
  <title>${escapeXml(title)}</title>
</head>
<body>
${body}
</body>
</html>`;

    fs.mkdirSync(path.dirname(input.outputPath), { recursive: true });
    fs.writeFileSync(input.outputPath, html, "utf8");

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
