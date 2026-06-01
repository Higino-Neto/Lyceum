import fs from "node:fs";
import path from "node:path";
import { buildEpubFromLyceumPackage } from "./epubExporter";
import type {
  ExportInput,
  ExportResult,
  LyceumExporter,
} from "../schema/types";
import type { KindlePreviewerConversionResult } from "../kfx/kindlePreviewer";
import {
  createPreviewerWorkspace,
  runKindlePreviewerConversion,
} from "../kfx/kindlePreviewer";
import { materializeKfxFromPreviewerResult } from "../kfx/kfxPipeline";
import { assembleKfxFromKpf, type KpfToKfxAssembler } from "../kfx/kpfToKfxAssembler";
import { mergeDefinedBookMetadata } from "../schema/manifest";

export type KindlePreviewerRunner = (options: {
  inputPath: string;
  outputDir: string;
}) => Promise<KindlePreviewerConversionResult>;

export class KfxExporter implements LyceumExporter {
  outputFormat = "kfx" as const;

  constructor(
    private readonly previewerRunner: KindlePreviewerRunner = runKindlePreviewerConversion,
    private readonly kpfAssembler: KpfToKfxAssembler = assembleKfxFromKpf,
  ) {}

  canExport(pkg: ExportInput["package"]) {
    return pkg.textual
      ? { supported: true }
      : { supported: false, reason: "O pacote .lyceum nao possui conteudo textual para KFX." };
  }

  async export(input: ExportInput): Promise<ExportResult> {
    if (!input.package.textual) {
      throw new Error("O pacote .lyceum nao possui conteudo textual exportavel para KFX.");
    }

    const workspace = await createPreviewerWorkspace();
    const intermediateEpubPath = path.join(workspace, "source.epub");
    const previewerOutputDir = path.join(workspace, "previewer-output");
    const warnings: string[] = [
      "KFX usa Kindle Previewer como backend opcional; a conversao depende da versao instalada localmente.",
    ];

    const metadata = mergeDefinedBookMetadata(input.package.metadata, input.metadata);
    const epub = await buildEpubFromLyceumPackage(input.package, metadata);
    await fs.promises.writeFile(intermediateEpubPath, Buffer.from(epub));

    const previewer = await this.previewerRunner({
      inputPath: intermediateEpubPath,
      outputDir: previewerOutputDir,
    });
    const materialized = await materializeKfxFromPreviewerResult(previewer, input.outputPath, {
      metadata,
      kpfAssembler: this.kpfAssembler,
    });

    return {
      outputPath: input.outputPath,
      outputFormat: "kfx",
      report: {
        outputFormat: "kfx",
        warnings: [
          ...warnings,
          ...materialized.warnings,
          ...previewer.logs.map((log) => log.slice(0, 1000)),
        ].filter(Boolean),
        stats: {
          ...materialized.stats,
          previewerExecutable: previewer.executablePath,
        },
      },
    };
  }
}
