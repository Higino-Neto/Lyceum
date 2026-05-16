import fs from "node:fs";
import path from "node:path";
import { createManifest, mergeBookMetadata } from "../schema/manifest";
import type {
  ImportInput,
  ImportResult,
  LyceumImporter,
  LyceumTextualChapter,
} from "../schema/types";
import { buildTextualContent, wrapTextAsXhtml } from "../textual";
import { writeLyceumPackageAsync } from "../package/write";

export class TxtImporter implements LyceumImporter {
  inputFormat = "txt" as const;

  async import(input: ImportInput): Promise<ImportResult> {
    const text = fs.readFileSync(input.sourcePath, "utf8");
    const fallbackTitle = path.basename(input.sourcePath, path.extname(input.sourcePath));
    const metadata = mergeBookMetadata(fallbackTitle, input.metadata);
    const paragraphs = text.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
    const chapters: LyceumTextualChapter[] = [{
      id: "chapter-001",
      href: "text/chapter-001.xhtml",
      title: metadata.title,
      xhtml: wrapTextAsXhtml(metadata.title, paragraphs.length ? paragraphs : [text.trim()]),
    }];
    const textual = buildTextualContent(chapters);
    const manifest = createManifest({
      sourcePath: input.sourcePath,
      sourceFormat: "txt",
      metadata,
      primaryContentKind: "textual",
      contentKinds: ["textual"],
    });
    const pkg = await writeLyceumPackageAsync({
      rootPath: input.packageRoot,
      manifest,
      metadata,
      textual,
      sourcePath: input.sourcePath,
    });

    return {
      package: pkg,
      report: {
        sourceFormat: "txt",
        contentKinds: ["textual"],
        warnings: [],
        stats: {
          chapterCount: 1,
          wordCount: textual.fulltext.split(/\s+/).filter(Boolean).length,
        },
      },
    };
  }
}
