import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import type sharpType from "sharp";
import { convertEpubToPdf } from "../../epub-to-pdf";
import { buildEpubFromLyceumPackage } from "./epubExporter";
import { textualResourcePath } from "../package/paths";
import type { ExportInput, ExportResult, LyceumExporter, LyceumTextualResource } from "../schema/types";

type SharpFactory = typeof sharpType;
const require = createRequire(import.meta.url);
let sharpFactoryPromise: Promise<SharpFactory> | null = null;

async function getSharp(): Promise<SharpFactory> {
  sharpFactoryPromise ||= Promise.resolve(require("sharp") as SharpFactory);
  return sharpFactoryPromise;
}

function resourceData(resource: LyceumTextualResource, rootPath: string) {
  if (resource.data instanceof ArrayBuffer) return Buffer.from(resource.data);
  if (resource.data) return Buffer.from(resource.data.buffer, resource.data.byteOffset, resource.data.byteLength);
  return fs.readFileSync(textualResourcePath(rootPath, resource.href));
}

async function imageBytesForPdf(resource: LyceumTextualResource, rootPath: string) {
  const data = resourceData(resource, rootPath);
  const mediaType = resource.mediaType.toLowerCase();
  if (mediaType === "image/jpeg" || mediaType === "image/png") {
    return { data, mediaType };
  }

  const sharp = await getSharp();
  return {
    data: await sharp(data, { animated: mediaType === "image/gif" || mediaType === "image/webp" })
      .rotate()
      .jpeg({ quality: 90 })
      .toBuffer(),
    mediaType: "image/jpeg",
  };
}

async function buildComicPdf(input: ExportInput) {
  const pdf = await PDFDocument.create();
  const resources = new Map(
    (input.package.textual?.resources || []).map((resource) => [resource.href.toLowerCase(), resource]),
  );
  let imageCount = 0;

  for (const comicPage of input.package.comic?.pages || []) {
    const resource = comicPage.resourceHref
      ? resources.get(comicPage.resourceHref.toLowerCase())
      : undefined;
    if (!resource) continue;

    const image = await imageBytesForPdf(resource, input.package.rootPath);
    const embedded = image.mediaType === "image/png"
      ? await pdf.embedPng(image.data)
      : await pdf.embedJpg(image.data);
    const width = Math.max(1, comicPage.width || embedded.width);
    const height = Math.max(1, comicPage.height || embedded.height);
    const page = pdf.addPage([width, height]);
    page.drawImage(embedded, { x: 0, y: 0, width, height });
    imageCount += 1;
  }

  if (imageCount === 0) {
    throw new Error("O pacote .lyceum nao possui paginas de quadrinho exportaveis para PDF.");
  }

  return {
    pdf: await pdf.save(),
    imageCount,
    pageCount: pdf.getPageCount(),
  };
}

export class PdfExporter implements LyceumExporter {
  outputFormat = "pdf" as const;

  canExport(pkg: ExportInput["package"]) {
    return pkg.textual || pkg.comic
      ? { supported: true }
      : { supported: false, reason: "O pacote .lyceum nao possui conteudo exportavel para PDF." };
  }

  async export(input: ExportInput): Promise<ExportResult> {
    if (!input.package.textual && !input.package.comic) {
      throw new Error("O pacote .lyceum nao possui conteudo exportavel para PDF.");
    }

    await fs.promises.mkdir(path.dirname(input.outputPath), { recursive: true });
    if (input.package.comic?.pageCount) {
      const converted = await buildComicPdf(input);
      await fs.promises.writeFile(input.outputPath, Buffer.from(converted.pdf));

      return {
        outputPath: input.outputPath,
        outputFormat: "pdf",
        report: {
          outputFormat: "pdf",
          warnings: [],
          stats: {
            pageCount: converted.pageCount,
            imageCount: converted.imageCount,
            wordCount: 0,
          },
        },
      };
    }

    if (!input.package.textual) {
      throw new Error("O pacote .lyceum nao possui conteudo textual exportavel para PDF.");
    }

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
