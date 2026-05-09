import path from "node:path";
import { buildChapterFiles } from "../../pdf-to-epub/epub";
import {
  parsePdfToPages,
  reconstructStructureFromPages,
} from "../../pdf-to-epub/pipeline";
import { renderSectionToXhtml } from "../../pdf-to-epub/html";
import { createManifest, mergeBookMetadata } from "../schema/manifest";
import type {
  EpubAsset,
  ImageCandidate,
} from "../../pdf-to-epub/types";
import type {
  ImportInput,
  ImportResult,
  LyceumImporter,
  LyceumTextualChapter,
} from "../schema/types";
import { buildTextualContent } from "../textual";
import { writeLyceumPackage } from "../package/write";

type RenderImageAsset = (candidate: ImageCandidate) => Promise<EpubAsset | null>;

export class PdfImporter implements LyceumImporter {
  inputFormat = "pdf" as const;

  async import(input: ImportInput): Promise<ImportResult> {
    const pdfBuffer = await import("node:fs").then((fs) => fs.readFileSync(input.sourcePath));
    const pages = await parsePdfToPages(
      Uint8Array.from(pdfBuffer).buffer,
      {},
    );
    const warnings = pages
      .filter((page) => page.requiresOcr)
      .map((page) => `Pagina ${page.pageNumber} tem pouco texto extraido e pode precisar de OCR.`);
    const structure = reconstructStructureFromPages(pages);
    const chapterFiles = buildChapterFiles(structure.sections, renderSectionToXhtml);
    const chapters: LyceumTextualChapter[] = chapterFiles.map((chapter) => ({
      id: chapter.id,
      href: path.basename(chapter.href),
      title: chapter.title,
      xhtml: chapter.xhtml,
    }));
    const fallbackTitle = path.basename(input.sourcePath, path.extname(input.sourcePath));
    const metadata = mergeBookMetadata(fallbackTitle, input.metadata);
    const manifest = createManifest({
      sourcePath: input.sourcePath,
      sourceFormat: "pdf",
      metadata,
      primaryContentKind: "textual",
      contentKinds: ["textual", "pdf"],
    });
    const textual = buildTextualContent(chapters);
    const pkg = writeLyceumPackage({
      rootPath: input.packageRoot,
      manifest,
      metadata,
      textual,
      sourcePath: input.sourcePath,
    });

    void (input.renderImageAsset as RenderImageAsset | undefined);

    return {
      package: pkg,
      report: {
        sourceFormat: "pdf",
        contentKinds: ["textual", "pdf"],
        warnings,
        stats: {
          pageCount: pages.length,
          sectionCount: structure.sections.length,
          blockCount: structure.blocks.length,
        },
      },
    };
  }
}

