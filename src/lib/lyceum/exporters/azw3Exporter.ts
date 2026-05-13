import fs from "node:fs";
import path from "node:path";
import { buildAzw3 } from "../mobi/azw3Writer";
import type { ExportInput, ExportResult, LyceumExporter } from "../schema/types";

export class Azw3Exporter implements LyceumExporter {
  outputFormat = "azw3" as const;

  canExport(pkg: ExportInput["package"]) {
    return pkg.textual
      ? { supported: true }
      : { supported: false, reason: "O pacote .lyceum nao possui conteudo textual." };
  }

  async export(input: ExportInput): Promise<ExportResult> {
    if (!input.package.textual) {
      throw new Error("O pacote .lyceum nao possui conteudo textual exportavel para AZW3.");
    }

    fs.mkdirSync(path.dirname(input.outputPath), { recursive: true });

    const metadata = {
      ...input.package.metadata,
      ...input.metadata,
      title: input.metadata?.title || input.package.metadata.title,
    };
    const azw3 = buildAzw3({
      metadata,
      textual: input.package.textual,
    });

    fs.writeFileSync(input.outputPath, Buffer.from(azw3.buffer));

    return {
      outputPath: input.outputPath,
      outputFormat: "azw3",
      report: {
        outputFormat: "azw3",
        warnings: [],
        stats: {
          ...azw3.stats,
        },
      },
    };
  }
}
