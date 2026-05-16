import fs from "node:fs";
import path from "node:path";
import { createManifest, mergeBookMetadata } from "../schema/manifest";
import type {
  ImportInput,
  ImportResult,
  LyceumImporter,
  LyceumTextualChapter,
} from "../schema/types";
import { buildTextualContent, extractBodyHtml, normalizeHtmlEntitiesForXhtml, stripHtml } from "../textual";
import { writeLyceumPackageAsync } from "../package/write";

function getTitle(html: string) {
  return stripHtml(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
}

export class HtmlImporter implements LyceumImporter {
  inputFormat = "html" as const;

  async import(input: ImportInput): Promise<ImportResult> {
    const html = fs.readFileSync(input.sourcePath, "utf8");
    const fallbackTitle = getTitle(html) || path.basename(input.sourcePath, path.extname(input.sourcePath));
    const metadata = mergeBookMetadata(fallbackTitle, input.metadata);
    const text = stripHtml(extractBodyHtml(html));
    const chapters: LyceumTextualChapter[] = [{
      id: "chapter-001",
      href: "text/chapter-001.xhtml",
      title: metadata.title,
      xhtml: normalizeHtmlEntitiesForXhtml(html),
    }];
    const textual = buildTextualContent(chapters);
    const manifest = createManifest({
      sourcePath: input.sourcePath,
      sourceFormat: "html",
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
        sourceFormat: "html",
        contentKinds: ["textual"],
        warnings: [],
        stats: {
          chapterCount: 1,
          wordCount: textual.fulltext.split(/\s+/).filter(Boolean).length,
          preservedMarkup: Boolean(text),
        },
      },
    };
  }
}
