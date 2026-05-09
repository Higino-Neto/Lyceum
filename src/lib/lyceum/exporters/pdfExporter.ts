import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { convertEpubToPdf } from "../../epub-to-pdf";
import { EpubExporter } from "./epubExporter";
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

    fs.mkdirSync(path.dirname(input.outputPath), { recursive: true });
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lyceum-export-"));
    const tempEpubPath = path.join(tempDir, "source.epub");
    const epubExporter = new EpubExporter();
    await epubExporter.export({
      package: input.package,
      outputPath: tempEpubPath,
      metadata: input.metadata,
    });

    const converted = await convertEpubToPdf(fs.readFileSync(tempEpubPath), {
      title: input.metadata?.title || input.package.metadata.title,
      author: input.metadata?.author || input.package.metadata.author,
    });
    fs.writeFileSync(input.outputPath, Buffer.from(converted.pdf));

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

