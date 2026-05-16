import fs from "node:fs";
import path from "node:path";
import { convertPdfToEpub } from "../../pdf-to-epub";
import type {
  EpubAsset,
  ImageCandidate,
} from "../../pdf-to-epub/types";
import { createManifest, mergeBookMetadata } from "../schema/manifest";
import type {
  ImportInput,
  ImportResult,
  LyceumImporter,
} from "../schema/types";
import { writeLyceumPackageAsync } from "../package/write";
import { parseEpubBufferToTextual } from "./epubImporter";

type RenderImageAsset = (candidate: ImageCandidate) => Promise<EpubAsset | null>;

export class PdfImporter implements LyceumImporter {
  inputFormat = "pdf" as const;

  async import(input: ImportInput): Promise<ImportResult> {
    const pdfBuffer = await fs.promises.readFile(input.sourcePath);
    const fallbackTitle = path.basename(input.sourcePath, path.extname(input.sourcePath));
    const converted = await convertPdfToEpub(
      Uint8Array.from(pdfBuffer).buffer,
      {
        title: input.metadata?.title || fallbackTitle,
        author: input.metadata?.author,
        language: input.metadata?.language || "pt-BR",
        identifier: input.metadata?.identifier,
        publisher: input.metadata?.publisher,
        description: input.metadata?.description,
        renderImageAsset: input.renderImageAsset as RenderImageAsset | undefined,
      },
    );
    const parsed = await parseEpubBufferToTextual(converted.epub);
    const metadata = mergeBookMetadata(fallbackTitle, {
      ...parsed.metadata,
      ...input.metadata,
    });
    const manifest = createManifest({
      sourcePath: input.sourcePath,
      sourceFormat: "pdf",
      metadata,
      primaryContentKind: "textual",
      contentKinds: ["textual", "pdf"],
    });
    const pkg = await writeLyceumPackageAsync({
      rootPath: input.packageRoot,
      manifest,
      metadata,
      textual: parsed.textual,
      sourcePath: input.sourcePath,
    });

    return {
      package: pkg,
      report: {
        sourceFormat: "pdf",
        contentKinds: ["textual", "pdf"],
        warnings: [...converted.report.warnings, ...parsed.warnings],
        stats: {
          pageCount: converted.report.pageCount,
          sectionCount: converted.report.sectionCount,
          blockCount: converted.report.blockCount,
          chapterCount: parsed.textual.chapters.length,
          resourceCount: parsed.textual.resources?.length || 0,
          imageCount: parsed.textual.resources?.filter((resource) => resource.mediaType.startsWith("image/")).length || 0,
          wordCount: parsed.textual.fulltext.split(/\s+/).filter(Boolean).length,
        },
      },
    };
  }
}
