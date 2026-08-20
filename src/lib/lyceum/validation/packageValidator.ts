import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";
import type { LyceumPackage } from "../schema/types";
import { textualResourcePath } from "../package/paths";
import { extractCssReferences } from "../epub/cssSanitizer";
import { validateXhtmlDocument } from "../epub/htmlSanitizer";

export interface LyceumPackageValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    chapterCount: number;
    resourceCount: number;
    checkedReferenceCount: number;
  };
}

function canonicalPath(value: string) {
  const pathname = value.split(/[?#]/, 1)[0].replace(/\\/g, "/");
  let decoded = pathname;
  try { decoded = decodeURIComponent(pathname); } catch { /* Keep malformed path for diagnostics. */ }
  return path.posix.normalize(decoded).replace(/^\.\//, "").replace(/^\/+/, "");
}

function decodeFragment(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function resolveHref(fromHref: string, href: string) {
  const base = path.posix.dirname(canonicalPath(fromHref));
  return canonicalPath(path.posix.join(base === "." ? "" : base, href));
}

function isExternal(href: string) {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href);
}

function duplicateValues(values: string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values.map((item) => item.toLowerCase())) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

function chapterReferences(document: Document) {
  const references: string[] = [];
  for (const element of Array.from(document.querySelectorAll("[href],[src],[data],[poster],[srcset],[style]"))) {
    for (const attr of ["href", "src", "data", "poster"]) {
      const value = element.getAttribute(attr);
      if (value) references.push(value);
    }
    const srcset = element.getAttribute("srcset");
    if (srcset) references.push(...srcset.split(",").map((part) => part.trim().split(/\s+/)[0]).filter(Boolean));
    const style = element.getAttribute("style");
    if (style) references.push(...extractCssReferences(style));
  }
  for (const style of Array.from(document.querySelectorAll("style"))) references.push(...extractCssReferences(style.textContent || ""));
  return references;
}

function dataExists(pkg: LyceumPackage, href: string, data: Uint8Array | ArrayBuffer | undefined) {
  return Boolean(data) || fs.existsSync(textualResourcePath(pkg.rootPath, href));
}

export function validateLyceumPackage(pkg: LyceumPackage): LyceumPackageValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const textual = pkg.textual;
  let checkedReferenceCount = 0;

  if (pkg.manifest.contentKinds.includes("textual") && !textual) errors.push("Manifesto declara conteudo textual, mas o pacote nao possui textual.");
  if (!textual) {
    return { valid: errors.length === 0, errors, warnings, stats: { chapterCount: 0, resourceCount: 0, checkedReferenceCount } };
  }

  for (const duplicate of duplicateValues(textual.chapters.map((item) => item.id))) errors.push(`ID de capitulo duplicado: ${duplicate}`);
  for (const duplicate of duplicateValues(textual.chapters.map((item) => canonicalPath(item.href)))) errors.push(`Href de capitulo duplicado: ${duplicate}`);
  for (const duplicate of duplicateValues((textual.resources || []).map((item) => canonicalPath(item.href)))) errors.push(`Href de recurso duplicado: ${duplicate}`);

  const chapters = new Map(textual.chapters.map((chapter) => [canonicalPath(chapter.href).toLowerCase(), chapter]));
  const resources = new Map((textual.resources || []).map((resource) => [canonicalPath(resource.href).toLowerCase(), resource]));
  const allTargets = new Set([...chapters.keys(), ...resources.keys()]);

  for (const spine of textual.spine) {
    if (!chapters.has(canonicalPath(spine.href).toLowerCase())) errors.push(`Spine referencia capitulo ausente: ${spine.href}`);
  }
  for (const chapter of textual.chapters) {
    if (!textual.spine.some((item) => canonicalPath(item.href).toLowerCase() === canonicalPath(chapter.href).toLowerCase())) {
      warnings.push(`Capitulo fora do spine preservado como conteudo extra: ${chapter.href}`);
    }
  }
  for (const toc of textual.toc) {
    if (!chapters.has(canonicalPath(toc.href).toLowerCase())) errors.push(`TOC referencia capitulo ausente: ${toc.href}`);
    if (!Number.isInteger(toc.level) || toc.level < 1) errors.push(`Nivel de TOC invalido em ${toc.href}: ${toc.level}`);
  }

  for (const resource of textual.resources || []) {
    if (!dataExists(pkg, resource.href, resource.data)) errors.push(`Dados do recurso ausentes: ${resource.href}`);
  }

  for (const chapter of textual.chapters) {
    const validation = validateXhtmlDocument(chapter.xhtml, chapter.href);
    if (!validation.valid) {
      errors.push(validation.error);
      continue;
    }
    const document = new JSDOM(chapter.xhtml, { contentType: "application/xhtml+xml" }).window.document;
    const ids = new Set(Array.from(document.querySelectorAll("[id]")).map((element) => element.getAttribute("id") || ""));
    for (const reference of chapterReferences(document)) {
      checkedReferenceCount += 1;
      if (!reference || isExternal(reference)) continue;
      if (reference.startsWith("#")) {
        const fragment = decodeFragment(reference.slice(1));
        if (fragment && !ids.has(fragment)) errors.push(`Anchor ausente em ${chapter.href}: ${reference}`);
        continue;
      }
      const [pathname, fragment] = reference.split("#", 2);
      const targetPath = resolveHref(chapter.href, pathname);
      if (!allTargets.has(targetPath.toLowerCase())) {
        errors.push(`Referencia quebrada em ${chapter.href}: ${reference}`);
      } else if (fragment) {
        const targetChapter = chapters.get(targetPath.toLowerCase());
        if (targetChapter) {
          const targetDocument = new JSDOM(targetChapter.xhtml, { contentType: "application/xhtml+xml" }).window.document;
          if (!targetDocument.getElementById(decodeFragment(fragment))) errors.push(`Anchor de destino ausente em ${chapter.href}: ${reference}`);
        }
      }
    }
  }

  for (const resource of textual.resources || []) {
    if (resource.mediaType !== "text/css" || !resource.data) continue;
    const bytes = resource.data instanceof ArrayBuffer ? new Uint8Array(resource.data) : resource.data;
    const css = new TextDecoder().decode(bytes);
    for (const reference of extractCssReferences(css)) {
      checkedReferenceCount += 1;
      if (isExternal(reference) || reference.startsWith("data:")) continue;
      const target = resolveHref(resource.href, reference);
      if (!allTargets.has(target.toLowerCase())) errors.push(`Referencia CSS quebrada em ${resource.href}: ${reference}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors: [...new Set(errors)],
    warnings: [...new Set(warnings)],
    stats: { chapterCount: textual.chapters.length, resourceCount: textual.resources?.length || 0, checkedReferenceCount },
  };
}
