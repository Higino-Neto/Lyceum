import fs from "node:fs";
import path from "node:path";
import type {
  LyceumBookMetadata,
  LyceumComicContent,
  LyceumManifest,
  LyceumPackage,
  LyceumTextualContent,
} from "../schema/types";
import {
  comicPagesPath,
  manifestPath,
  metadataPath,
  originalSourcePath,
  textualChapterPath,
  textualFulltextPath,
  textualResourcePath,
  textualResourcesPath,
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

async function ensureDirAsync(dirPath: string) {
  await fs.promises.mkdir(dirPath, { recursive: true });
}

async function writeJsonAsync(filePath: string, value: unknown) {
  await ensureDirAsync(path.dirname(filePath));
  await fs.promises.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function ensureLyceumPackageDirs(rootPath: string) {
  [
    "original",
    "metadata",
    "assets/images",
    "content/textual/chapters",
    "content/textual/resources",
    "content/pdf/pages",
    "content/comic/pages",
    "user-data",
    "indexes",
    "exports",
  ].forEach((relativePath) => ensureDir(path.join(rootPath, relativePath)));
}

export async function ensureLyceumPackageDirsAsync(rootPath: string) {
  await Promise.all(
    [
      "original",
      "metadata",
      "assets/images",
      "content/textual/chapters",
      "content/textual/resources",
      "content/pdf/pages",
      "content/comic/pages",
      "user-data",
      "indexes",
      "exports",
    ].map((relativePath) => ensureDirAsync(path.join(rootPath, relativePath))),
  );
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

export async function initializeUserDataAsync(rootPath: string) {
  const defaults: Array<[string, unknown]> = [
    ["progress.json", { currentLocation: null, updatedAt: null }],
    ["annotations.json", []],
    ["bookmarks.json", []],
    ["vocabulary.json", { words: [] }],
  ];

  await Promise.all(
    defaults.map(async ([fileName, value]) => {
      const filePath = path.join(rootPath, "user-data", fileName);
      try {
        await fs.promises.access(filePath);
      } catch {
        await writeJsonAsync(filePath, value);
      }
    }),
  );
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

export async function writeOriginalSourceAsync(args: {
  rootPath: string;
  sourcePath: string;
  sourceFormat: LyceumManifest["sourceFormat"];
}) {
  const target = originalSourcePath(args.rootPath, args.sourceFormat, path.basename(args.sourcePath));
  await ensureDirAsync(path.dirname(target));
  await fs.promises.copyFile(args.sourcePath, target);
  return target;
}

function resourceManifest(textual: LyceumTextualContent) {
  return (textual.resources || []).map((resource) => {
    const { data, ...manifestResource } = resource;
    void data;
    return manifestResource;
  });
}

function resourceDataBuffer(data: Uint8Array | ArrayBuffer) {
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
}

export function writeTextualContent(rootPath: string, textual: LyceumTextualContent) {
  ensureDir(path.join(rootPath, "content", "textual", "chapters"));

  for (const chapter of textual.chapters) {
    const chapterPath = textualChapterPath(rootPath, chapter.href);
    ensureDir(path.dirname(chapterPath));
    fs.writeFileSync(chapterPath, chapter.xhtml, "utf8");
  }

  for (const resource of textual.resources || []) {
    if (!resource.data) continue;
    const resourcePath = textualResourcePath(rootPath, resource.href);
    ensureDir(path.dirname(resourcePath));
    fs.writeFileSync(resourcePath, resourceDataBuffer(resource.data));
  }

  writeJson(textualSpinePath(rootPath), textual.spine);
  writeJson(textualTocPath(rootPath), textual.toc);
  writeJson(textualResourcesPath(rootPath), resourceManifest(textual));
  fs.writeFileSync(textualFulltextPath(rootPath), textual.fulltext, "utf8");
}

export async function writeTextualContentAsync(rootPath: string, textual: LyceumTextualContent) {
  await ensureDirAsync(path.join(rootPath, "content", "textual", "chapters"));

  await Promise.all(
    textual.chapters.map(async (chapter) => {
      const chapterPath = textualChapterPath(rootPath, chapter.href);
      await ensureDirAsync(path.dirname(chapterPath));
      await fs.promises.writeFile(chapterPath, chapter.xhtml, "utf8");
    }),
  );

  await Promise.all(
    (textual.resources || []).map(async (resource) => {
      if (!resource.data) return;
      const resourcePath = textualResourcePath(rootPath, resource.href);
      await ensureDirAsync(path.dirname(resourcePath));
      await fs.promises.writeFile(resourcePath, resourceDataBuffer(resource.data));
    }),
  );

  await writeJsonAsync(textualSpinePath(rootPath), textual.spine);
  await writeJsonAsync(textualTocPath(rootPath), textual.toc);
  await writeJsonAsync(textualResourcesPath(rootPath), resourceManifest(textual));
  await fs.promises.writeFile(textualFulltextPath(rootPath), textual.fulltext, "utf8");
}

export function writeComicContent(rootPath: string, comic: LyceumComicContent) {
  writeJson(comicPagesPath(rootPath), comic);
}

export async function writeComicContentAsync(rootPath: string, comic: LyceumComicContent) {
  await writeJsonAsync(comicPagesPath(rootPath), comic);
}

export function writeLyceumPackage(args: {
  rootPath: string;
  manifest: LyceumManifest;
  metadata: LyceumBookMetadata;
  textual?: LyceumTextualContent;
  comic?: LyceumComicContent;
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

  if (args.comic) {
    writeComicContent(args.rootPath, args.comic);
  }

  initializeUserData(args.rootPath);

  return {
    rootPath: args.rootPath,
    manifest: args.manifest,
    metadata: args.metadata,
    textual: args.textual,
    comic: args.comic,
  };
}

export async function writeLyceumPackageAsync(args: {
  rootPath: string;
  manifest: LyceumManifest;
  metadata: LyceumBookMetadata;
  textual?: LyceumTextualContent;
  comic?: LyceumComicContent;
  sourcePath?: string;
}): Promise<LyceumPackage> {
  await ensureLyceumPackageDirsAsync(args.rootPath);

  if (args.sourcePath) {
    await writeOriginalSourceAsync({
      rootPath: args.rootPath,
      sourcePath: args.sourcePath,
      sourceFormat: args.manifest.sourceFormat,
    });
  }

  await writeJsonAsync(manifestPath(args.rootPath), args.manifest);
  await writeJsonAsync(metadataPath(args.rootPath), args.metadata);

  if (args.textual) {
    await writeTextualContentAsync(args.rootPath, args.textual);
  }

  if (args.comic) {
    await writeComicContentAsync(args.rootPath, args.comic);
  }

  await initializeUserDataAsync(args.rootPath);

  return {
    rootPath: args.rootPath,
    manifest: args.manifest,
    metadata: args.metadata,
    textual: args.textual,
    comic: args.comic,
  };
}
