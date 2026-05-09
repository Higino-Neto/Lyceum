import path from "node:path";
import type { BookFormat } from "../schema/types";

export const LYCEUM_SCHEMA_VERSION = 1;

export function originalSourcePath(rootPath: string, sourceFormat: BookFormat, originalFileName?: string) {
  const extension = sourceFormat === "lyceum" ? "" : `.${sourceFormat}`;
  return path.join(rootPath, "original", originalFileName || `source${extension}`);
}

export function textualChapterPath(rootPath: string, href: string) {
  return path.join(rootPath, "content", "textual", "chapters", path.basename(href));
}

export function metadataPath(rootPath: string) {
  return path.join(rootPath, "metadata", "book.json");
}

export function manifestPath(rootPath: string) {
  return path.join(rootPath, "manifest.json");
}

export function textualSpinePath(rootPath: string) {
  return path.join(rootPath, "content", "textual", "spine.json");
}

export function textualTocPath(rootPath: string) {
  return path.join(rootPath, "content", "textual", "toc.json");
}

export function textualFulltextPath(rootPath: string) {
  return path.join(rootPath, "content", "textual", "fulltext.txt");
}

