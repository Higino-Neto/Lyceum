import fs from "node:fs";
import path from "node:path";
import type { ExportInput, ExportResult, LyceumExporter } from "../schema/types";

async function directorySize(rootPath: string): Promise<number> {
  let total = 0;
  const entries = await fs.promises.readdir(rootPath, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      total += await directorySize(entryPath);
    } else if (entry.isFile()) {
      total += (await fs.promises.stat(entryPath)).size;
    }
  }

  return total;
}

export class LyceumPackageExporter implements LyceumExporter {
  outputFormat = "lyceum" as const;

  canExport() {
    return { supported: true };
  }

  async export(input: ExportInput): Promise<ExportResult> {
    const sourceRoot = path.resolve(input.package.rootPath);
    const outputRoot = path.resolve(input.outputPath);

    if (sourceRoot !== outputRoot) {
      await fs.promises.mkdir(path.dirname(outputRoot), { recursive: true });
      await fs.promises.cp(sourceRoot, outputRoot, {
        recursive: true,
        errorOnExist: true,
        force: false,
      });
    }

    return {
      outputPath: outputRoot,
      outputFormat: "lyceum",
      report: {
        outputFormat: "lyceum",
        warnings: [],
        stats: {
          contentKindCount: input.package.manifest.contentKinds.length,
          chapterCount: input.package.textual?.chapters.length || 0,
          pageCount: input.package.comic?.pageCount || 0,
          packageBytes: await directorySize(outputRoot),
        },
      },
    };
  }
}
