/**
 * Pure (I/O free) readers and writers for the metadata blocks that live
 * inside book files: the EPUB OPF package document, the PDF XMP packet and
 * the CBZ ComicInfo.xml. Kept separate from the file plumbing so every
 * transformation can be unit tested on plain strings.
 */

export interface BookFileMetadataFields {
  title?: string;
  author?: string;
  description?: string;
  isbn?: string;
  publisher?: string;
  publishDate?: string;
  language?: string;
  identifier?: string;
  asin?: string;
  subject?: string;
  series?: string;
  seriesIndex?: string;
  authorSort?: string;
  titleSort?: string;
}

export function clean(value: string | null | undefined): string | undefined {
  const trimmed = value?.replace(/\s+/g, " ").trim();
  return trimmed || undefined;
}

export function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
      if (entity[0] === "#") {
        const code = entity[1].toLowerCase() === "x"
          ? Number.parseInt(entity.slice(2), 16)
          : Number.parseInt(entity.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }
      return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
    });
}

function stripTags(value: string) {
  return value.replace(/<[^>]+>/g, " ");
}

function textOf(inner: string) {
  // Descriptions are often escaped HTML (`&lt;p&gt;`): decode, drop tags, decode again.
  return clean(decodeXml(stripTags(decodeXml(stripTags(inner)))));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function readAttr(source: string, attr: string) {
  const match = source.match(new RegExp(`(?:^|\\s)${escapeRegExp(attr)}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, "i"));
  return match ? decodeXml(match[2]) : undefined;
}

export function normalizeIsbn(value: string | undefined) {
  if (!value) return undefined;
  const compact = value.replace(/^urn:isbn:/i, "").replace(/^isbn[:\s]*/i, "").replace(/[\s-]/g, "");
  return /^(?:\d{9}[\dX]|\d{13})$/i.test(compact) ? compact.toUpperCase() : undefined;
}

// ---------------------------------------------------------------------------
// EPUB / OPF
// ---------------------------------------------------------------------------

interface XmlElement {
  full: string;
  attrs: string;
  inner: string;
  index: number;
}

function findElements(xml: string, qualifiedName: string): XmlElement[] {
  const name = escapeRegExp(qualifiedName);
  const pattern = new RegExp(`<${name}(\\s[^>]*?)?(?:\\/>|>([\\s\\S]*?)<\\/${name}\\s*>)`, "gi");
  return Array.from(xml.matchAll(pattern)).map((match) => ({
    full: match[0],
    attrs: match[1] || "",
    inner: match[2] || "",
    index: match.index ?? 0,
  }));
}

function findMetas(xml: string) {
  return findElements(xml, "meta");
}

function metadataBlock(opf: string) {
  const match = opf.match(/<(?:opf:)?metadata\b[^>]*>[\s\S]*?<\/(?:opf:)?metadata\s*>/i);
  return match?.[0] ?? "";
}

function epubVersion(opf: string) {
  const pkg = opf.match(/<(?:opf:)?package\b([^>]*)>/i)?.[1] || "";
  return Number.parseFloat(readAttr(pkg, "version") || "2") || 2;
}

function uniqueIdentifierId(opf: string) {
  const pkg = opf.match(/<(?:opf:)?package\b([^>]*)>/i)?.[1] || "";
  return readAttr(pkg, "unique-identifier");
}

function identifierScheme(element: XmlElement) {
  return (readAttr(element.attrs, "opf:scheme") || readAttr(element.attrs, "scheme") || "").toLowerCase();
}

function isIsbnIdentifier(element: XmlElement) {
  const value = decodeXml(element.inner).trim();
  return identifierScheme(element) === "isbn" || /^urn:isbn:/i.test(value);
}

function isAsinIdentifier(element: XmlElement) {
  const value = decodeXml(element.inner).trim();
  const scheme = identifierScheme(element);
  return scheme === "amazon" || scheme === "asin" || scheme === "mobi-asin" || /^(?:urn:)?(?:amazon|asin):/i.test(value);
}

export function readOpfMetadata(opf: string): BookFileMetadataFields {
  const block = metadataBlock(opf) || opf;
  const metas = findMetas(block);
  const metaName = (name: string) => clean(readAttr(metas.find((meta) => readAttr(meta.attrs, "name") === name)?.attrs || "", "content"));
  const metaProperty = (property: string, refines?: string) => {
    const found = metas.find((meta) =>
      readAttr(meta.attrs, "property") === property &&
      (refines === undefined ? !readAttr(meta.attrs, "refines") : readAttr(meta.attrs, "refines") === refines));
    return found ? textOf(found.inner) : undefined;
  };

  const creators = findElements(block, "dc:creator");
  const authors = creators
    .filter((creator) => {
      const role = readAttr(creator.attrs, "opf:role") || readAttr(creator.attrs, "role");
      return !role || role === "aut";
    })
    .map((creator) => textOf(creator.inner))
    .filter((value): value is string => Boolean(value));

  const identifiers = findElements(block, "dc:identifier");
  const uniqueId = uniqueIdentifierId(opf);
  const unique = identifiers.find((element) => uniqueId && readAttr(element.attrs, "id") === uniqueId);
  const isbnElement = identifiers.find(isIsbnIdentifier);
  const asinElement = identifiers.find(isAsinIdentifier);
  const isbn = isbnElement
    ? normalizeIsbn(textOf(isbnElement.inner)) || textOf(isbnElement.inner)?.replace(/^urn:isbn:/i, "")
    : identifiers.map((element) => normalizeIsbn(textOf(element.inner))).find(Boolean);
  const asin = asinElement
    ? textOf(asinElement.inner)?.replace(/^(?:urn:)?(?:amazon|asin):/i, "")
    : metaName("amazon:asin") || metaName("ASIN");

  const firstAuthorId = creators[0] ? readAttr(creators[0].attrs, "id") : undefined;
  const collection = metas.find((meta) => readAttr(meta.attrs, "property") === "belongs-to-collection");
  const collectionId = collection ? readAttr(collection.attrs, "id") : undefined;
  const subjects = findElements(block, "dc:subject").map((element) => textOf(element.inner)).filter(Boolean);
  const title = findElements(block, "dc:title")[0];

  return {
    title: title ? textOf(title.inner) : undefined,
    author: authors.length ? authors.join(" & ") : undefined,
    description: textOf(findElements(block, "dc:description")[0]?.inner || ""),
    publisher: textOf(findElements(block, "dc:publisher")[0]?.inner || ""),
    publishDate: textOf(findElements(block, "dc:date")[0]?.inner || ""),
    language: textOf(findElements(block, "dc:language")[0]?.inner || ""),
    subject: subjects.length ? subjects.join(", ") : undefined,
    identifier: unique ? textOf(unique.inner) : undefined,
    isbn,
    asin,
    series: metaName("calibre:series") || (collection ? textOf(collection.inner) : undefined),
    seriesIndex: metaName("calibre:series_index") || (collectionId ? metaProperty("group-position", `#${collectionId}`) : undefined),
    authorSort: metaName("calibre:author_sort")
      || (creators[0] ? clean(readAttr(creators[0].attrs, "opf:file-as")) : undefined)
      || (firstAuthorId ? metaProperty("file-as", `#${firstAuthorId}`) : undefined),
    titleSort: metaName("calibre:title_sort"),
  };
}

function replaceInBlock(opf: string, transform: (block: string) => string) {
  const block = metadataBlock(opf);
  if (!block) return opf;
  return opf.replace(block, () => transform(block));
}

function insertIntoMetadata(block: string, node: string) {
  return block.replace(/(\s*)<\/((?:opf:)?metadata)\s*>$/i, (_match, ws: string, tag: string) => `\n    ${node}${ws || "\n  "}</${tag}>`);
}

function removeElement(block: string, element: XmlElement) {
  return block.replace(new RegExp(`[ \\t]*${escapeRegExp(element.full)}[ \\t]*\\r?\\n?`), "");
}

function setElementText(block: string, element: XmlElement, value: string) {
  const name = element.full.match(/^<([^\s>/]+)/)?.[1] || "dc:unknown";
  return block.replace(element.full, () => `<${name}${element.attrs}>${escapeXml(value)}</${name}>`);
}

/** Updates (or creates) the first element; an empty value removes it unless `keep` is set. */
function upsertDc(block: string, tag: string, value: string | undefined, keep = false) {
  const existing = findElements(block, `dc:${tag}`)[0];
  if (!value) return existing && !keep ? removeElement(block, existing) : block;
  if (existing) return setElementText(block, existing, value);
  return insertIntoMetadata(block, `<dc:${tag}>${escapeXml(value)}</dc:${tag}>`);
}

function upsertSubjects(block: string, value: string | undefined) {
  let next = block;
  for (const subject of findElements(next, "dc:subject")) next = removeElement(next, subject);
  const subjects = (value || "").split(/[,;]/).map((item) => clean(item)).filter((item): item is string => Boolean(item));
  for (const subject of subjects) next = insertIntoMetadata(next, `<dc:subject>${escapeXml(subject)}</dc:subject>`);
  return next;
}

function upsertMetaName(block: string, name: string, value: string | undefined) {
  const existing = findMetas(block).find((meta) => readAttr(meta.attrs, "name") === name);
  if (!value) return existing ? removeElement(block, existing) : block;
  const node = `<meta name="${escapeXml(name)}" content="${escapeXml(value)}"/>`;
  if (existing) return block.replace(existing.full, () => node);
  return insertIntoMetadata(block, node);
}

function removeMetaProperty(block: string, predicate: (meta: XmlElement) => boolean) {
  let next = block;
  for (const meta of findMetas(next).filter(predicate)) next = removeElement(next, meta);
  return next;
}

function upsertTaggedIdentifier(
  block: string,
  id: string,
  matcher: (element: XmlElement) => boolean,
  value: string | undefined,
  uniqueId: string | undefined,
) {
  const candidates = findElements(block, "dc:identifier")
    .filter((element) => readAttr(element.attrs, "id") !== uniqueId && (readAttr(element.attrs, "id") === id || matcher(element)));
  let next = block;
  for (const candidate of candidates.slice(value ? 1 : 0)) next = removeElement(next, candidate);
  if (!value) return next;
  if (candidates[0]) return setElementText(next, candidates[0], value);
  return insertIntoMetadata(next, `<dc:identifier id="${id}">${escapeXml(value)}</dc:identifier>`);
}

function isAuthorCreator(element: XmlElement, block: string) {
  const role = readAttr(element.attrs, "opf:role") || readAttr(element.attrs, "role");
  if (role) return role === "aut";
  const id = readAttr(element.attrs, "id");
  const refinedRole = id
    ? findMetas(block).find((meta) => readAttr(meta.attrs, "refines") === `#${id}` && readAttr(meta.attrs, "property") === "role")
    : undefined;
  return !refinedRole || textOf(refinedRole.inner) === "aut";
}

/** Maps authors onto the existing author creators, keeping their ids so EPUB 3 refinements stay valid. */
function upsertCreators(block: string, value: string | undefined) {
  const authors = splitAuthors(value);
  if (authors.length === 0) return block;
  const existing = findElements(block, "dc:creator").filter((element) => isAuthorCreator(element, block));
  let next = block;
  existing.forEach((element, index) => {
    if (index < authors.length) {
      next = setElementText(next, element, authors[index]);
      return;
    }
    next = removeElement(next, element);
    const id = readAttr(element.attrs, "id");
    if (id) next = removeMetaProperty(next, (meta) => readAttr(meta.attrs, "refines") === `#${id}`);
  });
  for (const author of authors.slice(existing.length)) {
    next = insertIntoMetadata(next, `<dc:creator>${escapeXml(author)}</dc:creator>`);
  }
  return next;
}

function upsertSeries(block: string, version: number, series: string | undefined, index: string | undefined) {
  let next = upsertMetaName(block, "calibre:series", series);
  next = upsertMetaName(next, "calibre:series_index", series ? index : undefined);
  if (version < 3) return next;

  const collections = findMetas(next).filter((meta) => readAttr(meta.attrs, "property") === "belongs-to-collection");
  const refinedIds = new Set(collections.map((meta) => readAttr(meta.attrs, "id")).filter(Boolean).map((id) => `#${id}`));
  next = removeMetaProperty(next, (meta) => {
    const refines = readAttr(meta.attrs, "refines");
    return readAttr(meta.attrs, "property") === "belongs-to-collection" || Boolean(refines && refinedIds.has(refines));
  });
  if (!series) return next;
  next = insertIntoMetadata(next, `<meta property="belongs-to-collection" id="lyceum-series">${escapeXml(series)}</meta>`);
  next = insertIntoMetadata(next, `<meta refines="#lyceum-series" property="collection-type">series</meta>`);
  if (index) next = insertIntoMetadata(next, `<meta refines="#lyceum-series" property="group-position">${escapeXml(index)}</meta>`);
  return next;
}

function touchModified(block: string, version: number, now: Date) {
  if (version < 3) return block;
  const stamp = now.toISOString().replace(/\.\d{3}Z$/, "Z");
  const existing = findMetas(block).find((meta) => readAttr(meta.attrs, "property") === "dcterms:modified");
  const node = `<meta property="dcterms:modified">${stamp}</meta>`;
  if (existing) return block.replace(existing.full, () => node);
  return insertIntoMetadata(block, node);
}

function ensureDcNamespace(opf: string) {
  if (/xmlns:dc\s*=/.test(opf)) return opf;
  return opf.replace(/<((?:opf:)?metadata)\b/i, `<$1 xmlns:dc="http://purl.org/dc/elements/1.1/"`);
}

export function writeOpfMetadata(opf: string, metadata: BookFileMetadataFields, now = new Date()): string {
  const version = epubVersion(opf);
  const uniqueId = uniqueIdentifierId(opf);
  const isbn = normalizeIsbn(metadata.isbn) || clean(metadata.isbn);
  const asin = clean(metadata.asin);

  const updated = replaceInBlock(ensureDcNamespace(opf), (original) => {
    let block = original;
    // Title, language and the package identifier are required by the spec:
    // they are only ever updated, never removed.
    block = upsertDc(block, "title", clean(metadata.title), true);
    block = upsertDc(block, "language", clean(metadata.language), true);
    block = upsertCreators(block, metadata.author);
    block = upsertDc(block, "description", clean(metadata.description));
    block = upsertDc(block, "publisher", clean(metadata.publisher));
    block = upsertDc(block, "date", clean(metadata.publishDate));
    block = upsertSubjects(block, metadata.subject);

    const identifier = clean(metadata.identifier);
    const unique = findElements(block, "dc:identifier").find((element) => uniqueId && readAttr(element.attrs, "id") === uniqueId);
    if (identifier && unique) block = setElementText(block, unique, identifier);

    const uniqueValue = unique ? textOf(unique.inner) : undefined;
    const isbnValue = isbn && normalizeIsbn(uniqueValue) !== normalizeIsbn(isbn) ? `urn:isbn:${isbn}` : undefined;
    block = upsertTaggedIdentifier(block, "lyceum-isbn", isIsbnIdentifier, isbnValue, uniqueId);
    block = upsertTaggedIdentifier(block, "lyceum-asin", isAsinIdentifier, asin ? `amazon:${asin}` : undefined, uniqueId);
    block = upsertMetaName(block, "amazon:asin", undefined);

    block = upsertSeries(block, version, clean(metadata.series), clean(metadata.seriesIndex));
    block = upsertMetaName(block, "calibre:author_sort", clean(metadata.authorSort));
    block = upsertMetaName(block, "calibre:title_sort", clean(metadata.titleSort));
    return touchModified(block, version, now);
  });
  return updated;
}

// ---------------------------------------------------------------------------
// PDF / XMP
// ---------------------------------------------------------------------------

export interface PdfXmpInput extends BookFileMetadataFields {
  producer?: string;
  creatorTool?: string;
  /** PDF/A identification carried over from the previous packet, if any. */
  pdfaPart?: string;
  pdfaConformance?: string;
}

function xmpAlt(tag: string, value: string | undefined) {
  return value ? `<${tag}><rdf:Alt><rdf:li xml:lang="x-default">${escapeXml(value)}</rdf:li></rdf:Alt></${tag}>` : "";
}

function xmpList(tag: string, kind: "Seq" | "Bag", values: string[]) {
  return values.length
    ? `<${tag}><rdf:${kind}>${values.map((value) => `<rdf:li>${escapeXml(value)}</rdf:li>`).join("")}</rdf:${kind}></${tag}>`
    : "";
}

function xmpSimple(tag: string, value: string | undefined) {
  return value ? `<${tag}>${escapeXml(value)}</${tag}>` : "";
}

export function splitAuthors(value: string | undefined) {
  return (value || "").split(/\s*(?:&|;)\s*/).map((item) => clean(item)).filter((item): item is string => Boolean(item));
}

export function splitSubjects(value: string | undefined) {
  return (value || "").split(/[,;]/).map((item) => clean(item)).filter((item): item is string => Boolean(item));
}

export function buildXmpPacket(input: PdfXmpInput, now = new Date()): string {
  const stamp = now.toISOString();
  const isbn = normalizeIsbn(input.isbn) || clean(input.isbn);
  const subjects = splitSubjects(input.subject);
  const series = clean(input.series);
  const body = [
    xmpAlt("dc:title", clean(input.title)),
    xmpList("dc:creator", "Seq", splitAuthors(input.author)),
    xmpAlt("dc:description", clean(input.description)),
    xmpList("dc:publisher", "Bag", clean(input.publisher) ? [clean(input.publisher)!] : []),
    xmpList("dc:date", "Seq", clean(input.publishDate) ? [clean(input.publishDate)!] : []),
    xmpList("dc:language", "Bag", clean(input.language) ? [clean(input.language)!] : []),
    xmpList("dc:subject", "Bag", subjects),
    xmpSimple("dc:identifier", clean(input.identifier) || (isbn ? `urn:isbn:${isbn}` : undefined)),
    xmpSimple("prism:isbn", isbn),
    xmpSimple("pdf:Keywords", subjects.length ? subjects.join(", ") : undefined),
    xmpSimple("pdf:Producer", clean(input.producer)),
    xmpSimple("xmp:CreatorTool", clean(input.creatorTool)),
    xmpSimple("xmp:ModifyDate", stamp),
    xmpSimple("xmp:MetadataDate", stamp),
    xmpSimple("pdfaid:part", clean(input.pdfaPart)),
    xmpSimple("pdfaid:conformance", clean(input.pdfaConformance)),
    series
      ? `<calibre:series rdf:parseType="Resource"><rdf:value>${escapeXml(series)}</rdf:value>${
          clean(input.seriesIndex) ? `<calibreSI:series_index>${escapeXml(clean(input.seriesIndex)!)}</calibreSI:series_index>` : ""
        }</calibre:series>`
      : "",
    xmpSimple("calibre:author_sort", clean(input.authorSort)),
    xmpSimple("calibre:title_sort", clean(input.titleSort)),
    xmpSimple("lyceum:asin", clean(input.asin)),
  ].filter(Boolean).join("\n      ");

  return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:dc="http://purl.org/dc/elements/1.1/"
      xmlns:xmp="http://ns.adobe.com/xap/1.0/"
      xmlns:pdf="http://ns.adobe.com/pdf/1.3/"
      xmlns:prism="http://prismstandard.org/namespaces/basic/2.0/"
      xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"
      xmlns:calibre="http://calibre-ebook.com/xmp-namespace"
      xmlns:calibreSI="http://calibre-ebook.com/xmp-namespace-series-index"
      xmlns:lyceum="https://lyceum.app/ns/xmp/1.0/">
      ${body}
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

function xmpValues(xmp: string, tag: string) {
  const element = findElements(xmp, tag)[0];
  if (!element) {
    // Simple properties may also be serialized as attributes on rdf:Description.
    const attr = xmp.match(new RegExp(`\\s${escapeRegExp(tag)}\\s*=\\s*(["'])([\\s\\S]*?)\\1`));
    return attr ? [decodeXml(attr[2])] : [];
  }
  const items = findElements(element.inner, "rdf:li").map((item) => textOf(item.inner)).filter((item): item is string => Boolean(item));
  if (items.length) return items;
  const valueNode = findElements(element.inner, "rdf:value")[0];
  const value = textOf(valueNode ? valueNode.inner : element.inner);
  return value ? [value] : [];
}

export function readXmpMetadata(xmp: string): BookFileMetadataFields & { pdfaPart?: string; pdfaConformance?: string } {
  const first = (tag: string) => xmpValues(xmp, tag)[0];
  const identifier = first("dc:identifier");
  const isbn = first("prism:isbn") || first("xmp:Identifier");
  const seriesElement = findElements(xmp, "calibre:series")[0];
  const seriesIndexElement = seriesElement ? findElements(seriesElement.inner, "calibreSI:series_index")[0] : undefined;
  const subjects = xmpValues(xmp, "dc:subject");
  const authors = xmpValues(xmp, "dc:creator");
  return {
    title: first("dc:title"),
    author: authors.length ? authors.join(" & ") : undefined,
    description: first("dc:description"),
    publisher: first("dc:publisher"),
    publishDate: first("dc:date"),
    language: first("dc:language"),
    subject: subjects.length ? subjects.join(", ") : undefined,
    identifier: identifier && !/^urn:isbn:/i.test(identifier) ? identifier : undefined,
    isbn: normalizeIsbn(isbn) || normalizeIsbn(identifier) || clean(isbn),
    series: seriesElement ? xmpValues(xmp, "calibre:series")[0] : undefined,
    seriesIndex: seriesIndexElement ? textOf(seriesIndexElement.inner) : undefined,
    authorSort: first("calibre:author_sort"),
    titleSort: first("calibre:title_sort"),
    asin: first("lyceum:asin"),
    pdfaPart: first("pdfaid:part"),
    pdfaConformance: first("pdfaid:conformance"),
  };
}

const JUNK_PDF_TITLE = /^(?:untitled|sem t[ií]tulo|unknown|title|document\d*|microsoft (?:word|powerpoint)\b.*|.*\.(?:docx?|odt|rtf|pdf|indd|tex|dvi|pptx?|xlsx?|qxd))$/i;
const JUNK_PDF_AUTHOR = /^(?:user|admin(?:istrator)?|owner|unknown|author|autor|usu[aá]rio)$/i;

/** PDF Info dictionaries are frequently filled by authoring tools with placeholders. */
export function sanitizePdfFields(fields: BookFileMetadataFields): BookFileMetadataFields {
  const title = clean(fields.title);
  const author = clean(fields.author);
  return {
    ...fields,
    title: title && title.length > 1 && !JUNK_PDF_TITLE.test(title) ? title : undefined,
    author: author && !JUNK_PDF_AUTHOR.test(author) ? author : undefined,
  };
}

// ---------------------------------------------------------------------------
// CBZ / ComicInfo.xml
// ---------------------------------------------------------------------------

function parseDateParts(value: string | undefined) {
  const match = clean(value)?.match(/^(\d{4})(?:-(\d{1,2})(?:-(\d{1,2}))?)?/);
  if (!match) return {};
  return {
    year: match[1],
    month: match[2] ? String(Number(match[2])) : undefined,
    day: match[3] ? String(Number(match[3])) : undefined,
  };
}

const COMIC_INFO_FIELDS = ["Title", "Series", "Number", "Summary", "Year", "Month", "Day", "Writer", "Publisher", "Genre", "LanguageISO", "GTIN"] as const;
type ComicInfoField = typeof COMIC_INFO_FIELDS[number];

export function writeComicInfo(existing: string | undefined, metadata: BookFileMetadataFields): string {
  const date = parseDateParts(metadata.publishDate);
  const values: Record<ComicInfoField, string | undefined> = {
    Title: clean(metadata.title),
    Series: clean(metadata.series),
    Number: clean(metadata.seriesIndex),
    Summary: clean(metadata.description),
    Year: date.year,
    Month: date.month,
    Day: date.day,
    Writer: splitAuthors(metadata.author).join(", ") || undefined,
    Publisher: clean(metadata.publisher),
    Genre: splitSubjects(metadata.subject).join(", ") || undefined,
    LanguageISO: clean(metadata.language),
    GTIN: normalizeIsbn(metadata.isbn) || clean(metadata.isbn),
  };

  let xml = existing && /<ComicInfo\b/i.test(existing)
    ? existing
    : `<?xml version="1.0" encoding="utf-8"?>\n<ComicInfo xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">\n</ComicInfo>`;

  for (const field of COMIC_INFO_FIELDS) {
    const value = values[field];
    const element = findElements(xml, field)[0];
    if (element) {
      xml = value
        ? xml.replace(element.full, () => `<${field}>${escapeXml(value)}</${field}>`)
        : xml.replace(new RegExp(`[ \\t]*${escapeRegExp(element.full)}[ \\t]*\\r?\\n?`), "");
    } else if (value) {
      // New fields go before <Pages> (the schema keeps it last) or before the closing tag.
      const node = `  <${field}>${escapeXml(value)}</${field}>\n`;
      xml = /<Pages\b/i.test(xml)
        ? xml.replace(/([ \t]*)<Pages\b/i, (match) => `${node}${match}`)
        : xml.replace(/<\/ComicInfo\s*>/i, (match) => `${node}${match}`);
    }
  }
  return xml;
}

export function readComicInfo(xml: string): BookFileMetadataFields {
  const field = (name: string) => {
    const element = findElements(xml, name)[0];
    return element ? textOf(element.inner) : undefined;
  };
  const year = field("Year");
  const month = field("Month");
  const day = field("Day");
  const publishDate = year && Number(year) > 0
    ? [year, month && Number(month) > 0 ? month.padStart(2, "0") : undefined, day && Number(day) > 0 ? day.padStart(2, "0") : undefined]
        .filter(Boolean)
        .join("-")
    : undefined;
  const writer = field("Writer");
  return {
    title: field("Title"),
    series: field("Series"),
    seriesIndex: field("Number"),
    description: field("Summary"),
    publishDate,
    author: writer ? splitSubjects(writer).join(" & ") : undefined,
    publisher: field("Publisher"),
    subject: field("Genre"),
    language: field("LanguageISO"),
    isbn: normalizeIsbn(field("GTIN")) || field("GTIN"),
  };
}

/** Drops empty fields so a partial read never overwrites stored values with blanks. */
export function compactMetadata<T extends object>(fields: T): Partial<T> {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => typeof value === "string" && value.trim())) as Partial<T>;
}
