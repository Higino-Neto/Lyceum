import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import type { KindlePreviewerConversionResult } from "./kindlePreviewer";
import { inspectKpfArchive } from "./kindlePreviewer";
import { assembleKfxFromKpf, type KpfToKfxAssembler } from "./kpfToKfxAssembler";
import type { LyceumBookMetadata } from "../schema/types";

export interface KfxValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  metadata: Record<string, number | string | boolean>;
}

async function isEpubZip(buffer: Buffer) {
  if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) return false;
  try {
    const zip = await JSZip.loadAsync(buffer);
    const mimetype = await zip.file("mimetype")?.async("text");
    return mimetype?.trim() === "application/epub+zip";
  } catch {
    return false;
  }
}

export async function validateKfxFile(filePath: string): Promise<KfxValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const metadata: Record<string, number | string | boolean> = {};

  if (!fs.existsSync(filePath)) {
    return {
      valid: false,
      errors: ["Arquivo KFX nao encontrado."],
      warnings,
      metadata,
    };
  }

  const stat = fs.statSync(filePath);
  metadata.size = stat.size;
  metadata.extension = path.extname(filePath).toLowerCase();

  if (stat.size === 0) {
    errors.push("Arquivo KFX vazio.");
  }

  const buffer = fs.readFileSync(filePath);
  const signature = buffer.subarray(0, 4).toString("ascii");
  metadata.signature = signature;
  metadata.startsWithZipMagic = buffer[0] === 0x50 && buffer[1] === 0x4b;
  if (buffer.length >= 6) {
    metadata.containerVersion = buffer.readUInt16LE(4);
  }

  if (signature !== "CONT") {
    errors.push("Arquivo KFX nao possui assinatura CONT.");
  }

  if (await isEpubZip(buffer)) {
    errors.push("O arquivo de saida parece ser um EPUB renomeado, nao um container KFX.");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    metadata,
  };
}

export async function materializeKfxFromPreviewerResult(
  previewer: KindlePreviewerConversionResult,
  outputPath: string,
  options: {
    metadata?: Partial<LyceumBookMetadata>;
    kpfAssembler?: KpfToKfxAssembler;
  } = {},
) {
  const kfx = previewer.generatedFiles.find((file) => file.format === "kfx");
  if (kfx) {
    await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.promises.copyFile(kfx.path, outputPath);
    const validation = await validateKfxFile(outputPath);
    if (!validation.valid) {
      throw new Error(`KFX gerado invalido: ${validation.errors.join("; ")}`);
    }
    return {
      outputPath,
      sourcePath: kfx.path,
      validation,
      warnings: validation.warnings,
      stats: {
        backend: "kindle-previewer",
        previewerOutputFormat: "kfx",
        previewerGeneratedFileCount: previewer.generatedFiles.length,
        outputBytes: validation.metadata.size || 0,
      },
    };
  }

  const kpf = previewer.generatedFiles.find((file) => file.format === "kpf");
  if (kpf) {
    const inspection = await inspectKpfArchive(kpf.path);
    if (inspection.isEpubZip) {
      throw new Error(
        [
          "Kindle Previewer gerou um KPF que parece ser EPUB renomeado.",
          `KPF inspecionado: ${inspection.entryCount} entrada(s), EPUB renomeado: sim.`,
        ].join(" "),
      );
    }

    await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
    const assembler = options.kpfAssembler || assembleKfxFromKpf;
    const assembly = await assembler(kpf.path, outputPath, { metadata: options.metadata });
    const validation = await validateKfxFile(outputPath);
    if (!validation.valid) {
      throw new Error(`KFX montado a partir do KPF invalido: ${validation.errors.join("; ")}`);
    }

    return {
      outputPath,
      sourcePath: kpf.path,
      validation,
      warnings: [
        ...validation.warnings,
        ...assembly.warnings,
        `Kindle Previewer gerou KPF; Lyceum montou KFX a partir de ${inspection.entryCount} entrada(s) internas.`,
      ],
      stats: {
        backend: "kindle-previewer+kpf-assembler",
        previewerOutputFormat: "kpf",
        previewerGeneratedFileCount: previewer.generatedFiles.length,
        kpfEntryCount: inspection.entryCount,
        kpfIsEpubZip: inspection.isEpubZip,
        assembler: assembly.assembler,
        outputBytes: validation.metadata.size || assembly.bytes || 0,
      },
    };
  }

  const mobi = previewer.generatedFiles.find((file) => file.format === "mobi");
  if (mobi) {
    throw new Error(
      "Kindle Previewer gerou MOBI porque o livro nao suporta Enhanced Typesetting; nao ha material KPF/KFX para montar KFX.",
    );
  }

  throw new Error("Kindle Previewer nao produziu KFX, KPF ou MOBI no diretorio de saida.");
}
