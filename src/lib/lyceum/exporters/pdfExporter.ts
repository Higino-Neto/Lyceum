import fs from "node:fs";
import path from "node:path";
import { convertEpubToPdf } from "../../epub-to-pdf";
import { buildEpubFromLyceumPackage } from "./epubExporter";
import type { ExportInput, ExportResult, LyceumExporter } from "../schema/types";

export class PdfExporter implements LyceumExporter {
  outputFormat = "pdf" as const;

  canExport(pkg: ExportInput["package"]) {
    return pkg.textual
      ? { supported: true }
      : { supported: false, reason: "O pacote .lyceum nao possui conteudo textual." };
  }

  async export(input: ExportInput): Promise<ExportResult> {
    if (!input.package.textual) {
      throw new Error("O pacote .lyceum nao possui conteudo textual exportavel para PDF.");
    }

    await fs.promises.mkdir(path.dirname(input.outputPath), { recursive: true });
    const epub = await buildEpubFromLyceumPackage(input.package, input.metadata);
    const converted = await convertEpubToPdf(epub, {
      title: input.metadata?.title || input.package.metadata.title,
      author: input.metadata?.author || input.package.metadata.author,
    });
    await fs.promises.writeFile(input.outputPath, Buffer.from(converted.pdf));

    return {
      outputPath: input.outputPath,
      outputFormat: "pdf",
      report: {
        outputFormat: "pdf",
        warnings: converted.report.warnings,
        stats: {
          chapterCount: converted.report.chapterCount,
          pageCount: converted.report.pageCount,
          wordCount: converted.report.wordCount,
          imageCount: converted.report.imageCount,
          skippedImageCount: converted.report.skippedImageCount,
          unsupportedCharacterCount: converted.report.unsupportedCharacterCount,
        },
      },
    };
  }
}
