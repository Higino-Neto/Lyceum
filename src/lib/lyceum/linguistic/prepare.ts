import fs from "node:fs";
import path from "node:path";
import type { BookFormat, LyceumPackage } from "../schema/types";
import { manifestPath } from "../package/paths";
import { readLyceumPackage } from "../package/read";
import { createDefaultConversionRegistry } from "../conversion/registry";
import { analyzeDocument, type ChapterInput } from "../../../core/language-learning/analysis/analyzeDocument";
import { getLanguageModule, normalizeLanguageCode } from "../../../core/language-learning/languages/registry";
import { detectLanguage } from "../../../core/language-learning/languages/detect";
import { extractBlocksFromXhtml } from "./blocks";
import {
  isCompatibleIndex,
  packageLinguisticIndexPath,
  readLinguisticIndexHeader,
  writeLinguisticIndex,
} from "./store";

export interface PrepareLearningInput {
  sourcePath: string;
  sourceFormat: BookFormat;
  /** Managed cache directory (e.g. `<userData>/language-learning`). */
  cacheRoot: string;
  /** Stable cache key for the source file (its content hash). */
  cacheKey: string;
  /** Language override; defaults to the book metadata language. */
  language?: string;
  force?: boolean;
  onProgress?: (progress: number, message: string) => void;
}

export interface PrepareLearningResult {
  packageRoot: string;
  indexPath: string;
  documentId: string;
  title: string;
  language: string;
  /** Language declared by the book metadata, if any. */
  metadataLanguage: string | null;
  /** Language identified from the text itself, if confident. */
  detectedLanguage: string | null;
  reused: boolean;
}

function safeKey(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120) || "document";
}

export function buildChapterInputs(pkg: LyceumPackage): ChapterInput[] {
  const textual = pkg.textual;
  if (!textual) return [];
  const tocTitles = new Map<string, string>();
  for (const item of textual.toc) {
    const href = item.href.split("#")[0] ?? item.href;
    if (!tocTitles.has(href)) tocTitles.set(href, item.title);
  }
  return textual.chapters.map((chapter, index) => ({
    id: chapter.id || `chapter-${index + 1}`,
    href: chapter.href,
    title: tocTitles.get(chapter.href) || chapter.title || `${index + 1}`,
    blocks: extractBlocksFromXhtml(chapter.xhtml),
  })).filter((chapter) => chapter.blocks.length > 0);
}

function sampleText(chapters: ChapterInput[], limit = 60_000) {
  const parts: string[] = [];
  let length = 0;
  // Skip the first chapter when possible: front matter is often in another language.
  const ordered = chapters.length > 2 ? [...chapters.slice(1), chapters[0]!] : chapters;
  for (const chapter of ordered) {
    for (const block of chapter.blocks) {
      parts.push(block.text);
      length += block.text.length;
      if (length >= limit) return parts.join("\n");
    }
  }
  return parts.join("\n");
}

/**
 * Ensures a `.lyceum` package with a linguistic index exists for the source.
 * Non-`.lyceum` sources are imported once into the managed cache. `.lyceum`
 * packages from the library are never modified (their directory hash is
 * their identity): their index lives in a cache sidecar unless the package
 * already ships a compatible one.
 */
export async function prepareLearningDocument(input: PrepareLearningInput): Promise<PrepareLearningResult> {
  const key = safeKey(input.cacheKey);
  const progress = input.onProgress ?? (() => undefined);
  let packageRoot: string;
  let sidecarIndexPath: string | null = null;

  if (input.sourceFormat === "lyceum") {
    packageRoot = input.sourcePath;
    sidecarIndexPath = path.join(input.cacheRoot, "indexes", key, "document.json");
  } else {
    packageRoot = path.join(input.cacheRoot, "packages", `${key}.lyceum`);
    if (input.force || !fs.existsSync(manifestPath(packageRoot))) {
      const importer = createDefaultConversionRegistry().getImporter(input.sourceFormat);
      if (!importer) throw new Error(`UNSUPPORTED_FORMAT:${input.sourceFormat}`);
      await fs.promises.rm(packageRoot, { recursive: true, force: true });
      await fs.promises.mkdir(packageRoot, { recursive: true });
      progress(0.05, "import");
      await importer.import({
        sourcePath: input.sourcePath,
        sourceFormat: input.sourceFormat,
        packageRoot,
        onProgress: (value) => progress(0.05 + value * 0.45, "import"),
      });
    }
  }

  const pkg = readLyceumPackage(packageRoot);
  if (!pkg.textual || pkg.textual.chapters.length === 0) throw new Error("NO_TEXTUAL_CONTENT");

  const metadataLanguage = pkg.metadata.language ? normalizeLanguageCode(pkg.metadata.language) : null;
  const chapters = buildChapterInputs(pkg);
  const detectedLanguage = detectLanguage(sampleText(chapters))?.language ?? null;
  // Text evidence beats metadata: imports default a missing language, and a
  // wrong label would file the reader's vocabulary under the wrong language.
  const language = normalizeLanguageCode(input.language || detectedLanguage || metadataLanguage || "und");
  const module = getLanguageModule(language);
  const expected = { language: module.code, module: module.id, moduleVersion: module.version };

  const packageIndexPath = packageLinguisticIndexPath(packageRoot);
  const candidates = sidecarIndexPath ? [packageIndexPath, sidecarIndexPath] : [packageIndexPath];
  if (!input.force) {
    for (const candidate of candidates) {
      if (isCompatibleIndex(await readLinguisticIndexHeader(candidate), expected)) {
        progress(1, "ready");
        return {
          packageRoot,
          indexPath: candidate,
          documentId: pkg.manifest.packageId,
          title: pkg.metadata.title,
          language: module.code,
          metadataLanguage,
          detectedLanguage,
          reused: true,
        };
      }
    }
  }

  progress(0.5, "analyze");
  const document = analyzeDocument(
    { documentId: pkg.manifest.packageId, title: pkg.metadata.title, language: module.code, chapters },
    module,
    { onProgress: (value) => progress(0.5 + value * 0.45, "analyze") },
  );
  const indexPath = sidecarIndexPath ?? packageIndexPath;
  await writeLinguisticIndex(indexPath, document);
  progress(1, "ready");

  return {
    packageRoot,
    indexPath,
    documentId: pkg.manifest.packageId,
    title: pkg.metadata.title,
    language: module.code,
    metadataLanguage,
    detectedLanguage,
    reused: false,
  };
}
