import fs from "node:fs";
import path from "node:path";
import type {
  BookFormat,
  ExportReport,
  ImportReport,
  LyceumBookMetadata,
  LyceumPackage,
} from "../schema/types";
import { createDefaultConversionRegistry } from "./registry";

export interface ConvertViaLyceumOptions {
  sourcePath: string;
  sourceFormat: BookFormat;
  targetFormat: BookFormat;
  packageRoot: string;
  outputPath: string;
  metadata?: Partial<LyceumBookMetadata>;
  renderImageAsset?: unknown;
}

export interface ConvertViaLyceumResult {
  packageRoot: string;
  outputPath: string;
  importReport: ImportReport;
  exportReport: ExportReport;
}

export function inferBookFormatFromPath(filePath: string): BookFormat | null {
  const lowerPath = filePath.toLowerCase();
  if (lowerPath.endsWith(".kepub.epub")) return "epub";
  const extension = path.extname(lowerPath).replace(/^\./, "");
  const known: BookFormat[] = [
    "pdf",
    "epub",
    "docx",
    "html",
    "cbz",
    "mobi",
    "azw",
    "azw3",
    "azw4",
    "kfx",
    "prc",
    "txt",
    "lyceum",
  ];

  return known.includes(extension as BookFormat) ? extension as BookFormat : null;
}

export function listTargetsForSourceFormat(sourceFormat: BookFormat) {
  const registry = createDefaultConversionRegistry();
  const importer = registry.getImporter(sourceFormat);

  if (!importer) {
    return [];
  }

  const probePackage: LyceumPackage = {
    rootPath: "",
    manifest: {
      schemaVersion: 1,
      packageId: "lyceum-probe",
      title: "Probe",
      sourceFormat,
      originalFileName: `probe.${sourceFormat}`,
      primaryContentKind: "textual",
      contentKinds: ["textual"],
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    },
    metadata: {
      title: "Probe",
      language: "pt-BR",
    },
    textual: {
      chapters: [],
      spine: [],
      toc: [],
      fulltext: "",
      resources: [],
    },
  };

  return registry
    .listOutputFormats()
    .filter((format) => format !== sourceFormat)
    .map((format) => {
      const exporter = registry.getExporter(format);
      const capability = exporter
        ? exporter.canExport(probePackage)
        : { supported: false, reason: "Exporter nao registrado." };

      return {
        format,
        ...capability,
      };
    });
}

export async function convertViaLyceum(options: ConvertViaLyceumOptions): Promise<ConvertViaLyceumResult> {
  const registry = createDefaultConversionRegistry();
  const importer = registry.getImporter(options.sourceFormat);
  if (!importer) {
    throw new Error(`Importador nao registrado para ${options.sourceFormat.toUpperCase()}.`);
  }

  const exporter = registry.getExporter(options.targetFormat);
  if (!exporter) {
    throw new Error(`Exporter nao registrado para ${options.targetFormat.toUpperCase()}.`);
  }

  fs.mkdirSync(options.packageRoot, { recursive: true });
  const imported = await importer.import({
    sourcePath: options.sourcePath,
    sourceFormat: options.sourceFormat,
    packageRoot: options.packageRoot,
    metadata: options.metadata,
    renderImageAsset: options.renderImageAsset,
  });
  const pkg = imported.package;
  const capability = exporter.canExport(pkg);

  if (!capability.supported) {
    throw new Error(capability.reason || `Nao e possivel exportar para ${options.targetFormat.toUpperCase()}.`);
  }

  const exported = await exporter.export({
    package: pkg,
    outputPath: options.outputPath,
    metadata: options.metadata,
  });

  return {
    packageRoot: imported.package.rootPath,
    outputPath: exported.outputPath,
    importReport: imported.report,
    exportReport: exported.report,
  };
}
