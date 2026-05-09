import fs from "node:fs";
import path from "node:path";
import type {
  LyceumBookMetadata,
  LyceumManifest,
  LyceumPackage,
  LyceumTextualContent,
} from "../schema/types";
import {
  manifestPath,
  metadataPath,
  originalSourcePath,
  textualChapterPath,
  textualFulltextPath,
  textualSpinePath,
  textualTocPath,
} from "./paths";

function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath: string, value: unknown) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function ensureLyceumPackageDirs(rootPath: string) {
  [
    "original",
    "metadata",
    "assets/images",
    "content/textual/chapters",
    "content/pdf/pages",
    "content/comic/pages",
    "user-data",
    "indexes",
    "exports",
  ].forEach((relativePath) => ensureDir(path.join(rootPath, relativePath)));
}

export function initializeUserData(rootPath: string) {
  const defaults: Array<[string, unknown]> = [
    ["progress.json", { currentLocation: null, updatedAt: null }],
    ["annotations.json", []],
    ["bookmarks.json", []],
    ["vocabulary.json", { words: [] }],
  ];

  for (const [fileName, value] of defaults) {
    const filePath = path.join(rootPath, "user-data", fileName);
    if (!fs.existsSync(filePath)) {
      writeJson(filePath, value);
    }
  }
}

export function writeOriginalSource(args: {
  rootPath: string;
  sourcePath: string;
  sourceFormat: LyceumManifest["sourceFormat"];
}) {
  const target = originalSourcePath(args.rootPath, args.sourceFormat, path.basename(args.sourcePath));
  ensureDir(path.dirname(target));
  fs.copyFileSync(args.sourcePath, target);
  return target;
}

export function writeTextualContent(rootPath: string, textual: LyceumTextualContent) {
  ensureDir(path.join(rootPath, "content", "textual", "chapters"));

  for (const chapter of textual.chapters) {
    fs.writeFileSync(textualChapterPath(rootPath, chapter.href), chapter.xhtml, "utf8");
  }

  writeJson(textualSpinePath(rootPath), textual.spine);
  writeJson(textualTocPath(rootPath), textual.toc);
  fs.writeFileSync(textualFulltextPath(rootPath), textual.fulltext, "utf8");
}

export function writeLyceumPackage(args: {
  rootPath: string;
  manifest: LyceumManifest;
  metadata: LyceumBookMetadata;
  textual?: LyceumTextualContent;
  sourcePath?: string;
}): LyceumPackage {
  ensureLyceumPackageDirs(args.rootPath);

  if (args.sourcePath) {
    writeOriginalSource({
      rootPath: args.rootPath,
      sourcePath: args.sourcePath,
      sourceFormat: args.manifest.sourceFormat,
    });
  }

  writeJson(manifestPath(args.rootPath), args.manifest);
  writeJson(metadataPath(args.rootPath), args.metadata);

  if (args.textual) {
    writeTextualContent(args.rootPath, args.textual);
  }

  initializeUserData(args.rootPath);

  return {
    rootPath: args.rootPath,
    manifest: args.manifest,
    metadata: args.metadata,
    textual: args.textual,
  };
}

