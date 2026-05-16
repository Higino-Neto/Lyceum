import path from "node:path";
import type { BookFormat } from "../schema/types";

export const LYCEUM_SCHEMA_VERSION = 1;
const TEXTUAL_ROOT = path.join("content", "textual");

function normalizePackageRelativePath(value: string, fallback: string) {
  const withoutFragment = value.split("#")[0].split("?")[0];
  const decoded = (() => {
    try {
      return decodeURIComponent(withoutFragment);
    } catch {
      return withoutFragment;
    }
  })();
  const normalized = decoded.replace(/\\/g, "/").replace(/^\/+/, "");
  const parts = path.posix
    .normalize(normalized)
    .split("/")
    .filter((part) => part && part !== "." && part !== "..");

  return parts.join("/") || fallback;
}

function packagePath(rootPath: string, basePath: string, relativePath: string, fallback: string) {
  const safeRelativePath = normalizePackageRelativePath(relativePath, fallback);
  const root = path.resolve(rootPath, basePath);
  const target = path.resolve(root, ...safeRelativePath.split("/"));

  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Caminho invalido dentro do pacote .lyceum: ${relativePath}`);
  }

  return target;
}

export function textualRelativePath(value: string, fallback: string) {
  return normalizePackageRelativePath(value, fallback);
}

export function originalSourcePath(rootPath: string, sourceFormat: BookFormat, originalFileName?: string) {
  const extension = sourceFormat === "lyceum" ? "" : `.${sourceFormat}`;
  return path.join(rootPath, "original", originalFileName || `source${extension}`);
}

export function textualChapterPath(rootPath: string, href: string) {
  return packagePath(rootPath, path.join(TEXTUAL_ROOT, "chapters"), href, "chapter.xhtml");
}

export function textualResourcePath(rootPath: string, href: string) {
  return packagePath(rootPath, path.join(TEXTUAL_ROOT, "resources"), href, "resource.bin");
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

export function textualResourcesPath(rootPath: string) {
  return path.join(rootPath, "content", "textual", "resources.json");
}

