import fs from "node:fs";
import path from "node:path";
import { createManifest, mergeBookMetadata } from "../schema/manifest";
import type { ImportInput, ImportResult, LyceumImporter, LyceumTextualChapter } from "../schema/types";
import { buildTextualContent, escapeXml } from "../textual";
import { writeLyceumPackageAsync } from "../package/write";
import { decodeTextBytes } from "../epub/containerParser";

const CHAPTER_PATTERN = /^(?:#{1,2}\s+|(?:chapter|cap[ií]tulo|parte|part|book|livro)\s+(?:\d+|[ivxlcdm]+|[a-z])(?:\b|\s*[-:]))/i;

function renderTextBlock(value: string) {
  const lines = value.split(/\r?\n/);
  return `<p>${lines.map(escapeXml).join("<br />")}</p>`;
}

function renderChapter(title: string, body: string) {
  const blocks = body.split(/(?:\r?\n){2,}/).filter((block) => block.length > 0);
  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><meta charset="utf-8" /><title>${escapeXml(title)}</title></head>
<body><h1>${escapeXml(title)}</h1>
${blocks.map(renderTextBlock).join("\n")}
</body></html>`;
}

function splitTextChapters(text: string, fallbackTitle: string): LyceumTextualChapter[] {
  const lines = text.split(/\r?\n/);
  const headings = lines
    .map((line, index) => ({ line: line.trim().replace(/^#{1,2}\s+/, ""), index }))
    .filter((item) => CHAPTER_PATTERN.test(lines[item.index].trim()));
  const starts = headings.length ? headings : [{ line: fallbackTitle, index: 0 }];

  return starts.map((start, index) => {
    const next = starts[index + 1]?.index ?? lines.length;
    const includeHeading = headings.length === 0;
    const bodyLines = lines.slice(includeHeading ? start.index : start.index + 1, next);
    const title = start.line || `${fallbackTitle} ${index + 1}`;
    return {
      id: `chapter-${String(index + 1).padStart(3, "0")}`,
      href: `text/chapter-${String(index + 1).padStart(3, "0")}.xhtml`,
      title,
      xhtml: renderChapter(title, bodyLines.join("\n")),
      mediaType: "application/xhtml+xml",
    };
  });
}

export class TxtImporter implements LyceumImporter {
  inputFormat = "txt" as const;

  async import(input: ImportInput): Promise<ImportResult> {
    const text = decodeTextBytes(Uint8Array.from(await fs.promises.readFile(input.sourcePath)));
    const fallbackTitle = path.basename(input.sourcePath, path.extname(input.sourcePath));
    const metadata = mergeBookMetadata(fallbackTitle, input.metadata);
    const chapters = splitTextChapters(text, metadata.title);
    const textual = buildTextualContent(chapters);
    textual.fulltext = text;
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
          chapterCount: chapters.length,
          wordCount: text.split(/\s+/).filter(Boolean).length,
          preservedLineBreaks: true,
        },
      },
    };
  }
}
