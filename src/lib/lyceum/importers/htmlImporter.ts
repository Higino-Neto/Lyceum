import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";
import postcss from "postcss";
import { createManifest, mergeBookMetadata } from "../schema/manifest";
import type {
  ImportInput,
  ImportResult,
  LyceumImporter,
  LyceumTextualChapter,
  LyceumTextualResource,
} from "../schema/types";
import { buildTextualContent, stripHtml } from "../textual";
import { writeLyceumPackageAsync } from "../package/write";
import { decodeHtmlBytes, sanitizeHtmlDocument } from "../epub/htmlSanitizer";
import { decodeTextBytes } from "../epub/containerParser";
import { extractCssReferences } from "../epub/cssSanitizer";
import { inferMediaType } from "../epub/resourceGraph";

const CHAPTER_HREF = "text/chapter-001.xhtml";

function isExternal(value: string) {
  return !value || value.startsWith("#") || /^(?:data:|https?:|mailto:|tel:|javascript:|\/\/)/i.test(value);
}

function cleanReference(value: string) {
  const pathname = value.split(/[?#]/, 1)[0];
  try { return decodeURIComponent(pathname); } catch { return pathname; }
}

function isInside(root: string, target: string) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function packageHref(sourceRoot: string, absolutePath: string) {
  const relative = path.relative(sourceRoot, absolutePath).replace(/\\/g, "/");
  return `resources/${relative.replace(/^\/+/, "")}`;
}

function relativePackageHref(fromHref: string, toHref: string) {
  return path.posix.relative(path.posix.dirname(fromHref), toHref) || path.posix.basename(toHref);
}

function rewriteCss(css: string, cssHref: string, replacements: Map<string, string>) {
  try {
    const root = postcss.parse(css);
    root.walkAtRules("import", (rule) => {
      const original = rule.params.match(/^(?:url\(\s*)?["']?([^"')\s]+)["']?/i)?.[1];
      const replacement = original ? replacements.get(original) : undefined;
      if (original && replacement) rule.params = `url("${relativePackageHref(cssHref, replacement)}")`;
    });
    root.walkDecls((declaration) => {
      declaration.value = declaration.value.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi, (match, _quote, original) => {
        const replacement = replacements.get(original);
        return replacement ? `url("${relativePackageHref(cssHref, replacement)}")` : match;
      });
    });
    return root.toString();
  } catch {
    return css;
  }
}

async function collectHtmlResources(sourcePath: string, rawHtml: string, warnings: string[]) {
  const sourceRoot = path.dirname(sourcePath);
  const dom = new JSDOM(rawHtml, { contentType: "text/html" });
  const document = dom.window.document;
  document.querySelectorAll("base").forEach((element) => element.remove());
  const resources = new Map<string, LyceumTextualResource>();
  const absoluteToHref = new Map<string, string>();

  const resolveLocal = (reference: string, fromPath: string) => {
    if (isExternal(reference) || path.isAbsolute(cleanReference(reference))) return null;
    const absolute = path.resolve(path.dirname(fromPath), cleanReference(reference));
    if (!isInside(sourceRoot, absolute)) {
      warnings.push(`Recurso HTML fora da pasta do documento foi bloqueado: ${reference}`);
      return null;
    }
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
      warnings.push(`Recurso HTML nao encontrado: ${reference}`);
      return null;
    }
    return absolute;
  };

  const loadResource = async (absolute: string): Promise<string> => {
    const known = absoluteToHref.get(absolute.toLowerCase());
    if (known) return known;
    const href = packageHref(sourceRoot, absolute);
    absoluteToHref.set(absolute.toLowerCase(), href);
    const bytes = Uint8Array.from(await fs.promises.readFile(absolute));
    const mediaType = inferMediaType(absolute);
    const id = `resource-${String(resources.size + 1).padStart(3, "0")}`;
    resources.set(href.toLowerCase(), { id, href, mediaType, data: bytes });

    if (mediaType === "text/css") {
      const css = decodeTextBytes(bytes);
      const replacements = new Map<string, string>();
      for (const reference of extractCssReferences(css)) {
        const target = resolveLocal(reference, absolute);
        if (target) replacements.set(reference, await loadResource(target));
      }
      resources.get(href.toLowerCase())!.data = new TextEncoder().encode(rewriteCss(css, href, replacements));
    }
    return href;
  };

  for (const element of Array.from(document.querySelectorAll("[src],[href],[data],[poster],[srcset]"))) {
    for (const attribute of ["src", "href", "data", "poster"]) {
      const reference = element.getAttribute(attribute);
      if (!reference) continue;
      const target = resolveLocal(reference, sourcePath);
      if (target) element.setAttribute(attribute, relativePackageHref(CHAPTER_HREF, await loadResource(target)));
    }
    const srcset = element.getAttribute("srcset");
    if (srcset) {
      const rewritten = await Promise.all(srcset.split(",").map(async (candidate) => {
        const [reference, descriptor] = candidate.trim().split(/\s+/, 2);
        const target = resolveLocal(reference, sourcePath);
        const href = target ? relativePackageHref(CHAPTER_HREF, await loadResource(target)) : reference;
        return `${href}${descriptor ? ` ${descriptor}` : ""}`;
      }));
      element.setAttribute("srcset", rewritten.join(", "));
    }
  }

  for (const element of Array.from(document.querySelectorAll("[style],style"))) {
    const css = element.localName === "style" ? element.textContent || "" : element.getAttribute("style") || "";
    const replacements = new Map<string, string>();
    for (const reference of extractCssReferences(css)) {
      const target = resolveLocal(reference, sourcePath);
      if (target) replacements.set(reference, await loadResource(target));
    }
    const rewritten = rewriteCss(css, CHAPTER_HREF, replacements);
    if (element.localName === "style") element.textContent = rewritten;
    else element.setAttribute("style", rewritten);
  }

  return { html: document.documentElement.outerHTML, resources: [...resources.values()] };
}

export class HtmlImporter implements LyceumImporter {
  inputFormat = "html" as const;

  async import(input: ImportInput): Promise<ImportResult> {
    const raw = decodeHtmlBytes(Uint8Array.from(await fs.promises.readFile(input.sourcePath)));
    const warnings: string[] = [];
    const collected = await collectHtmlResources(input.sourcePath, raw, warnings);
    const inferredTitle = stripHtml(new JSDOM(raw, { contentType: "text/html" }).window.document.title);
    const fallbackTitle = inferredTitle || path.basename(input.sourcePath, path.extname(input.sourcePath));
    const metadata = mergeBookMetadata(fallbackTitle, input.metadata);
    const sanitized = sanitizeHtmlDocument(collected.html, metadata.title);
    const chapters: LyceumTextualChapter[] = [{
      id: "chapter-001",
      href: CHAPTER_HREF,
      title: metadata.title,
      xhtml: sanitized.xhtml,
      mediaType: "application/xhtml+xml",
    }];
    const textual = buildTextualContent(chapters, { resources: collected.resources });
    const manifest = createManifest({
      sourcePath: input.sourcePath,
      sourceFormat: "html",
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
        sourceFormat: "html",
        contentKinds: ["textual"],
        warnings,
        stats: {
          chapterCount: 1,
          resourceCount: collected.resources.length,
          wordCount: textual.fulltext.split(/\s+/).filter(Boolean).length,
          preservedMarkup: true,
        },
      },
    };
  }
}
