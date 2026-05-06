import JSZip from "jszip";
import { escapeXml } from "./text";
import type { EpubAsset, EpubMetadata, Section } from "./types";

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

function renderToc(chapters: EpubChapterFile[]) {
  const items = chapters
    .map((chapter) => `    <li><a href="${escapeXml(chapter.href)}">${escapeXml(chapter.title)}</a></li>`)
    .join("\n");

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
    <ol>
${items}
    </ol>
  </nav>
</body>
</html>`;
}

function renderOpf(metadata: EpubMetadata, chapters: EpubChapterFile[], assets: EpubAsset[] = []) {
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
      return `    <item id="${id}" href="${escapeXml(asset.href)}" media-type="${escapeXml(asset.mediaType)}" />`;
    })
    .join("\n");

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
    <meta name="generator" content="Lyceum PDF to EPUB" />
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
}) {
  const zip = new JSZip();

  zip.file("mimetype", "application/epub+zip", {
    compression: "STORE",
  });
  zip.file("META-INF/container.xml", renderContainerXml());
  zip.file("OEBPS/content.opf", renderOpf(args.metadata, args.chapters, args.assets));
  zip.file("OEBPS/toc.xhtml", renderToc(args.chapters));
  zip.file("OEBPS/styles/book.css", args.css);

  for (const chapter of args.chapters) {
    zip.file(`OEBPS/${chapter.href}`, chapter.xhtml);
  }

  for (const asset of args.assets || []) {
    zip.file(`OEBPS/${asset.href}`, asset.data);
  }

  return zip.generateAsync({
    type: "arraybuffer",
    mimeType: "application/epub+zip",
    compression: "DEFLATE",
  });
}
