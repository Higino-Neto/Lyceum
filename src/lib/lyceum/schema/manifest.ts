import path from "node:path";
import type {
  BookFormat,
  LyceumBookMetadata,
  LyceumContentKind,
  LyceumManifest,
} from "./types";

export function createPackageId(sourcePath: string, createdAt: string) {
  const baseName = path.basename(sourcePath).replace(/\W+/g, "-").replace(/^-|-$/g, "");
  const parsedDate = Date.parse(createdAt);
  const suffix = Number.isFinite(parsedDate) ? parsedDate.toString(36) : "undated";
  return `lyceum-${baseName || "book"}-${suffix}`;
}

export function createManifest(args: {
  sourcePath: string;
  sourceFormat: BookFormat;
  metadata: LyceumBookMetadata;
  primaryContentKind: LyceumContentKind;
  contentKinds: LyceumContentKind[];
  now?: string;
}): LyceumManifest {
  const createdAt = args.now || new Date().toISOString();

  return {
    schemaVersion: 1,
    packageId: createPackageId(args.sourcePath, createdAt),
    title: args.metadata.title,
    sourceFormat: args.sourceFormat,
    originalFileName: path.basename(args.sourcePath),
    primaryContentKind: args.primaryContentKind,
    contentKinds: Array.from(new Set(args.contentKinds)),
    createdAt,
    updatedAt: createdAt,
  };
}

export function mergeBookMetadata(
  fallbackTitle: string,
  metadata: Partial<LyceumBookMetadata> | undefined,
): LyceumBookMetadata {
  return {
    title: metadata?.title?.trim() || fallbackTitle,
    author: metadata?.author || undefined,
    language: metadata?.language || "pt-BR",
    identifier: metadata?.identifier || undefined,
    publisher: metadata?.publisher || undefined,
    description: metadata?.description || undefined,
    publishDate: metadata?.publishDate || undefined,
    subject: metadata?.subject || undefined,
    rights: metadata?.rights || undefined,
    contributor: metadata?.contributor || undefined,
    authorSort: metadata?.authorSort || undefined,
    titleSort: metadata?.titleSort || undefined,
    series: metadata?.series || undefined,
    seriesIndex: metadata?.seriesIndex || undefined,
    groupPosition: metadata?.groupPosition || undefined,
    displaySeq: metadata?.displaySeq || undefined,
    isbn: metadata?.isbn || undefined,
    asin: metadata?.asin || undefined,
    rating: metadata?.rating || undefined,
    timestamp: metadata?.timestamp || undefined,
    coverResourceId: metadata?.coverResourceId || undefined,
    coverHref: metadata?.coverHref || undefined,
    coverPageHref: metadata?.coverPageHref || undefined,
  };
}

export function mergeDefinedBookMetadata(
  base: LyceumBookMetadata,
  overrides: Partial<LyceumBookMetadata> | undefined,
): LyceumBookMetadata {
  const metadata = { ...base };

  for (const [key, value] of Object.entries(overrides || {}) as Array<
    [keyof LyceumBookMetadata, LyceumBookMetadata[keyof LyceumBookMetadata] | undefined]
  >) {
    if (value !== undefined && value !== null) {
      (metadata as Record<keyof LyceumBookMetadata, LyceumBookMetadata[keyof LyceumBookMetadata]>)[key] = value;
    }
  }

  metadata.title = metadata.title?.trim() || base.title;
  metadata.language = metadata.language || base.language || "pt-BR";
  return metadata;
}
