import fs from "node:fs";
import path from "node:path";
import { packageEpub } from "../../pdf-to-epub/epub";
import { renderDefaultCss } from "../../pdf-to-epub/html";
import type { ExportInput, ExportResult, LyceumExporter } from "../schema/types";

export class EpubExporter implements LyceumExporter {
  outputFormat = "epub" as const;

  canExport(pkg: ExportInput["package"]) {
    return pkg.textual
      ? { supported: true }
      : { supported: false, reason: "O pacote .lyceum nao possui conteudo textual." };
  }

  async export(input: ExportInput): Promise<ExportResult> {
    if (!input.package.textual) {
      throw new Error("O pacote .lyceum nao possui conteudo textual exportavel para EPUB.");
    }

    fs.mkdirSync(path.dirname(input.outputPath), { recursive: true });
    const epub = await packageEpub({
      metadata: {
        title: input.metadata?.title || input.package.metadata.title,
        author: input.metadata?.author || input.package.metadata.author,
        language: input.metadata?.language || input.package.metadata.language || "pt-BR",
        identifier: input.metadata?.identifier || input.package.metadata.identifier || input.package.manifest.packageId,
        publisher: input.metadata?.publisher || input.package.metadata.publisher,
        description: input.metadata?.description || input.package.metadata.description,
      },
      css: renderDefaultCss(),
      chapters: input.package.textual.chapters.map((chapter) => ({
        id: chapter.id,
        href: `text/${path.basename(chapter.href)}`,
        title: chapter.title,
        xhtml: chapter.xhtml,
      })),
    });

    fs.writeFileSync(input.outputPath, Buffer.from(epub));

    return {
      outputPath: input.outputPath,
      outputFormat: "epub",
      report: {
        outputFormat: "epub",
        warnings: [],
        stats: {
          chapterCount: input.package.textual.chapters.length,
        },
      },
    };
  }
}

