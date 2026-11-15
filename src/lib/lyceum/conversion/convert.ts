import fs from "node:fs";
import path from "node:path";
import type {
  BookFormat,
  ExportReport,
  ImportReport,
  LyceumBookMetadata,
  LyceumConversionOptions,
  LyceumPackage,
} from "../schema/types";
import { createDefaultConversionRegistry } from "./registry";
import { validateLyceumPackage } from "../validation/packageValidator";
import { optimizePackageImages, resolveImageSettings } from "../images/imageOptimizer";

export interface ConvertViaLyceumOptions {
  sourcePath: string;
  sourceFormat: BookFormat;
  targetFormat: BookFormat;
  packageRoot: string;
  outputPath: string;
  metadata?: Partial<LyceumBookMetadata>;
  renderImageAsset?: unknown;
  conversionOptions?: LyceumConversionOptions;
  onProgress?: (progress: number, message: string) => void;
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
  if (lowerPath.endsWith(".fb2.zip")) return "fb2";
  if (lowerPath.endsWith(".htm")) return "html";
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
    "fb2",
    "cbr",
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

export function preparePackageForExport(pkg: LyceumPackage, options?: LyceumConversionOptions): LyceumPackage {
  if (!options || (
    options.preserveMetadata !== false
    && options.preserveCover !== false
    && options.generateIndex !== false
  )) return pkg;
  const metadata: LyceumBookMetadata = options.preserveMetadata === false
    ? { title: pkg.metadata.title, language: pkg.metadata.language || "pt-BR" }
    : { ...pkg.metadata };
  if (options.preserveCover === false) {
    delete metadata.coverResourceId;
    delete metadata.coverHref;
    delete metadata.coverPageHref;
  }
  return {
    ...pkg,
    metadata,
    textual: pkg.textual ? {
      ...pkg.textual,
      toc: options.generateIndex === false ? [] : pkg.textual.toc,
      resources: pkg.textual.resources?.map((resource) => options.preserveCover === false
        ? {
            ...resource,
            properties: resource.properties?.split(/\s+/).filter((property) => property !== "cover-image").join(" ") || undefined,
          }
        : resource),
    } : undefined,
  };
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
  const imageSettings = resolveImageSettings(options.conversionOptions);
  // Keep progress monotonic: when images are optimized, import takes 60% and optimization 40%.
  const importShare = imageSettings ? 0.6 : 1;
  const imported = await importer.import({
    sourcePath: options.sourcePath,
    sourceFormat: options.sourceFormat,
    packageRoot: options.packageRoot,
    metadata: options.metadata,
    renderImageAsset: options.renderImageAsset,
    conversionOptions: options.conversionOptions,
    onProgress: options.onProgress
      ? (progress, message) => options.onProgress?.(progress * importShare, message)
      : undefined,
  });
  const pkg = imported.package;
  const packageValidation = validateLyceumPackage(pkg);
  if (!packageValidation.valid) {
    throw new Error(`Pacote .lyceum inconsistente:\n${packageValidation.errors.join("\n")}`);
  }
  imported.report.warnings.push(...packageValidation.warnings);
  imported.report.stats.validatedReferences = packageValidation.stats.checkedReferenceCount;
  imported.report.stats.packageValidated = true;
  let exportPackage = preparePackageForExport(pkg, options.conversionOptions);
  if (imageSettings) {
    const optimized = await optimizePackageImages(exportPackage, imageSettings, (progress, message) => {
      options.onProgress?.(importShare + progress * (1 - importShare), message);
    });
    exportPackage = optimized.pkg;
    imported.report.warnings.push(...optimized.warnings);
    imported.report.stats.optimizedImageCount = optimized.optimizedCount;
    imported.report.stats.imageBytesBeforeOptimization = optimized.originalBytes;
    imported.report.stats.imageBytesAfterOptimization = optimized.optimizedBytes;
  }
  const capability = exporter.canExport(exportPackage);

  if (!capability.supported) {
    throw new Error(capability.reason || `Nao e possivel exportar para ${options.targetFormat.toUpperCase()}.`);
  }

  const exported = await exporter.export({
    package: exportPackage,
    outputPath: options.outputPath,
    metadata: options.conversionOptions?.preserveMetadata === false
      ? { title: exportPackage.metadata.title, language: exportPackage.metadata.language }
      : options.metadata,
    conversionOptions: options.conversionOptions,
  });

  return {
    packageRoot: imported.package.rootPath,
    outputPath: exported.outputPath,
    importReport: imported.report,
    exportReport: exported.report,
  };
}
