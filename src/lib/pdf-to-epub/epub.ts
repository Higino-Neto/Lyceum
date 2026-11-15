import JSZip from "jszip";
import { escapeXml } from "./text";
import type { EpubAsset, EpubMetadata, Section } from "./types";
import { validateEpubBuffer } from "../lyceum/epub/epubValidator";

export interface EpubChapterFile {
  id: string;
  href: string;
  title: string;
  xhtml: string;
}

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

export interface EpubPageListEntry {
  label: string;
  /** Path relative to the nav document, with fragment. */
  href: string;
}

function renderPageListNav(pageList: EpubPageListEntry[]) {
  if (pageList.length === 0) return "";
  const items = pageList
    .map((page) => `      <li><a href="${escapeXml(page.href)}">${escapeXml(page.label)}</a></li>`)
    .join("\n");
  return `
  <nav epub:type="page-list" id="page-list" hidden="hidden">
    <h2>Paginas</h2>
    <ol>
${items}
    </ol>
  </nav>`;
}

export interface EpubTocEntry {
  href: string;
  title: string;
  /** 1 = top level. */
  level: number;
}

/** Nested <ol> for a flat list of entries with levels. */
function renderTocItems(entries: EpubTocEntry[]): string {
  let html = "";
  let depth = 0;
  for (const entry of entries) {
    const level = Math.max(1, Math.min(entry.level, depth + 1));
    if (level > depth) {
      html += "<ol>".repeat(level - depth);
    } else {
      html += "</li>";
      html += "</ol></li>".repeat(depth - level);
    }
    depth = level;
    html += `<li><a href="${escapeXml(entry.href)}">${escapeXml(entry.title)}</a>`;
  }
  if (depth > 0) html += "</li>" + "</ol></li>".repeat(depth - 1) + "</ol>";
  return html;
}

function renderToc(chapters: EpubChapterFile[], pageList: EpubPageListEntry[] = [], toc?: EpubTocEntry[]) {
  const entries = toc?.length ? toc : chapters.map((chapter) => ({ href: chapter.href, title: chapter.title, level: 1 }));
  const items = renderTocItems(entries);

  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <meta charset="utf-8" />
  <title>Sumario</title>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Sumario</h1>
    ${items}
  </nav>${renderPageListNav(pageList)}
</body>
</html>`;
}

function renderOpf(metadata: EpubMetadata, chapters: EpubChapterFile[], assets: EpubAsset[] = [], layout: "reflowable" | "pre-paginated" = "reflowable") {
  const modified = metadata.modified || new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const manifestChapters = chapters
    .map(
      (chapter) =>
        `    <item id="${chapter.id}" href="${escapeXml(chapter.href)}" media-type="application/xhtml+xml" />`,
    )
    .join("\n");
  const spine = chapters.map((chapter) => `    <itemref idref="${chapter.id}" />`).join("\n");
  const manifestAssets = assets
    .map((asset, index) => {
      const id = `asset-${index + 1}`;
      const properties = asset.properties ? ` properties="${escapeXml(asset.properties)}"` : "";
      return `    <item id="${id}" href="${escapeXml(asset.href)}" media-type="${escapeXml(asset.mediaType)}"${properties} />`;
    })
    .join("\n");
  const coverIndex = assets.findIndex((asset) => asset.properties?.split(/\s+/).includes("cover-image"));
  const coverMeta = coverIndex >= 0 ? `<meta name="cover" content="asset-${coverIndex + 1}" />` : "";

  return `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${escapeXml(normalizeIdentifier(metadata.identifier))}</dc:identifier>
    <dc:title>${escapeXml(metadata.title)}</dc:title>
    <dc:language>${escapeXml(metadata.language)}</dc:language>
    ${metadata.author ? `<dc:creator>${escapeXml(metadata.author)}</dc:creator>` : ""}
    ${metadata.publisher ? `<dc:publisher>${escapeXml(metadata.publisher)}</dc:publisher>` : ""}
    ${metadata.description ? `<dc:description>${escapeXml(metadata.description)}</dc:description>` : ""}
    <meta property="dcterms:modified">${escapeXml(modified)}</meta>
    <meta property="rendition:layout">${layout}</meta>
    ${layout === "pre-paginated" ? '<meta property="rendition:spread">none</meta>' : ""}
    <meta name="generator" content="Lyceum PDF to EPUB" />
    ${coverMeta}
  </metadata>
  <manifest>
    <item id="nav" href="toc.xhtml" media-type="application/xhtml+xml" properties="nav" />
    <item id="css" href="styles/book.css" media-type="text/css" />
${manifestChapters}
${manifestAssets}
  </manifest>
  <spine>
${spine}
  </spine>
</package>`;
}

export function buildChapterFiles(sections: Section[], render: (section: Section, index: number) => string) {
  return sections.map<EpubChapterFile>((section, index) => ({
    id: `chapter-${String(index + 1).padStart(3, "0")}`,
    href: `text/chapter-${String(index + 1).padStart(3, "0")}.xhtml`,
    title: section.title || `Capitulo ${index + 1}`,
    xhtml: render(section, index),
  }));
}

export async function packageEpub(args: {
  metadata: EpubMetadata;
  chapters: EpubChapterFile[];
  css: string;
  assets?: EpubAsset[];
  layout?: "reflowable" | "pre-paginated";
  pageList?: EpubPageListEntry[];
  toc?: EpubTocEntry[];
}) {
  const zip = new JSZip();

  zip.file("mimetype", "application/epub+zip", {
    compression: "STORE",
  });
  zip.file("META-INF/container.xml", renderContainerXml());
  zip.file("OEBPS/content.opf", renderOpf(args.metadata, args.chapters, args.assets, args.layout));
  zip.file("OEBPS/toc.xhtml", renderToc(args.chapters, args.pageList, args.toc));
  zip.file("OEBPS/styles/book.css", args.css);

  for (const chapter of args.chapters) {
    zip.file(`OEBPS/${chapter.href}`, chapter.xhtml);
  }

  for (const asset of args.assets || []) {
    zip.file(`OEBPS/${asset.href}`, asset.data);
  }

  const buffer = await zip.generateAsync({
    type: "arraybuffer",
    mimeType: "application/epub+zip",
    compression: "DEFLATE",
  });
  const validation = await validateEpubBuffer(buffer);
  if (!validation.valid) throw new Error(`EPUB gerado e invalido:\n${validation.errors.join("\n")}`);
  return buffer;
}
