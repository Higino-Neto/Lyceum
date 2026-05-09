import path from "node:path";
import type {
  BookFormat,
  LyceumBookMetadata,
  LyceumContentKind,
  LyceumManifest,
} from "./types";

export function createPackageId(sourcePath: string, createdAt: string) {
  const baseName = path.basename(sourcePath).replace(/\W+/g, "-").replace(/^-|-$/g, "");
  return `lyceum-${baseName || "book"}-${Date.parse(createdAt).toString(36)}`;
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
  };
}

