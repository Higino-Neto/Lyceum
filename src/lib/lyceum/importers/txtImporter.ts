import fs from "node:fs";
import path from "node:path";
import { createManifest, mergeBookMetadata } from "../schema/manifest";
import type { ImportInput, ImportResult, LyceumImporter } from "../schema/types";
import { buildTextualContent } from "../textual";
import { splitTextChapters } from "./txtChapters";
import { writeLyceumPackageAsync } from "../package/write";
import { decodeTextBytes } from "../epub/containerParser";

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
