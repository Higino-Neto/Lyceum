import fs from "node:fs";
import path from "node:path";
import type { ExportInput, ExportResult, LyceumExporter } from "../schema/types";

export class TxtExporter implements LyceumExporter {
  outputFormat = "txt" as const;

  canExport(pkg: ExportInput["package"]) {
    return pkg.textual
      ? { supported: true }
      : { supported: false, reason: "O pacote .lyceum nao possui conteudo textual." };
  }

  async export(input: ExportInput): Promise<ExportResult> {
    if (!input.package.textual) {
      throw new Error("O pacote .lyceum nao possui conteudo textual exportavel para TXT.");
    }

    fs.mkdirSync(path.dirname(input.outputPath), { recursive: true });
    fs.writeFileSync(input.outputPath, input.package.textual.fulltext, "utf8");

    return {
      outputPath: input.outputPath,
      outputFormat: "txt",
      report: {
        outputFormat: "txt",
        warnings: [],
        stats: {
          wordCount: input.package.textual.fulltext.split(/\s+/).filter(Boolean).length,
        },
      },
    };
  }
}

