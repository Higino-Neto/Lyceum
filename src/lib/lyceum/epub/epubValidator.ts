import JSZip from "jszip";
import { JSDOM } from "jsdom";
import { decodeTextBytes, parseContainerXml } from "./containerParser";
import { parseOpfDocument } from "./opfParser";
import { dirname, normalizeZipPath, resolveZipPath, splitHref } from "./resourceGraph";
import { validateXhtmlDocument } from "./htmlSanitizer";
import { extractCssReferences } from "./cssSanitizer";

export interface EpubValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    manifestItemCount: number;
    spineItemCount: number;
    xhtmlCount: number;
    resourceCount: number;
  };
}

function isExternalReference(href: string) {
  return !href || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href);
}

function referencedHrefs(document: Document) {
  const refs: string[] = [];
  for (const element of Array.from(document.querySelectorAll("[href],[src],[data],[poster],[srcset]"))) {
    for (const name of ["href", "src", "data", "poster"]) {
      const value = element.getAttribute(name);
      if (value) refs.push(value);
    }
    const srcset = element.getAttribute("srcset");
    if (srcset) refs.push(...srcset.split(",").map((part) => part.trim().split(/\s+/)[0]).filter(Boolean));
  }
  return refs;
}

function duplicateIds(document: Document) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const element of Array.from(document.querySelectorAll("[id]"))) {
    const id = element.getAttribute("id") || "";
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }
  return [...duplicates];
}

export async function validateEpubBuffer(input: Uint8Array | ArrayBuffer | Buffer): Promise<EpubValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  let manifestItemCount = 0;
  let spineItemCount = 0;
  let xhtmlCount = 0;
  let resourceCount = 0;

  try {
    const zip = await JSZip.loadAsync(input);
    const entries = new Map(
      Object.values(zip.files)
        .filter((entry) => !entry.dir)
        .map((entry) => [normalizeZipPath(entry.name).toLowerCase(), entry] as const),
    );
    const mimetypeEntry = zip.file("mimetype");
    const mimetype = mimetypeEntry ? await mimetypeEntry.async("text") : "";
    if (mimetype !== "application/epub+zip") errors.push("mimetype ausente ou incorreto.");

    const containerEntry = entries.get("meta-inf/container.xml");
    if (!containerEntry) throw new Error("META-INF/container.xml ausente.");
    const container = parseContainerXml(decodeTextBytes(await containerEntry.async("uint8array")));
    const opfEntry = entries.get(normalizeZipPath(container.opfPath).toLowerCase());
    if (!opfEntry) throw new Error(`OPF ausente: ${container.opfPath}`);
    const opf = parseOpfDocument(decodeTextBytes(await opfEntry.async("uint8array")));
    const opfDirectory = dirname(container.opfPath);
    const xhtmlDocuments = new Map<string, Document>();
    const pendingReferences: Array<{ from: string; href: string }> = [];
    manifestItemCount = opf.manifest.size;
    spineItemCount = opf.spine.length;

    for (const spineItem of opf.spine) {
      if (!opf.manifest.has(spineItem.idref)) errors.push(`Spine referencia id inexistente: ${spineItem.idref}`);
    }

    for (const item of opf.manifest.values()) {
      const entryPath = resolveZipPath(opfDirectory, item.href);
      const entry = entries.get(entryPath.toLowerCase());
      if (!entry) {
        errors.push(`Recurso do manifesto ausente: ${entryPath}`);
        continue;
      }
      resourceCount += 1;
      if (item.mediaType === "text/css" || /\.css$/i.test(entryPath)) {
        const css = decodeTextBytes(await entry.async("uint8array"));
        for (const href of extractCssReferences(css)) {
          if (isExternalReference(href) || href.startsWith("data:")) continue;
          const target = resolveZipPath(dirname(entryPath), splitHref(href).pathname);
          if (target && !entries.has(target.toLowerCase())) errors.push(`Referencia CSS quebrada em ${entryPath}: ${href}`);
        }
      }
      if (!/xhtml|html/i.test(item.mediaType) && !/\.x?html?$/i.test(entryPath)) continue;

      xhtmlCount += 1;
      const xhtml = decodeTextBytes(await entry.async("uint8array"));
      const validation = validateXhtmlDocument(xhtml, entryPath);
      if (!validation.valid) {
        errors.push(validation.error);
        continue;
      }
      const document = new JSDOM(xhtml, { contentType: "application/xhtml+xml" }).window.document;
      xhtmlDocuments.set(entryPath.toLowerCase(), document);
      for (const id of duplicateIds(document)) errors.push(`ID duplicado em ${entryPath}: #${id}`);
      for (const href of referencedHrefs(document)) {
        if (isExternalReference(href)) continue;
        pendingReferences.push({ from: entryPath, href });
        const pathname = splitHref(href).pathname;
        const target = pathname ? resolveZipPath(dirname(entryPath), pathname) : "";
        if (target && !entries.has(target.toLowerCase())) errors.push(`Referencia quebrada em ${entryPath}: ${href}`);
      }
    }

    for (const reference of pendingReferences) {
      const { pathname, suffix } = splitHref(reference.href);
      const fragment = suffix.startsWith("#") ? suffix.slice(1).split("?", 1)[0] : "";
      if (!fragment) continue;
      const targetPath = pathname ? resolveZipPath(dirname(reference.from), pathname) : reference.from;
      const targetDocument = xhtmlDocuments.get(targetPath.toLowerCase());
      if (!targetDocument) continue;
      let decodedFragment = fragment;
      try { decodedFragment = decodeURIComponent(fragment); } catch { /* Validate the literal fragment. */ }
      if (!targetDocument.getElementById(decodedFragment)) errors.push(`Anchor quebrado em ${reference.from}: ${reference.href}`);
    }

    if (spineItemCount === 0) warnings.push("EPUB sem itens no spine.");
    if (xhtmlCount === 0) errors.push("EPUB sem documentos XHTML.");
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  return {
    valid: errors.length === 0,
    errors: [...new Set(errors)],
    warnings: [...new Set(warnings)],
    stats: { manifestItemCount, spineItemCount, xhtmlCount, resourceCount },
  };
}
