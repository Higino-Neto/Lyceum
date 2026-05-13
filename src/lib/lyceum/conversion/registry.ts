import type {
  BookFormat,
  ExportCapability,
  LyceumExporter,
  LyceumImporter,
  LyceumPackage,
} from "../schema/types";
import { EpubImporter } from "../importers/epubImporter";
import { PdfImporter } from "../importers/pdfImporter";
import { TxtImporter } from "../importers/txtImporter";
import { HtmlImporter } from "../importers/htmlImporter";
import { EpubExporter } from "../exporters/epubExporter";
import { PdfExporter } from "../exporters/pdfExporter";
import { TxtExporter } from "../exporters/txtExporter";
import { HtmlExporter } from "../exporters/htmlExporter";
import { Azw3Exporter } from "../exporters/azw3Exporter";

export class ConversionRegistry {
  private importers = new Map<BookFormat, LyceumImporter>();
  private exporters = new Map<BookFormat, LyceumExporter>();

  registerImporter(importer: LyceumImporter) {
    this.importers.set(importer.inputFormat, importer);
  }

  registerExporter(exporter: LyceumExporter) {
    this.exporters.set(exporter.outputFormat, exporter);
  }

  getImporter(format: BookFormat) {
    return this.importers.get(format);
  }

  getExporter(format: BookFormat) {
    return this.exporters.get(format);
  }

  listInputFormats() {
    return Array.from(this.importers.keys());
  }

  listOutputFormats() {
    return Array.from(this.exporters.keys());
  }

  listTargetsForPackage(pkg: LyceumPackage) {
    return this.listOutputFormats()
      .map((format) => {
        const exporter = this.getExporter(format);
        const capability: ExportCapability = exporter
          ? exporter.canExport(pkg)
          : { supported: false, reason: "Exporter nao registrado." };
        return {
          format,
          ...capability,
        };
      })
      .filter((target) => target.supported);
  }
}

export function createDefaultConversionRegistry() {
  const registry = new ConversionRegistry();

  registry.registerImporter(new EpubImporter());
  registry.registerImporter(new PdfImporter());
  registry.registerImporter(new TxtImporter());
  registry.registerImporter(new HtmlImporter());
  registry.registerExporter(new EpubExporter());
  registry.registerExporter(new PdfExporter());
  registry.registerExporter(new TxtExporter());
  registry.registerExporter(new HtmlExporter());
  registry.registerExporter(new Azw3Exporter());

  return registry;
}
