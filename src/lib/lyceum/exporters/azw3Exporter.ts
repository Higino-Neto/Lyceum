import fs from "node:fs";
import path from "node:path";
import { validateAzw3Buffer } from "../mobi/azw3Pipeline";
import { buildAzw3Async } from "../mobi/azw3Writer";
import { hydrateTextualResources, prepareKindleImages } from "../mobi/records/resources";
import { mergeDefinedBookMetadata } from "../schema/manifest";
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

    await fs.promises.mkdir(path.dirname(input.outputPath), { recursive: true });

    const metadata = mergeDefinedBookMetadata(input.package.metadata, input.metadata);
    const prepared = await prepareKindleImages(hydrateTextualResources(input.package));
    if (!prepared.pkg.textual) {
      throw new Error("O pacote .lyceum nao possui conteudo textual exportavel para AZW3.");
    }

    const azw3 = await buildAzw3Async({
      metadata,
      textual: prepared.pkg.textual,
      embedSource: false,
    });
    const buffer = Buffer.from(azw3.buffer);
    const validation = validateAzw3Buffer(buffer);

    if (!validation.valid) {
      throw new Error(`AZW3 invalido gerado pelo Lyceum: ${validation.errors.join("; ")}`);
    }

    await fs.promises.writeFile(input.outputPath, buffer);

    return {
      outputPath: input.outputPath,
      outputFormat: "azw3",
      report: {
        outputFormat: "azw3",
        warnings: [
          ...prepared.warnings,
          ...validation.warnings,
        ],
        stats: {
          backend: "lyceum-manual",
          chapterCount: prepared.pkg.textual.chapters.length,
          fileSize: validation.metadata.fileSize,
          compression: validation.metadata.compression || 0,
          mobiVersion: validation.metadata.mobiVersion || 0,
          recordCount: validation.metadata.recordCount || azw3.stats.recordCount,
          textRecordCount: validation.metadata.textRecordCount || azw3.stats.textRecordCount,
          rawTextBytes: azw3.stats.rawTextBytes,
          skeletonCount: azw3.stats.skeletonCount,
          fragmentCount: azw3.stats.fragmentCount,
          fdstRecord: azw3.stats.fdstRecord,
          fragmentIndexRecord: azw3.stats.fragmentIndexRecord,
          skeletonIndexRecord: azw3.stats.skeletonIndexRecord,
          ncxIndexRecord: azw3.stats.ncxIndexRecord,
          hasExth: Boolean(validation.metadata.hasExth),
          hasFdst: Boolean(validation.metadata.hasFdst),
          hasFlis: Boolean(validation.metadata.hasFlis),
          hasFcis: Boolean(validation.metadata.hasFcis),
          hasDatp: Boolean(validation.metadata.hasDatp),
          hasIndx: Boolean(validation.metadata.hasIndx),
          hasSrcs: Boolean(validation.metadata.hasSrcs),
          hasEof: Boolean(validation.metadata.hasEof),
          imageResourceCount: azw3.stats.imageResourceCount,
          convertedImageCount: prepared.convertedImageCount,
          resizedImageCount: prepared.resizedImageCount,
          thumbnailGenerated: prepared.thumbnailGenerated,
        },
      },
    };
  }
}
