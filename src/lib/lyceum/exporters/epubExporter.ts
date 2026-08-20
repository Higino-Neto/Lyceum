import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { renderDefaultCss } from "../../pdf-to-epub/html";
import { mergeDefinedBookMetadata } from "../schema/manifest";
import type {
  ExportInput,
  ExportResult,
  LyceumBookMetadata,
  LyceumMetadataEntry,
  LyceumPackage,
  LyceumExporter,
  LyceumTextualChapter,
  LyceumTextualResource,
  LyceumTocItem,
} from "../schema/types";
import { escapeXml, isPlaceholderTitle } from "../textual";
import { textualRelativePath, textualResourcePath } from "../package/paths";
import { sanitizeHtmlDocument } from "../epub/htmlSanitizer";
import { validateEpubBuffer } from "../epub/epubValidator";

interface TocNode {
  item: LyceumTocItem;
  children: TocNode[];
  level: number;
}

interface EpubResourceFile extends LyceumTextualResource {
  data: Uint8Array | Buffer;
}

const XHTML_MEDIA_TYPE = "application/xhtml+xml";

function normalizeIdentifier(value: string) {
  return value || `urn:uuid:${crypto.randomUUID?.() || Date.now().toString(36)}`;
}

function renderContainerXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml" />
  </rootfiles>
</container>`;
}

function safeManifestId(value: string, fallback: string, used: Set<string>) {
  const base = value
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/^-+|-+$/g, "")
    || fallback;
  let id = base;
  let index = 2;

  while (used.has(id)) {
    id = `${base}-${index}`;
    index += 1;
  }

  used.add(id);
  return id;
}

function chapterExportHref(pkg: LyceumPackage, chapter: LyceumTextualChapter, index: number) {
  const fallback = `text/chapter-${String(index + 1).padStart(3, "0")}.xhtml`;
  const href = textualRelativePath(chapter.href, fallback);

  if (pkg.manifest.sourceFormat !== "epub" && !href.includes("/")) {
    return `text/${href}`;
  }

  return href;
}

function ensureExportableXhtml(chapter: LyceumTextualChapter, metadata: LyceumBookMetadata) {
  const title = isPlaceholderTitle(chapter.title) ? metadata.title : chapter.title;
  return sanitizeHtmlDocument(chapter.xhtml.trim(), title).xhtml;
}

function tocItems(pkg: LyceumPackage, chapterHrefs: Map<string, string>) {
  if (pkg.textual?.toc.length) {
    return pkg.textual.toc.map((item) => {
      const [hrefWithoutFragment, fragment] = item.href.split("#");
      const exportHref = chapterHrefs.get(hrefWithoutFragment.toLowerCase()) || hrefWithoutFragment;
      return {
        ...item,
        href: fragment ? `${exportHref}#${fragment}` : exportHref,
      };
    });
  }

  return (pkg.textual?.chapters || []).map((chapter, index) => ({
    id: chapter.id,
    href: chapterExportHref(pkg, chapter, index),
    title: chapter.title,
    level: 1,
  }));
}

function buildTocTree(items: LyceumTocItem[]) {
  const root: TocNode = {
    item: { id: "root", href: "", title: "", level: 0 },
    children: [],
    level: 0,
  };
  const stack = [root];

  for (const item of items) {
    const level = Math.max(1, Math.floor(item.level || 1));
    const node: TocNode = { item: { ...item, level }, children: [], level };
    while (stack.length > 1 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }
    stack[stack.length - 1].children.push(node);
    stack.push(node);
  }

  return root.children;
}

function renderTocNodes(nodes: TocNode[], depth = 2): string {
  const indent = "  ".repeat(depth);
  return nodes
    .map((node) => {
      const children = node.children.length
        ? `\n${indent}  <ol>\n${renderTocNodes(node.children, depth + 2)}\n${indent}  </ol>\n${indent}`
        : "";
      return `${indent}<li><a href="${escapeXml(node.item.href)}">${escapeXml(node.item.title)}</a>${children}</li>`;
    })
    .join("\n");
}

function renderToc(metadata: LyceumBookMetadata, items: LyceumTocItem[]) {
  const nodes = buildTocTree(items);
  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${escapeXml(metadata.language || "pt-BR")}">
<head>
  <meta charset="utf-8" />
  <title>Sumario</title>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Sumario</h1>
    <ol>
${renderTocNodes(nodes, 3)}
    </ol>
  </nav>
</body>
</html>`;
}

function renderOpf(args: {
  metadata: LyceumBookMetadata;
  chapters: Array<{ id: string; href: string; mediaType?: string; properties?: string }>;
  resources: EpubResourceFile[];
  defaultCss: boolean;
}) {
  const opfProperties = (properties?: string) => (properties || "")
    .split(/\s+/)
    .filter((property) => property && !["extra", "linear-no", "has-fallback", "kindle-thumbnail"].includes(property))
    .join(" ");
  const modified = args.metadata.timestamp && !Number.isNaN(Date.parse(args.metadata.timestamp))
    ? new Date(args.metadata.timestamp).toISOString().replace(/\.\d{3}Z$/, "Z")
    : new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const metadataIds = new Set<string>();
  const reserveMetadataId = (candidate: string) => {
    const base = candidate.replace(/[^a-zA-Z0-9_.-]/g, "-") || "metadata";
    let id = base;
    let suffix = 2;
    while (metadataIds.has(id)) id = `${base}-${suffix++}`;
    metadataIds.add(id);
    return id;
  };
  const renderEntries = (tag: string, entries: LyceumMetadataEntry[], prefix: string) => {
    const refinements: string[] = [];
    const values = entries.map((entry, index) => {
      const id = reserveMetadataId(entry.id || `${prefix}-${index + 1}`);
      const language = entry.language ? ` xml:lang="${escapeXml(entry.language)}"` : "";
      const mergedRefinements = { ...(entry.refinements || {}) };
      if (entry.fileAs && !mergedRefinements["file-as"]) mergedRefinements["file-as"] = [entry.fileAs];
      if (entry.role && !mergedRefinements.role) mergedRefinements.role = [entry.role];
      if (entry.scheme && !mergedRefinements["identifier-type"]) mergedRefinements["identifier-type"] = [entry.scheme];
      for (const [property, propertyValues] of Object.entries(mergedRefinements)) {
        for (const value of propertyValues) refinements.push(`    <meta refines="#${escapeXml(id)}" property="${escapeXml(property)}">${escapeXml(value)}</meta>`);
      }
      return `    <dc:${tag} id="${escapeXml(id)}"${language}>${escapeXml(entry.value)}</dc:${tag}>`;
    });
    return [...values, ...refinements].join("\n");
  };
  const identifiers = args.metadata.identifiers?.length
    ? args.metadata.identifiers
    : [{ value: normalizeIdentifier(args.metadata.identifier || ""), id: "bookid" }];
  const primaryIdentifierIndex = Math.max(0, identifiers.findIndex((entry) => entry.value === args.metadata.identifier));
  const normalizedIdentifiers = identifiers.map((entry, index) => ({
    ...entry,
    id: index === primaryIdentifierIndex ? "bookid" : entry.id || `identifier-${index + 1}`,
  }));
  const titles = args.metadata.titles?.length ? args.metadata.titles : [{ value: args.metadata.title, id: "title-1" }];
  const creators = args.metadata.creators?.length
    ? args.metadata.creators
    : args.metadata.author ? [{ value: args.metadata.author, id: "creator-1", fileAs: args.metadata.authorSort }] : [];
  const contributors = args.metadata.contributors?.length
    ? args.metadata.contributors
    : args.metadata.contributor ? [{ value: args.metadata.contributor, id: "contributor-1" }] : [];
  const subjects = args.metadata.subjects?.length
    ? args.metadata.subjects
    : (Array.isArray(args.metadata.subject) ? args.metadata.subject : args.metadata.subject ? [args.metadata.subject] : []).map((value) => ({ value }));
  const dates = args.metadata.dates?.length
    ? args.metadata.dates
    : args.metadata.publishDate ? [{ value: args.metadata.publishDate }] : [];
  const customMetadata = Object.entries(args.metadata.customMetadata || {})
    .filter(([property]) => !["cover", "dcterms:modified", "modified"].includes(property.toLowerCase()))
    .flatMap(([property, values]) => values.map((value) => `    <meta property="${escapeXml(property)}">${escapeXml(value)}</meta>`))
    .join("\n");
  const manifestChapters = args.chapters
    .map((chapter) => {
      const properties = chapter.properties ? ` properties="${escapeXml(chapter.properties)}"` : "";
      return `    <item id="${escapeXml(chapter.id)}" href="${escapeXml(chapter.href)}" media-type="${escapeXml(chapter.mediaType || XHTML_MEDIA_TYPE)}"${properties} />`;
    })
    .join("\n");
  const manifestResources = args.resources
    .map((resource) => {
      const normalizedProperties = opfProperties(resource.properties);
      const properties = normalizedProperties ? ` properties="${escapeXml(normalizedProperties)}"` : "";
      const fallback = resource.fallback ? ` fallback="${escapeXml(resource.fallback)}"` : "";
      return `    <item id="${escapeXml(resource.id)}" href="${escapeXml(resource.href)}" media-type="${escapeXml(resource.mediaType)}"${properties}${fallback} />`;
    })
    .join("\n");
  const coverResource = args.resources.find((resource) => resource.properties?.split(/\s+/).includes("cover-image"));
  const coverMeta = coverResource
    ? `    <meta name="cover" content="${escapeXml(coverResource.id)}" />`
    : "";
  const defaultCss = args.defaultCss
    ? `    <item id="lyceum-css" href="styles/book.css" media-type="text/css" />`
    : "";
  const spine = [
    ...args.chapters.map((chapter) => `    <itemref idref="${escapeXml(chapter.id)}" />`),
    ...args.resources.filter((resource) => resource.linear === false).map((resource) => `    <itemref idref="${escapeXml(resource.id)}" linear="no" />`),
  ].join("\n");

  return `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
${renderEntries("identifier", normalizedIdentifiers, "identifier")}
${renderEntries("title", titles, "title")}
    <dc:language>${escapeXml(args.metadata.language || "pt-BR")}</dc:language>
${renderEntries("creator", creators, "creator")}
${renderEntries("contributor", contributors, "contributor")}
${renderEntries("subject", subjects, "subject")}
${renderEntries("date", dates, "date")}
    ${args.metadata.publisher ? `<dc:publisher>${escapeXml(args.metadata.publisher)}</dc:publisher>` : ""}
    ${args.metadata.description ? `<dc:description>${escapeXml(args.metadata.description)}</dc:description>` : ""}
    ${args.metadata.rights ? `<dc:rights>${escapeXml(args.metadata.rights)}</dc:rights>` : ""}
${customMetadata}
    <meta property="dcterms:modified">${escapeXml(modified)}</meta>
    <meta name="generator" content="Lyceum" />
${coverMeta}
  </metadata>
  <manifest>
    <item id="nav" href="toc.xhtml" media-type="application/xhtml+xml" properties="nav" />
${defaultCss}
${manifestChapters}
${manifestResources}
  </manifest>
  <spine>
${spine}
  </spine>
</package>`;
}

function resourceData(resource: LyceumTextualResource, pkg: LyceumPackage) {
  if (resource.data instanceof ArrayBuffer) return Buffer.from(resource.data);
  if (resource.data) return Buffer.from(resource.data.buffer, resource.data.byteOffset, resource.data.byteLength);
  return fs.readFileSync(textualResourcePath(pkg.rootPath, resource.href));
}

function loadResources(pkg: LyceumPackage, warnings: string[], usedIds: Set<string>) {
  const resources: EpubResourceFile[] = [];
  const sourceResources = pkg.textual?.resources || [];
  const exportedIds = new Map<string, string>();

  sourceResources.forEach((resource, index) => {
    exportedIds.set(resource.id, safeManifestId(resource.id || "", `resource-${index + 1}`, usedIds));
  });

  for (const [index, resource] of sourceResources.entries()) {
    try {
      const href = textualRelativePath(resource.href, `resources/resource-${index + 1}`);
      resources.push({
        ...resource,
        id: exportedIds.get(resource.id) || `resource-${index + 1}`,
        fallback: resource.fallback ? exportedIds.get(resource.fallback) : undefined,
        href,
        data: resourceData(resource, pkg),
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      warnings.push(`Recurso ignorado no EPUB (${resource.href}): ${detail}`);
    }
  }

  return resources;
}

async function createEpubArchive(pkg: LyceumPackage, metadataOverrides?: Partial<LyceumBookMetadata>) {
  if (!pkg.textual) {
    throw new Error("O pacote .lyceum nao possui conteudo textual exportavel para EPUB.");
  }

  const metadata = mergeDefinedBookMetadata(pkg.metadata, metadataOverrides);
  const zip = new JSZip();
  const warnings: string[] = [];
  const usedIds = new Set(["nav", "lyceum-css"]);
  const chapterHrefs = new Map<string, string>();
  const chapters = pkg.textual.chapters.map((chapter, index) => {
    const href = chapterExportHref(pkg, chapter, index);
    chapterHrefs.set(chapter.href.toLowerCase(), href);
    return {
      id: safeManifestId(chapter.id, `chapter-${index + 1}`, usedIds),
      href,
      mediaType: chapter.mediaType || XHTML_MEDIA_TYPE,
      properties: chapter.properties,
      xhtml: ensureExportableXhtml(chapter, metadata),
    };
  });
  const resources = loadResources(pkg, warnings, usedIds);
  const hasCssResource = resources.some((resource) => resource.mediaType === "text/css");
  const toc = tocItems(pkg, chapterHrefs);

  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file("META-INF/container.xml", renderContainerXml());
  zip.file("OEBPS/content.opf", renderOpf({
    metadata,
    chapters,
    resources,
    defaultCss: !hasCssResource,
  }));
  zip.file("OEBPS/toc.xhtml", renderToc(metadata, toc));

  if (!hasCssResource) {
    zip.file("OEBPS/styles/book.css", renderDefaultCss());
  }

  for (const chapter of chapters) {
    zip.file(`OEBPS/${chapter.href}`, chapter.xhtml);
  }

  for (const resource of resources) {
    zip.file(`OEBPS/${resource.href}`, resource.data);
  }

  const buffer = await zip.generateAsync({
    type: "arraybuffer",
    mimeType: "application/epub+zip",
    compression: "DEFLATE",
  });

  const validation = await validateEpubBuffer(buffer);
  if (!validation.valid) {
    throw new Error(`EPUB gerado e invalido:\n${validation.errors.join("\n")}`);
  }
  warnings.push(...validation.warnings);

  return {
    buffer,
    warnings,
    stats: {
      chapterCount: chapters.length,
      resourceCount: resources.length,
      imageCount: resources.filter((resource) => resource.mediaType.startsWith("image/")).length,
      stylesheetCount: resources.filter((resource) => resource.mediaType === "text/css").length + (hasCssResource ? 0 : 1),
      tocItemCount: toc.length,
      validatedXhtmlCount: validation.stats.xhtmlCount,
      brokenReferenceCount: 0,
      fidelityMode: "reflowable-semantic",
    },
  };
}

export async function buildEpubFromLyceumPackage(
  pkg: LyceumPackage,
  metadata?: Partial<LyceumBookMetadata>,
) {
  return (await createEpubArchive(pkg, metadata)).buffer;
}

export class EpubExporter implements LyceumExporter {
  outputFormat = "epub" as const;

  canExport(pkg: ExportInput["package"]) {
    return pkg.textual
      ? { supported: true }
      : { supported: false, reason: "O pacote .lyceum nao possui conteudo textual." };
  }

  async export(input: ExportInput): Promise<ExportResult> {
    if (!input.package.textual) {
      throw new Error("O pacote .lyceum nao possui conteudo textual exportavel para EPUB.");
    }

    await fs.promises.mkdir(path.dirname(input.outputPath), { recursive: true });
    const epub = await createEpubArchive(input.package, input.metadata);

    await fs.promises.writeFile(input.outputPath, Buffer.from(epub.buffer));

    return {
      outputPath: input.outputPath,
      outputFormat: "epub",
      report: {
        outputFormat: "epub",
        warnings: epub.warnings,
        stats: epub.stats,
      },
    };
  }
}
