import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { renderDefaultCss } from "../../pdf-to-epub/html";
import { mergeDefinedBookMetadata } from "../schema/manifest";
import type {
  ExportInput,
  ExportResult,
  LyceumBookMetadata,
  LyceumPackage,
  LyceumExporter,
  LyceumTextualChapter,
  LyceumTextualResource,
  LyceumTocItem,
} from "../schema/types";
import { escapeXml, isPlaceholderTitle, normalizeHtmlEntitiesForXhtml } from "../textual";
import { textualRelativePath, textualResourcePath } from "../package/paths";

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
  let xhtml = normalizeHtmlEntitiesForXhtml(chapter.xhtml.trim());

  if (!/<html\b/i.test(xhtml)) {
    xhtml = `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" lang="${escapeXml(metadata.language || "pt-BR")}">
<head>
  <meta charset="utf-8" />
  <title>${escapeXml(title)}</title>
</head>
<body>
${xhtml}
</body>
</html>`;
  } else if (!/<html\b[^>]*\bxmlns\s*=/i.test(xhtml)) {
    xhtml = xhtml.replace(/<html\b/i, `<html xmlns="http://www.w3.org/1999/xhtml"`);
  }

  if (!/<title\b[^>]*>[\s\S]*?<\/title>/i.test(xhtml)) {
    xhtml = xhtml.replace(/<head\b[^>]*>/i, (match) => `${match}\n<title>${escapeXml(title)}</title>`);
  }

  return xhtml;
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
  const modified = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const manifestChapters = args.chapters
    .map((chapter) => {
      const properties = chapter.properties ? ` properties="${escapeXml(chapter.properties)}"` : "";
      return `    <item id="${escapeXml(chapter.id)}" href="${escapeXml(chapter.href)}" media-type="${escapeXml(chapter.mediaType || XHTML_MEDIA_TYPE)}"${properties} />`;
    })
    .join("\n");
  const manifestResources = args.resources
    .map((resource) => {
      const properties = resource.properties ? ` properties="${escapeXml(resource.properties)}"` : "";
      return `    <item id="${escapeXml(resource.id)}" href="${escapeXml(resource.href)}" media-type="${escapeXml(resource.mediaType)}"${properties} />`;
    })
    .join("\n");
  const coverResource = args.resources.find((resource) => resource.properties?.split(/\s+/).includes("cover-image"));
  const coverMeta = coverResource
    ? `    <meta name="cover" content="${escapeXml(coverResource.id)}" />`
    : "";
  const defaultCss = args.defaultCss
    ? `    <item id="lyceum-css" href="styles/book.css" media-type="text/css" />`
    : "";
  const spine = args.chapters.map((chapter) => `    <itemref idref="${escapeXml(chapter.id)}" />`).join("\n");

  return `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${escapeXml(normalizeIdentifier(args.metadata.identifier || ""))}</dc:identifier>
    <dc:title>${escapeXml(args.metadata.title)}</dc:title>
    <dc:language>${escapeXml(args.metadata.language || "pt-BR")}</dc:language>
    ${args.metadata.author ? `<dc:creator>${escapeXml(args.metadata.author)}</dc:creator>` : ""}
    ${args.metadata.publisher ? `<dc:publisher>${escapeXml(args.metadata.publisher)}</dc:publisher>` : ""}
    ${args.metadata.description ? `<dc:description>${escapeXml(args.metadata.description)}</dc:description>` : ""}
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
  if (resource.data instanceof ArrayBuffer) return new Uint8Array(resource.data);
  if (resource.data) return resource.data;
  return fs.readFileSync(textualResourcePath(pkg.rootPath, resource.href));
}

function loadResources(pkg: LyceumPackage, warnings: string[], usedIds: Set<string>) {
  const resources: EpubResourceFile[] = [];

  for (const [index, resource] of (pkg.textual?.resources || []).entries()) {
    try {
      const href = textualRelativePath(resource.href, `resources/resource-${index + 1}`);
      resources.push({
        ...resource,
        id: safeManifestId(resource.id || "", `resource-${index + 1}`, usedIds),
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

  return {
    buffer,
    warnings,
    stats: {
      chapterCount: chapters.length,
      resourceCount: resources.length,
      imageCount: resources.filter((resource) => resource.mediaType.startsWith("image/")).length,
      stylesheetCount: resources.filter((resource) => resource.mediaType === "text/css").length + (hasCssResource ? 0 : 1),
      tocItemCount: toc.length,
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
