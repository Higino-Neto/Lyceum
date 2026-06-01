import JSZip from "jszip";
import { renderDefaultCss } from "../../pdf-to-epub/html";
import type { LyceumBookMetadata, LyceumTextualContent, LyceumTextualResource } from "../schema/types";
import { renderKindleDefaultCss, sanitizeCss } from "../epub/cssSanitizer";
import { escapeXml, extractBodyHtml, isPlaceholderTitle, normalizeHtmlEntitiesForXhtml, stripHtml } from "../textual";

interface PdbRecord {
  data: Uint8Array;
}

interface TagMeta {
  number: number;
  valuesPerEntry: number;
  mask: number;
}

interface SkeletonEntry {
  label: string;
  startPos: number;
  length: number;
  chunkCount: number;
}

interface FragmentEntry {
  insertPos: number;
  selector: string;
  fileNumber: number;
  sequenceNumber: number;
  startPos: number;
  length: number;
}

interface Kf8BuildResult {
  textRecords: PdbRecord[];
  textLength: number;
  htmlLength: number;
  totalTextLength: number;
  fdst: Uint8Array;
  fragmentIndx: Uint8Array[];
  fragmentCncx: Uint8Array[];
  skeletonIndx: Uint8Array[];
  ncxIndx: Uint8Array[];
  ncxCncx: Uint8Array[];
  datp: Uint8Array;
  sourceEpub: Uint8Array;
  skeletonCount: number;
  fragmentCount: number;
  unsupportedResourceCount: number;
  unresolvedInternalLinkCount: number;
}

interface ImageResourceRecord {
  resource: LyceumTextualResource;
  data: Uint8Array;
  embedIndex: number;
}

export interface Azw3BuildOptions {
  metadata: LyceumBookMetadata;
  textual: LyceumTextualContent;
  /**
   * Enable only if you want source EPUB roundtrip support.
   * For very large books with many images this can make the AZW3 much bigger.
   */
  embedSource?: boolean;
}

export interface Azw3BuildResult {
  buffer: ArrayBuffer;
  stats: {
    chapterCount: number;
    textRecordCount: number;
    recordCount: number;
    rawTextBytes: number;
    htmlLength: number;
    totalTextLength: number;
    skeletonCount: number;
    fragmentCount: number;
    fdstRecord: number;
    fragmentIndexRecord: number;
    skeletonIndexRecord: number;
    ncxIndexRecord: number;
    datpRecord: number;
    flisRecord: number;
    fcisRecord: number;
    srcsRecord: number | null;
    compressedTextBytes?: number;
    compressionRatio?: number;
    anchorOffsetCount?: number;
    imageResourceCount?: number;
    coverImageOffset?: number | null;
    thumbnailImageOffset?: number | null;
  } & Record<string, number | string | boolean | null | undefined>;
}

const TEXT_RECORD_SIZE = 4096;
const PALMDOC_HEADER_LENGTH = 16;
const MOBI_HEADER_LENGTH = 264;
const MOBI_HEADER_OFFSET = PALMDOC_HEADER_LENGTH;
const INDX_HEADER_LENGTH = 192;
const PDB_EPOCH = Date.UTC(1904, 0, 1);
const NULL_INDEX = 0xffffffff;
const MOBI_EXTH_FLAGS = 0x00000040;
const END_TAG = 1;
const PALMDOC_COMPRESSION = 2;

function encodeUtf8(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function decodeUtf8(value: Uint8Array): string {
  return new TextDecoder().decode(value);
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;

  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }

  return output;
}

function padToFour(value: Uint8Array): Uint8Array {
  const padding = (4 - (value.length % 4)) % 4;
  if (padding === 0) return value;
  return concatBytes([value, new Uint8Array(padding)]);
}

function writeAscii(buffer: Uint8Array, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    buffer[offset + index] = value.charCodeAt(index) & 0xff;
  }
}

function writeUInt32BE(value: number): Uint8Array {
  const output = new Uint8Array(4);
  new DataView(output.buffer).setUint32(0, value >>> 0, false);
  return output;
}

function put32(buffer: Uint8Array, offset: number, value: number): void {
  new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength).setUint32(offset, value >>> 0, false);
}

function clampPdbName(value: string): string {
  // eslint-disable-next-line no-control-regex
  const clean = value.replace(/[\x00-\x1f]/g, " ").trim() || "Lyceum Book";
  const encoded = encodeUtf8(clean);

  if (encoded.length <= 31) return clean;

  let output = "";
  for (const char of clean) {
    const next = output + char;
    if (encodeUtf8(next).length > 31) break;
    output = next;
  }

  return output || "Lyceum Book";
}

function pdbTimestamp(date = new Date()): number {
  return Math.max(0, Math.floor((date.getTime() - PDB_EPOCH) / 1000));
}

function deterministicId(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function bookIdentifierSeed(metadata: LyceumBookMetadata): string {
  return [
    metadata.identifier,
    metadata.isbn,
    metadata.title,
    metadata.author,
    metadata.publisher,
    metadata.publishDate,
  ].filter(Boolean).join(":");
}

function generateStableIdentifier(seed: string): string {
  const value = deterministicId(seed || "lyceum");
  return `urn:uuid:00000000-0000-4000-8000-${value.toString(16).padStart(12, "0")}`;
}

function normalizeLanguage(language?: string): string {
  return language || "pt-BR";
}

function metadataString(value: string | string[] | number | undefined): string | undefined {
  if (Array.isArray(value)) return value.map((item) => item.trim()).filter(Boolean).join("; ") || undefined;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : undefined;
  return value?.trim() || undefined;
}

function metadataSubjects(value: LyceumBookMetadata["subject"]): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => item.trim()).filter(Boolean);
  return value.split(";").map((item) => item.trim()).filter(Boolean);
}

function localeCode(language?: string): number {
  const lang = normalizeLanguage(language).toLowerCase();
  if (lang.startsWith("pt")) return 0x00000416;
  if (lang.startsWith("en")) return 0x00000409;
  if (lang.startsWith("es")) return 0x00000c0a;
  if (lang.startsWith("fr")) return 0x0000040c;
  if (lang.startsWith("de")) return 0x00000407;
  if (lang.startsWith("it")) return 0x00000410;
  return 0x00000409;
}

function sanitizeXmlId(value: string, fallback: string): string {
  const clean = value
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");

  return clean || fallback;
}

function buildChapterId(index: number): string {
  return `chapter-${String(index + 1).padStart(4, "0")}`;
}

function firstHeadingText(value: string): string | undefined {
  const heading = value.match(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1];
  const text = heading ? stripHtml(heading) : "";
  return text || undefined;
}

function chapterTitle(chapter: LyceumTextualContent["chapters"][number], index: number) {
  if (!isPlaceholderTitle(chapter.title)) return chapter.title;
  const heading = firstHeadingText(extractBodyHtml(chapter.xhtml));
  return isPlaceholderTitle(heading) ? `Capitulo ${index + 1}` : heading!;
}

function removeDuplicateLeadingHeading(bodyHtml: string, title: string): string {
  const match = bodyHtml.match(/^\s*<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  if (!match) return bodyHtml;
  return stripHtml(match[1]).trim() === title.trim()
    ? bodyHtml.slice(match[0].length)
    : bodyHtml;
}

function hrefPath(value: string): string {
  const raw = value.split("#")[0].split("?")[0].replace(/\\/g, "/");
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function dirname(value: string): string {
  const normalized = hrefPath(value);
  const slash = normalized.lastIndexOf("/");
  return slash >= 0 ? normalized.slice(0, slash) : "";
}

function normalizeContentPath(value: string): string {
  const parts = hrefPath(value).split("/");
  const output: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") output.pop();
    else output.push(part);
  }
  return output.join("/");
}

function resolveContentHref(baseHref: string, href: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("#")) return href;
  const base = dirname(baseHref);
  return normalizeContentPath(base ? `${base}/${href}` : href);
}

function resourceBytes(resource: LyceumTextualResource): Uint8Array | null {
  if (resource.data instanceof ArrayBuffer) return new Uint8Array(resource.data);
  if (resource.data) return new Uint8Array(resource.data.buffer, resource.data.byteOffset, resource.data.byteLength);
  return null;
}

function isKindleImageResource(resource: LyceumTextualResource): boolean {
  return ["image/jpeg", "image/png", "image/gif"].includes(resource.mediaType.toLowerCase());
}

function hasResourceProperty(resource: LyceumTextualResource, property: string): boolean {
  return Boolean(resource.properties?.split(/\s+/).includes(property));
}

function buildImageResources(textual: LyceumTextualContent): ImageResourceRecord[] {
  const resources = textual.resources || [];
  const images: ImageResourceRecord[] = [];

  for (const resource of resources) {
    const data = resourceBytes(resource);
    if (!data || data.length === 0 || !isKindleImageResource(resource)) continue;
    images.push({
      resource,
      data,
      embedIndex: images.length + 1,
    });
  }

  return images;
}

function imageEmbedMap(images: ImageResourceRecord[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const image of images) {
    map.set(normalizeContentPath(image.resource.href).toLowerCase(), image.embedIndex);
  }
  return map;
}

function buildKf8Css(textual: LyceumTextualContent): string {
  const resources = textual.resources || [];
  const cssResources = new Map<string, string>();
  const embeds = imageEmbedMap(buildImageResources(textual));

  for (const resource of resources) {
    if (resource.mediaType.toLowerCase() !== "text/css") continue;
    const data = resourceBytes(resource);
    if (!data) continue;
    cssResources.set(normalizeContentPath(resource.href).toLowerCase(), decodeUtf8(data));
  }

  const parts = [renderKindleDefaultCss()];
  for (const resource of resources) {
    if (resource.mediaType.toLowerCase() !== "text/css") continue;
    const css = cssResources.get(normalizeContentPath(resource.href).toLowerCase());
    if (!css) continue;
    const sanitized = sanitizeCss(css, {
      resolveImport: (href) => cssResources.get(resolveContentHref(resource.href, href).toLowerCase()),
      rewriteUrl: (href) => {
        const embed = embeds.get(resolveContentHref(resource.href, href).toLowerCase());
        return embed ? `kindle:embed:${String(embed).padStart(4, "0")}?mime=image` : undefined;
      },
    });
    if (sanitized.css) parts.push(sanitized.css);
  }

  return parts.join("\n");
}

function rewriteResourceReferences(
  html: string,
  chapterHref: string,
  embeds: Map<string, number>,
  chapterPaths: Set<string>,
): { html: string; unresolved: number } {
  let unresolved = 0;
  const rewrite = (value: string) => {
    if (!value || /^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith("#")) return value;
    const resolved = resolveContentHref(chapterHref, value).toLowerCase();
    const embed = embeds.get(resolved);
    if (!embed) {
      unresolved += 1;
      return value;
    }
    return `kindle:embed:${String(embed).padStart(4, "0")}?mime=image`;
  };

  const withAnchors = html.replace(
    /<a\b([^>]*?)\bhref\s*=\s*(["'])([^"']*)\2([^>]*)>/gi,
    (_match, before: string, quote: string, value: string, after: string) => {
      if (!value || value.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(value)) {
        return `<a${before}href=${quote}${value}${quote}${after}>`;
      }
      const [targetPath, fragment = ""] = value.split("#");
      const resolved = resolveContentHref(chapterHref, targetPath).toLowerCase();
      if (chapterPaths.has(resolved)) {
        return fragment
          ? `<a${before}href=${quote}#${fragment}${quote}${after}>`
          : `<a${before}${after}>`;
      }
      unresolved += 1;
      return `<a${before}${after}>`;
    },
  );

  const withSimpleAttrs = withAnchors.replace(
    /\b(src|href|xlink:href|poster)\s*=\s*(["'])([^"']*)\2/gi,
    (_match, name: string, quote: string, value: string) => `${name}=${quote}${rewrite(value)}${quote}`,
  );

  return {
    html: withSimpleAttrs.replace(
      /\bsrcset\s*=\s*(["'])([^"']*)\1/gi,
      (_match, quote: string, value: string) => {
        const first = value.split(",")[0]?.trim().split(/\s+/)[0] || "";
        return `srcset=${quote}${rewrite(first)}${quote}`;
      },
    ),
    unresolved,
  };
}

function buildChapterDocument(
  metadata: LyceumBookMetadata,
  chapter: LyceumTextualContent["chapters"][number],
  index: number,
  bodyHtmlOverride?: string,
): string {
  const language = normalizeLanguage(metadata.language);
  const id = buildChapterId(index);
  const sourceId = sanitizeXmlId(chapter.id || "", id);
  const title = chapterTitle(chapter, index);
  const bodyHtml = removeDuplicateLeadingHeading(
    bodyHtmlOverride ?? normalizeHtmlEntitiesForXhtml(extractBodyHtml(chapter.xhtml)),
    title,
  );

  return `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${escapeXml(language)}" xml:lang="${escapeXml(language)}">
<head>
<meta charset="utf-8" />
<title>${escapeXml(title)}</title>
</head>
<body>
<section id="${id}" data-lyceum-id="${escapeXml(sourceId)}" class="chapter">
<h1>${escapeXml(title)}</h1>
${bodyHtml}
</section>
</body>
</html>`;
}

function addAidAttributes(html: string, aidCounterRef: { value: number }): string {
  const aidableTags =
    /<(p|div|h[1-6]|li|ul|ol|table|tr|td|th|section|article|aside|nav|header|footer|figure|figcaption|blockquote|span|a|em|strong|b|i|body)(\s[^>]*?)?(\/?)>/gi;

  return html.replace(aidableTags, (match, tag: string, attrs = "", selfClose = "") => {
    if (/\said\s*=/.test(attrs)) return match;
    const aid = encodeAidBase32(aidCounterRef.value);
    aidCounterRef.value += 1;
    return `<${tag}${attrs} aid="${aid}"${selfClose}>`;
  });
}

interface BodySplit {
  skeleton: string;
  bodyInner: string;
  bodyInnerOffset: number;
  bodyAid: string;
}

function findBodyOpen(html: string): { start: number; end: number; aid: string } | null {
  const match = /<body\b[^>]*>/i.exec(html);
  if (!match || match.index === undefined) return null;
  const tag = match[0];
  const aidMatch = /\said\s*=\s*["']([^"']*)["']/i.exec(tag);
  return {
    start: match.index,
    end: match.index + tag.length,
    aid: aidMatch?.[1] || "0",
  };
}

function findLastBodyClose(html: string): number {
  return html.toLowerCase().lastIndexOf("</body>");
}

function splitSkeletonAndBody(html: string): BodySplit {
  const bodyOpen = findBodyOpen(html);
  const bodyClose = findLastBodyClose(html);

  if (!bodyOpen || bodyClose < bodyOpen.end) {
    return {
      skeleton: html,
      bodyInner: "",
      bodyInnerOffset: encodeUtf8(html).length,
      bodyAid: "0",
    };
  }

  const head = html.slice(0, bodyOpen.end);
  const inner = html.slice(bodyOpen.end, bodyClose);
  const tail = html.slice(bodyClose);

  return {
    skeleton: head + tail,
    bodyInner: inner,
    bodyInnerOffset: encodeUtf8(head).length,
    bodyAid: bodyOpen.aid,
  };
}

function buildKf8HtmlParts(metadata: LyceumBookMetadata, textual: LyceumTextualContent): {
  combinedHtml: Uint8Array;
  skeletons: SkeletonEntry[];
  fragments: FragmentEntry[];
  unresolvedInternalLinkCount: number;
} {
  const skeletons: SkeletonEntry[] = [];
  const fragments: FragmentEntry[] = [];
  const parts: Uint8Array[] = [];
  let absoluteOffset = 0;
  let sequence = 0;
  const aidCounter = { value: 0 };
  const embeds = imageEmbedMap(buildImageResources(textual));
  const chapterPaths = new Set(textual.chapters.map((chapter) => normalizeContentPath(chapter.href).toLowerCase()));
  let unresolvedInternalLinkCount = 0;

  textual.chapters.forEach((chapter, index) => {
    const body = normalizeHtmlEntitiesForXhtml(extractBodyHtml(chapter.xhtml));
    const rewritten = rewriteResourceReferences(body, chapter.href, embeds, chapterPaths);
    unresolvedInternalLinkCount += rewritten.unresolved;
    const aided = addAidAttributes(buildChapterDocument(metadata, chapter, index, rewritten.html), aidCounter);
    const split = splitSkeletonAndBody(aided);
    const skelBytes = encodeUtf8(split.skeleton);
    const fragBytes = encodeUtf8(split.bodyInner);
    const skelStart = absoluteOffset;
    const insertPos = skelStart + split.bodyInnerOffset;

    parts.push(skelBytes);
    absoluteOffset += skelBytes.length;

    parts.push(fragBytes);
    absoluteOffset += fragBytes.length;

    skeletons.push({
      label: `SKEL${String(index).padStart(10, "0")}`,
      startPos: skelStart,
      length: skelBytes.length,
      chunkCount: 1,
    });

    fragments.push({
      insertPos,
      selector: `P-//*[@aid='${split.bodyAid}']`,
      fileNumber: index,
      sequenceNumber: sequence,
      startPos: 0,
      length: fragBytes.length,
    });

    sequence += 1;
  });

  return {
    combinedHtml: concatBytes(parts),
    skeletons,
    fragments,
    unresolvedInternalLinkCount,
  };
}

function encodeAidBase32(value: number): string {
  if (value === 0) return "0";
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUV";
  let output = "";
  let current = value >>> 0;

  while (current > 0) {
    output = chars[current & 0x1f] + output;
    current >>>= 5;
  }

  return output;
}

function encodeVwiInv(value: number): Uint8Array {
  const bytes: number[] = [];
  let current = value >>> 0;

  bytes.push(current & 0x7f);
  current >>>= 7;

  while (current > 0) {
    bytes.push(current & 0x7f);
    current >>>= 7;
  }

  bytes.reverse();
  bytes[bytes.length - 1] |= 0x80;
  return new Uint8Array(bytes);
}

function isPalmDocDirectByte(byte: number): boolean {
  return byte === 0 || (byte >= 0x09 && byte <= 0x7f);
}

function compressPalmDocRecord(input: Uint8Array): Uint8Array {
  const output: number[] = [];
  const recent = new Map<string, number[]>();
  const maxDistance = 2047;
  const maxLength = 10;
  const maxCandidates = 32;

  const keyAt = (offset: number) => (
    offset + 2 < input.length
      ? `${input[offset]},${input[offset + 1]},${input[offset + 2]}`
      : ""
  );

  const remember = (offset: number) => {
    const key = keyAt(offset);
    if (!key) return;
    const positions = recent.get(key) || [];
    positions.push(offset);
    while (positions.length > 0 && offset - positions[0] > maxDistance) positions.shift();
    while (positions.length > maxCandidates) positions.shift();
    recent.set(key, positions);
  };

  const bestMatchAt = (offset: number) => {
    const key = keyAt(offset);
    const positions = key ? recent.get(key) : undefined;
    if (!positions?.length) return { distance: 0, length: 0 };

    let bestDistance = 0;
    let bestLength = 0;
    for (let index = positions.length - 1; index >= 0; index -= 1) {
      const position = positions[index];
      const distance = offset - position;
      if (distance <= 0 || distance > maxDistance) continue;

      let length = 0;
      while (
        length < maxLength
        && offset + length < input.length
        && input[position + length] === input[offset + length]
      ) {
        length += 1;
      }

      if (length > bestLength) {
        bestLength = length;
        bestDistance = distance;
        if (bestLength === maxLength) break;
      }
    }

    return bestLength >= 3 ? { distance: bestDistance, length: bestLength } : { distance: 0, length: 0 };
  };

  for (let index = 0; index < input.length; index += 1) {
    const match = bestMatchAt(index);
    if (match.length >= 3) {
      const pair = (match.distance << 3) | (match.length - 3);
      output.push(0x80 | ((pair >> 8) & 0x3f), pair & 0xff);
      for (let offset = 0; offset < match.length; offset += 1) remember(index + offset);
      index += match.length - 1;
      continue;
    }

    const byte = input[index];
    const next = input[index + 1];

    if (byte === 0x20 && next >= 0x40 && next <= 0x7f) {
      output.push(next ^ 0x80);
      remember(index);
      remember(index + 1);
      index += 1;
      continue;
    }

    if (isPalmDocDirectByte(byte)) {
      output.push(byte);
      remember(index);
      continue;
    }

    const literalStart = index;
    let literalLength = 0;
    while (literalStart + literalLength < input.length && literalLength < 8) {
      const current = input[literalStart + literalLength];
      const following = input[literalStart + literalLength + 1];
      if (current === 0x20 && following >= 0x40 && following <= 0x7f) break;
      if (isPalmDocDirectByte(current)) break;
      literalLength += 1;
    }

    if (literalLength === 0) {
      output.push(byte);
      continue;
    }

    output.push(literalLength);
    for (let offset = 0; offset < literalLength; offset += 1) {
      output.push(input[literalStart + offset]);
      remember(literalStart + offset);
    }
    index += literalLength - 1;
  }

  return new Uint8Array(output);
}

function splitTextRecordsKf8(rawText: Uint8Array): PdbRecord[] {
  const records: PdbRecord[] = [];

  for (let offset = 0; offset < rawText.length; offset += TEXT_RECORD_SIZE) {
    records.push({ data: concatBytes([compressPalmDocRecord(rawText.slice(offset, offset + TEXT_RECORD_SIZE)), new Uint8Array([0x01])]) });
  }

  return records.length > 0 ? records : [{ data: new Uint8Array([0x00, 0x01]) }];
}

function buildFdstRecord(htmlLength: number, totalLength: number): Uint8Array {
  const flowCount = 2;
  const record = new Uint8Array(12 + flowCount * 8);
  const view = new DataView(record.buffer);

  writeAscii(record, 0, "FDST");
  view.setUint32(4, 12, false);
  view.setUint32(8, flowCount, false);

  // Flow 0: HTML.
  view.setUint32(12, 0, false);
  view.setUint32(16, htmlLength, false);

  // Flow 1: CSS. It can be zero-length but still exists.
  view.setUint32(20, htmlLength, false);
  view.setUint32(24, totalLength, false);

  return record;
}

class CncxBuilder {
  private chunks: Uint8Array[] = [];
  private offsets = new Map<string, number>();
  private totalLength = 0;

  add(value: string): number {
    const existing = this.offsets.get(value);
    if (existing !== undefined) return existing;

    const bytes = encodeUtf8(value);
    const prefix = encodeVwiInv(bytes.length);
    const offset = this.totalLength;
    const chunk = concatBytes([prefix, bytes]);

    this.offsets.set(value, offset);
    this.chunks.push(chunk);
    this.totalLength += chunk.length;

    return offset;
  }

  recordCount(): number {
    return this.totalLength === 0 ? 0 : Math.ceil(this.totalLength / TEXT_RECORD_SIZE);
  }

  intoRecords(): Uint8Array[] {
    const data = concatBytes(this.chunks);
    if (data.length === 0) return [];

    const records: Uint8Array[] = [];
    for (let offset = 0; offset < data.length; offset += TEXT_RECORD_SIZE) {
      records.push(data.slice(offset, offset + TEXT_RECORD_SIZE));
    }
    return records;
  }
}

function maskShifts(mask: number): number {
  switch (mask) {
    case 1: return 0;
    case 2: return 1;
    case 3: return 0;
    case 4: return 2;
    case 8: return 3;
    case 12: return 2;
    case 16: return 4;
    case 32: return 5;
    case 48: return 4;
    case 64: return 6;
    case 128: return 7;
    case 192: return 6;
    default: return 0;
  }
}

function buildTagx(tagDefs: [number, number, number][]): Uint8Array {
  const body: number[] = [];

  for (const [num, vpe, mask] of tagDefs) {
    body.push(num & 0xff, vpe & 0xff, mask & 0xff, 0);
  }

  body.push(0, 0, 0, END_TAG);

  const totalLength = 12 + body.length;
  const out = new Uint8Array(totalLength);
  const view = new DataView(out.buffer);

  writeAscii(out, 0, "TAGX");
  view.setUint32(4, totalLength, false);
  view.setUint32(8, 1, false);
  out.set(body, 12);

  return out;
}

function controlByteFor(tagDefs: TagMeta[], nvalsPerTag: number[]): number {
  let answer = 0;

  tagDefs.forEach((tag, index) => {
    const nentries = Math.floor(nvalsPerTag[index] / tag.valuesPerEntry);
    const shifts = maskShifts(tag.mask);
    answer |= tag.mask & (nentries << shifts);
  });

  return answer & 0xff;
}

function encodeIndxEntry(label: Uint8Array, tagDefs: TagMeta[], valuesByTag: number[][]): Uint8Array {
  const nvalsPerTag = valuesByTag.map((values) => values.length);
  const control = controlByteFor(tagDefs, nvalsPerTag);
  const parts: Uint8Array[] = [new Uint8Array([label.length]), label, new Uint8Array([control])];

  for (const values of valuesByTag) {
    for (const value of values) {
      parts.push(encodeVwiInv(value >>> 0));
    }
  }

  return concatBytes(parts);
}

function buildIndxDataRecord(entries: Uint8Array[]): Uint8Array {
  const header = new Uint8Array(INDX_HEADER_LENGTH);
  writeAscii(header, 0, "INDX");
  put32(header, 4, INDX_HEADER_LENGTH);
  put32(header, 12, 1);

  const entryParts: Uint8Array[] = [];
  const offsets: number[] = [];
  let currentLength = 0;

  for (const entry of entries) {
    offsets.push(INDX_HEADER_LENGTH + currentLength);
    entryParts.push(entry);
    currentLength += entry.length;
  }

  let entriesData = concatBytes(entryParts);
  while ((INDX_HEADER_LENGTH + entriesData.length) % 4 !== 0) {
    entriesData = concatBytes([entriesData, new Uint8Array([0])]);
  }

  const idxtOffset = INDX_HEADER_LENGTH + entriesData.length;
  put32(header, 20, idxtOffset);
  put32(header, 24, entries.length);
  header.fill(0xff, 28, 36);

  const idxt = new Uint8Array(4 + offsets.length * 2 + ((4 - ((4 + offsets.length * 2) % 4)) % 4));
  const idxtView = new DataView(idxt.buffer);
  writeAscii(idxt, 0, "IDXT");
  offsets.forEach((offset, index) => {
    idxtView.setUint16(4 + index * 2, offset, false);
  });

  return concatBytes([header, entriesData, idxt]);
}

function buildIndxPrimary(
  tagx: Uint8Array,
  numDataRecords: number,
  numEntries: number,
  numCncx: number,
  geometry: [Uint8Array, number][],
): Uint8Array {
  const header = new Uint8Array(INDX_HEADER_LENGTH);
  writeAscii(header, 0, "INDX");
  put32(header, 4, INDX_HEADER_LENGTH);
  put32(header, 16, 2);
  put32(header, 24, numDataRecords);
  put32(header, 28, 65001);
  put32(header, 32, NULL_INDEX);
  put32(header, 36, numEntries);
  put32(header, 52, numCncx);
  put32(header, 180, INDX_HEADER_LENGTH);

  let tagxBlock = tagx;
  while (tagxBlock.length % 4 !== 0) tagxBlock = concatBytes([tagxBlock, new Uint8Array([0])]);

  const geomParts: Uint8Array[] = [];
  const geomOffsets: number[] = [];
  const geomBase = INDX_HEADER_LENGTH + tagxBlock.length;
  let geomLength = 0;

  for (const [label, count] of geometry) {
    geomOffsets.push(geomBase + geomLength);
    const geom = new Uint8Array(1 + label.length + 2);
    const geomView = new DataView(geom.buffer);
    geom[0] = label.length;
    geom.set(label, 1);
    geomView.setUint16(1 + label.length, count, false);
    geomParts.push(geom);
    geomLength += geom.length;
  }

  let geomBlock = concatBytes(geomParts);
  while (geomBlock.length % 4 !== 0) geomBlock = concatBytes([geomBlock, new Uint8Array([0])]);

  const idxtOffset = geomBase + geomBlock.length;
  put32(header, 20, idxtOffset);

  const idxt = new Uint8Array(4 + geomOffsets.length * 2 + ((4 - ((4 + geomOffsets.length * 2) % 4)) % 4));
  const idxtView = new DataView(idxt.buffer);
  writeAscii(idxt, 0, "IDXT");
  geomOffsets.forEach((offset, index) => {
    idxtView.setUint16(4 + index * 2, offset, false);
  });

  return concatBytes([header, tagxBlock, geomBlock, idxt]);
}

function minimalIndx(): Uint8Array[] {
  const tagx = buildTagx([[1, 1, 1]]);
  const data = buildIndxDataRecord([]);
  const primary = buildIndxPrimary(tagx, 1, 0, 0, []);
  return [primary, data];
}

function buildSkeletonIndx(skeletons: SkeletonEntry[]): Uint8Array[] {
  if (skeletons.length === 0) return minimalIndx();

  const tagDefs: TagMeta[] = [
    { number: 1, valuesPerEntry: 1, mask: 3 },
    { number: 6, valuesPerEntry: 2, mask: 12 },
  ];
  const tagx = buildTagx([[1, 1, 3], [6, 2, 12]]);

  const entries = skeletons.map((skeleton) => encodeIndxEntry(
    encodeUtf8(skeleton.label),
    tagDefs,
    [
      [skeleton.chunkCount, skeleton.chunkCount],
      [skeleton.startPos, skeleton.length, skeleton.startPos, skeleton.length],
    ],
  ));

  const dataRecord = buildIndxDataRecord(entries);
  const lastLabel = encodeUtf8(skeletons[skeletons.length - 1].label);
  const primary = buildIndxPrimary(tagx, 1, skeletons.length, 0, [[lastLabel, skeletons.length]]);

  return [primary, dataRecord];
}

function buildFragmentIndxWithCncx(fragments: FragmentEntry[]): { indx: Uint8Array[]; cncx: Uint8Array[] } {
  if (fragments.length === 0) return { indx: minimalIndx(), cncx: [] };

  const tagDefs: TagMeta[] = [
    { number: 2, valuesPerEntry: 1, mask: 1 },
    { number: 3, valuesPerEntry: 1, mask: 2 },
    { number: 4, valuesPerEntry: 1, mask: 4 },
    { number: 6, valuesPerEntry: 2, mask: 8 },
  ];
  const tagx = buildTagx([[2, 1, 1], [3, 1, 2], [4, 1, 4], [6, 2, 8]]);

  const cncx = new CncxBuilder();
  const entries = fragments.map((fragment) => {
    const cncxOffset = cncx.add(fragment.selector);
    const label = encodeUtf8(String(fragment.insertPos).padStart(10, "0"));

    return encodeIndxEntry(label, tagDefs, [
      [cncxOffset],
      [fragment.fileNumber],
      [fragment.sequenceNumber],
      [fragment.startPos, fragment.length],
    ]);
  });

  const dataRecord = buildIndxDataRecord(entries);
  const lastLabel = encodeUtf8(String(fragments[fragments.length - 1].insertPos).padStart(10, "0"));
  const cncxRecords = cncx.intoRecords();
  const primary = buildIndxPrimary(tagx, 1, fragments.length, cncxRecords.length, [[lastLabel, fragments.length]]);

  return { indx: [primary, dataRecord], cncx: cncxRecords };
}

function buildNcxIndx(
  metadata: LyceumBookMetadata,
  textual: LyceumTextualContent,
  skeletons: SkeletonEntry[],
  textLength: number,
): { indx: Uint8Array[]; cncx: Uint8Array[] } {
  const tagDefs: TagMeta[] = [
    { number: 1, valuesPerEntry: 1, mask: 0x01 },
    { number: 2, valuesPerEntry: 1, mask: 0x02 },
    { number: 3, valuesPerEntry: 1, mask: 0x04 },
    { number: 4, valuesPerEntry: 1, mask: 0x08 },
    { number: 6, valuesPerEntry: 2, mask: 0x10 },
  ];
  const tagx = buildTagx([[1, 1, 0x01], [2, 1, 0x02], [3, 1, 0x04], [4, 1, 0x08], [6, 2, 0x10]]);
  const cncx = new CncxBuilder();

  const tocEntries = textual.toc.length > 0
    ? textual.toc.map((item, index) => {
      const chapterIndex = Math.min(index, skeletons.length - 1);
      const chapter = textual.chapters[chapterIndex];
      return {
        title: isPlaceholderTitle(item.title) && chapter ? chapterTitle(chapter, chapterIndex) : item.title,
        chapterIndex,
        depth: 0,
      };
    })
    : textual.chapters.map((chapter, index) => ({ title: chapterTitle(chapter, index), chapterIndex: index, depth: 0 }));

  const safeEntries = tocEntries.length > 0 ? tocEntries : [{ title: metadata.title || "Untitled", chapterIndex: 0, depth: 0 }];

  const entries = safeEntries.map((entry, index) => {
    const skeleton = skeletons[Math.max(0, Math.min(entry.chapterIndex, skeletons.length - 1))];
    const offset = skeleton?.startPos || 0;
    const nextSkeleton = skeletons[Math.max(0, Math.min(entry.chapterIndex + 1, skeletons.length - 1))];
    const end = nextSkeleton && nextSkeleton.startPos > offset ? nextSkeleton.startPos : textLength;
    const length = Math.max(0, end - offset);
    const labelOffset = cncx.add(entry.title || metadata.title || "Untitled");
    const label = encodeUtf8(String(index));

    return encodeIndxEntry(label, tagDefs, [
      [offset],
      [length],
      [labelOffset],
      [entry.depth],
      [0, 0],
    ]);
  });

  const dataRecord = buildIndxDataRecord(entries);
  const lastLabel = encodeUtf8(String(entries.length - 1));
  const cncxRecords = cncx.intoRecords();
  const primary = buildIndxPrimary(tagx, 1, entries.length, cncxRecords.length, [[lastLabel, entries.length]]);

  return { indx: [primary, dataRecord], cncx: cncxRecords };
}

function buildDatpRecord(): Uint8Array {
  return new Uint8Array([
    0x44, 0x41, 0x54, 0x50,
    0x00, 0x00, 0x00, 0x0d,
    0x01, 0x04, 0x00, 0x04,
    0x02, 0x00, 0x00, 0x06,
    0x19, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x01,
    0x6d, 0x02, 0x46, 0x02,
    0x66, 0x00, 0x00, 0x00,
  ]);
}

function buildFlisRecord(): Uint8Array {
  const record = new Uint8Array(36);
  const view = new DataView(record.buffer);

  writeAscii(record, 0, "FLIS");
  view.setUint32(4, record.length, false);
  view.setUint32(8, 0x41, false);
  view.setUint32(12, 0, false);
  view.setUint32(16, 0, false);
  view.setUint32(20, NULL_INDEX, false);
  view.setUint32(24, 1, false);
  view.setUint32(28, 3, false);
  view.setUint32(32, 3, false);

  return record;
}

function buildFcisRecord(rawTextLength: number): Uint8Array {
  const record = new Uint8Array(44);
  const view = new DataView(record.buffer);

  writeAscii(record, 0, "FCIS");
  view.setUint32(4, 20, false);
  view.setUint32(8, 16, false);
  view.setUint32(12, 1, false);
  view.setUint32(16, 0, false);
  view.setUint32(20, rawTextLength, false);
  view.setUint32(24, 0, false);
  view.setUint32(28, 32, false);
  view.setUint32(32, 8, false);
  view.setUint32(36, 1, false);
  view.setUint32(40, 1, false);

  return record;
}

function buildEofRecord(): Uint8Array {
  return new Uint8Array([0xe9, 0x8e, 0x0d, 0x0a]);
}

function buildExthRecord(type: number, payload: Uint8Array): Uint8Array {
  const record = new Uint8Array(8 + payload.length);
  const view = new DataView(record.buffer);

  view.setUint32(0, type, false);
  view.setUint32(4, record.length, false);
  record.set(payload, 8);

  return record;
}

function buildExth(
  metadata: LyceumBookMetadata,
  options: {
    coverImageOffset?: number | null;
    thumbnailImageOffset?: number | null;
  } = {},
): Uint8Array {
  const records: Uint8Array[] = [];

  const pushString = (type: number, value?: string | string[] | number) => {
    const normalized = metadataString(value);
    if (!normalized) return;
    records.push(buildExthRecord(type, encodeUtf8(normalized)));
  };

  const pushUInt32 = (type: number, value: number) => {
    records.push(buildExthRecord(type, writeUInt32BE(value)));
  };

  const stableIdentifier = generateStableIdentifier(bookIdentifierSeed(metadata));
  const identifier = metadata.identifier || metadata.isbn || stableIdentifier;
  const asin = metadata.asin || stableIdentifier;

  pushString(100, metadata.author);
  pushString(101, metadata.publisher);
  pushString(102, metadata.description);
  pushString(103, metadata.description);
  pushString(104, metadata.isbn || metadata.identifier || stableIdentifier);
  for (const subject of metadataSubjects(metadata.subject)) pushString(105, subject);
  pushString(106, metadata.publishDate);
  pushString(107, metadata.description);
  pushString(108, metadata.contributor);
  pushString(109, metadata.rights);
  pushString(110, metadata.title || "Untitled");
  pushString(111, "EBOK");
  pushString(112, "lyceum");
  pushString(113, asin || identifier);
  pushString(114, normalizeLanguage(metadata.language));
  pushString(115, metadata.authorSort);
  pushString(118, metadata.titleSort);
  pushString(119, metadata.series);
  pushString(501, "EBOK");
  pushUInt32(503, 0);
  pushUInt32(524, 1);
  if (typeof options.coverImageOffset === "number" && options.coverImageOffset >= 0) {
    pushUInt32(201, options.coverImageOffset);
  }
  if (typeof options.thumbnailImageOffset === "number" && options.thumbnailImageOffset >= 0) {
    pushUInt32(202, options.thumbnailImageOffset);
  }

  // Important: no EXTH 121 in KF8-only output. In hybrid MOBI7+KF8 it points
  // to the KF8 record-0 boundary. Pointing it to SRCS breaks strict readers.

  const recordsPayload = concatBytes(records);
  const header = new Uint8Array(12);
  const view = new DataView(header.buffer);

  writeAscii(header, 0, "EXTH");
  view.setUint32(4, header.length + recordsPayload.length, false);
  view.setUint32(8, records.length, false);

  return padToFour(concatBytes([header, recordsPayload]));
}

function buildRecordZero(args: {
  metadata: LyceumBookMetadata;
  rawTextLength: number;
  textRecordCount: number;
  firstNonTextRecord: number;
  firstResourceRecord: number;
  coverImageOffset: number | null;
  thumbnailImageOffset: number | null;
  fcisRecord: number;
  flisRecord: number;
  srcsRecord: number | null;
  ncxIndexRecord: number;
  fragmentIndexRecord: number;
  skeletonIndexRecord: number;
  datpRecord: number;
}): Uint8Array {
  const title = args.metadata.title || "Untitled";
  const fullName = encodeUtf8(title);
  const exth = buildExth(args.metadata, {
    coverImageOffset: args.coverImageOffset,
    thumbnailImageOffset: args.thumbnailImageOffset,
  });
  const fullNameOffset = PALMDOC_HEADER_LENGTH + MOBI_HEADER_LENGTH + exth.length;
  const recordLength = fullNameOffset + fullName.length + 2;
  const record = padToFour(new Uint8Array(recordLength));
  const view = new DataView(record.buffer, record.byteOffset, record.byteLength);

  // PalmDOC header.
  view.setUint16(0, PALMDOC_COMPRESSION, false);
  view.setUint16(2, 0, false);
  view.setUint32(4, args.rawTextLength, false);          // length without KF8 trailing bytes
  view.setUint16(8, args.textRecordCount, false);
  view.setUint16(10, TEXT_RECORD_SIZE, false);
  view.setUint32(12, 0, false);

  // MOBI header.
  writeAscii(record, MOBI_HEADER_OFFSET, "MOBI");
  view.setUint32(MOBI_HEADER_OFFSET + 4, MOBI_HEADER_LENGTH, false);
  view.setUint32(MOBI_HEADER_OFFSET + 8, 2, false);      // book
  view.setUint32(MOBI_HEADER_OFFSET + 12, 65001, false); // UTF-8
  view.setUint32(MOBI_HEADER_OFFSET + 16, deterministicId(`${title}:${args.metadata.author || ""}:kf8`), false);
  view.setUint32(MOBI_HEADER_OFFSET + 20, 8, false);     // version 8 = KF8/AZW3

  for (const offset of [28, 32, 36, 40, 44, 48, 52, 56, 60]) {
    view.setUint32(MOBI_HEADER_OFFSET + offset, NULL_INDEX, false);
  }
  view.setUint32(MOBI_HEADER_OFFSET + 24, 0, false); // orthographic_index = 0 (none)

  view.setUint32(MOBI_HEADER_OFFSET + 64, args.firstNonTextRecord, false);
  view.setUint32(MOBI_HEADER_OFFSET + 68, fullNameOffset, false);
  view.setUint32(MOBI_HEADER_OFFSET + 72, fullName.length, false);
  view.setUint32(MOBI_HEADER_OFFSET + 76, localeCode(args.metadata.language), false);
  view.setUint32(MOBI_HEADER_OFFSET + 80, 0, false);
  view.setUint32(MOBI_HEADER_OFFSET + 84, 0, false);
  view.setUint32(MOBI_HEADER_OFFSET + 88, 8, false);
  view.setUint32(MOBI_HEADER_OFFSET + 92, args.firstResourceRecord, false);

  view.setUint32(MOBI_HEADER_OFFSET + 96, 0, false);
  view.setUint32(MOBI_HEADER_OFFSET + 100, 0, false);
  view.setUint32(MOBI_HEADER_OFFSET + 104, 0, false);
  view.setUint32(MOBI_HEADER_OFFSET + 108, 0, false);

  view.setUint32(MOBI_HEADER_OFFSET + 112, MOBI_EXTH_FLAGS, false); // EXTH header follows the MOBI header.

  view.setUint32(MOBI_HEADER_OFFSET + 148, NULL_INDEX, false);
  view.setUint32(MOBI_HEADER_OFFSET + 152, NULL_INDEX, false);
  view.setUint32(MOBI_HEADER_OFFSET + 156, NULL_INDEX, false);
  view.setUint32(MOBI_HEADER_OFFSET + 160, 0, false);
  view.setUint32(MOBI_HEADER_OFFSET + 164, 0, false);

  view.setUint16(MOBI_HEADER_OFFSET + 176, 1, false);
  view.setUint16(MOBI_HEADER_OFFSET + 178, args.textRecordCount, false);
  view.setUint32(MOBI_HEADER_OFFSET + 180, 1, false);

  view.setUint32(MOBI_HEADER_OFFSET + 184, args.fcisRecord, false);
  view.setUint32(MOBI_HEADER_OFFSET + 188, 1, false);
  view.setUint32(MOBI_HEADER_OFFSET + 192, args.flisRecord, false);
  view.setUint32(MOBI_HEADER_OFFSET + 196, 1, false);
  view.setUint32(MOBI_HEADER_OFFSET + 200, NULL_INDEX, false);
  view.setUint32(MOBI_HEADER_OFFSET + 204, NULL_INDEX, false);

  view.setUint32(MOBI_HEADER_OFFSET + 208, args.srcsRecord ?? NULL_INDEX, false);
  view.setUint32(MOBI_HEADER_OFFSET + 212, args.srcsRecord === null ? 0 : 1, false);
  view.setUint32(MOBI_HEADER_OFFSET + 216, NULL_INDEX, false);
  view.setUint32(MOBI_HEADER_OFFSET + 220, NULL_INDEX, false);

  // KF8 trailing-data size marker appended to each text record.
  view.setUint32(MOBI_HEADER_OFFSET + 224, 2, false);

  view.setUint32(MOBI_HEADER_OFFSET + 228, args.ncxIndexRecord, false);
  view.setUint32(MOBI_HEADER_OFFSET + 232, args.fragmentIndexRecord, false);
  view.setUint32(MOBI_HEADER_OFFSET + 236, args.skeletonIndexRecord, false);
  view.setUint32(MOBI_HEADER_OFFSET + 240, args.datpRecord, false);
  view.setUint32(MOBI_HEADER_OFFSET + 244, NULL_INDEX, false);

  record.set(exth, PALMDOC_HEADER_LENGTH + MOBI_HEADER_LENGTH);
  record.set(fullName, fullNameOffset);

  return record;
}

async function buildEmbeddedSourceEpub(metadata: LyceumBookMetadata, textual: LyceumTextualContent): Promise<Uint8Array> {
  const identifier = metadata.identifier || `urn:lyceum:${deterministicId(metadata.title || "untitled").toString(16)}`;
  const language = normalizeLanguage(metadata.language);
  const modified = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

  const chapterFiles = textual.chapters.map((chapter, index) => {
    const id = buildChapterId(index);
    const title = chapterTitle(chapter, index);
    const bodyHtml = normalizeHtmlEntitiesForXhtml(extractBodyHtml(chapter.xhtml));
    const content = `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" lang="${escapeXml(language)}" xml:lang="${escapeXml(language)}">
<head>
<meta charset="utf-8" />
<title>${escapeXml(title)}</title>
<link rel="stylesheet" type="text/css" href="../styles/book.css" />
</head>
<body>
<section id="${id}" class="chapter">
<h1>${escapeXml(title)}</h1>
${bodyHtml}
</section>
</body>
</html>`;

    return { path: `OEBPS/text/${id}.xhtml`, data: encodeUtf8(content) };
  });

  const navItems = (textual.toc.length > 0 ? textual.toc : textual.chapters).map((item: any, index: number) => {
    const id = buildChapterId(index);
    const chapter = textual.chapters[index];
    const title = isPlaceholderTitle(item.title) && chapter ? chapterTitle(chapter, index) : item.title || `Capitulo ${index + 1}`;
    return `<li><a href="text/${id}.xhtml">${escapeXml(title)}</a></li>`;
  }).join("\n");

  const manifestItems = chapterFiles.map((_, index) => {
    const id = buildChapterId(index);
    return `<item id="${id}" href="text/${id}.xhtml" media-type="application/xhtml+xml" />`;
  }).join("\n");

  const spineItems = chapterFiles.map((_, index) => {
    const id = buildChapterId(index);
    return `<itemref idref="${id}" />`;
  }).join("\n");

  const files: Array<{ path: string; data: string | Uint8Array; store?: boolean }> = [
    { path: "mimetype", data: "application/epub+zip", store: true },
    { path: "META-INF/container.xml", data: `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles>
<rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
</rootfiles>
</container>` },
    { path: "OEBPS/content.opf", data: `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="bookid">${escapeXml(identifier)}</dc:identifier>
<dc:title>${escapeXml(metadata.title || "Untitled")}</dc:title>
<dc:language>${escapeXml(language)}</dc:language>
${metadata.author ? `<dc:creator>${escapeXml(metadata.author)}</dc:creator>` : ""}
${metadata.publisher ? `<dc:publisher>${escapeXml(metadata.publisher)}</dc:publisher>` : ""}
${metadata.description ? `<dc:description>${escapeXml(metadata.description)}</dc:description>` : ""}
<meta property="dcterms:modified">${escapeXml(modified)}</meta>
<meta name="generator" content="Lyceum AZW3 Writer" />
</metadata>
<manifest>
<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav" />
<item id="css" href="styles/book.css" media-type="text/css" />
${manifestItems}
</manifest>
<spine>
${spineItems}
</spine>
</package>` },
    { path: "OEBPS/nav.xhtml", data: `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${escapeXml(language)}" xml:lang="${escapeXml(language)}">
<head><meta charset="utf-8" /><title>Sumário</title></head>
<body>
<nav epub:type="toc" id="toc"><h1>Sumário</h1><ol>${navItems}</ol></nav>
</body>
</html>` },
    { path: "OEBPS/styles/book.css", data: renderDefaultCss() },
    ...chapterFiles,
  ];

  const zip = new JSZip();
  for (const file of files) {
    zip.file(file.path, file.data, file.store ? { compression: "STORE" } : undefined);
  }

  const generated = await zip.generateAsync({
    type: "uint8array",
    mimeType: "application/epub+zip",
    compression: "DEFLATE",
  });
  return Uint8Array.from(generated);
}

function buildSrcsRecord(sourceEpub: Uint8Array): Uint8Array {
  const header = new Uint8Array(16);
  const view = new DataView(header.buffer);

  writeAscii(header, 0, "SRCS");
  view.setUint32(4, 16, false);
  view.setUint32(8, sourceEpub.length, false);
  view.setUint32(12, 1, false);

  return padToFour(concatBytes([header, sourceEpub]));
}

function buildKf8Section(
  metadata: LyceumBookMetadata,
  textual: LyceumTextualContent,
  sourceEpub: Uint8Array = new Uint8Array(),
): Kf8BuildResult {
  const { combinedHtml, skeletons, fragments, unresolvedInternalLinkCount } = buildKf8HtmlParts(metadata, textual);
  const cssBytes = encodeUtf8(buildKf8Css(textual));
  const htmlLength = combinedHtml.length;
  const combinedText = concatBytes([combinedHtml, cssBytes]);
  const textRecords = splitTextRecordsKf8(combinedText);
  const fdst = buildFdstRecord(htmlLength, combinedText.length);
  const { indx: fragmentIndx, cncx: fragmentCncx } = buildFragmentIndxWithCncx(fragments);
  const skeletonIndx = buildSkeletonIndx(skeletons);
  const { indx: ncxIndx, cncx: ncxCncx } = buildNcxIndx(metadata, textual, skeletons, htmlLength);
  const datp = buildDatpRecord();
  return {
    textRecords,
    textLength: combinedText.length,
    htmlLength,
    totalTextLength: combinedText.length,
    fdst,
    fragmentIndx,
    fragmentCncx,
    skeletonIndx,
    ncxIndx,
    ncxCncx,
    datp,
    sourceEpub,
    skeletonCount: skeletons.length,
    fragmentCount: fragments.length,
    unsupportedResourceCount: 0,
    unresolvedInternalLinkCount,
  };
}

function buildPdb(name: string, records: PdbRecord[]): ArrayBuffer {
  const recordListOffset = 78;
  const pdbGap = 2;
  const dataStartOffset = recordListOffset + records.length * 8 + pdbGap;
  const recordOffsets: number[] = [];
  let dataOffset = dataStartOffset;

  for (const record of records) {
    recordOffsets.push(dataOffset);
    dataOffset += record.data.length;
  }

  const output = new Uint8Array(dataOffset);
  const view = new DataView(output.buffer);
  const pdbName = encodeUtf8(clampPdbName(name));
  output.set(pdbName, 0);

  view.setUint16(32, 0, false);
  view.setUint16(34, 0, false);

  const timestamp = pdbTimestamp();
  view.setUint32(36, timestamp, false);
  view.setUint32(40, timestamp, false);
  view.setUint32(44, 0, false);
  view.setUint32(48, 0, false);
  view.setUint32(52, 0, false);
  view.setUint32(56, 0, false);

  writeAscii(output, 60, "BOOK");
  writeAscii(output, 64, "MOBI");

  view.setUint32(68, deterministicId(name), false);
  view.setUint32(72, 0, false);
  view.setUint16(76, records.length, false);

  records.forEach((record, index) => {
    const entryOffset = recordListOffset + index * 8;
    view.setUint32(entryOffset, recordOffsets[index], false);
    view.setUint32(entryOffset + 4, index + 1, false);
    output.set(record.data, recordOffsets[index]);
  });

  return output.buffer;
}

function assertRecordMagic(records: PdbRecord[], index: number, magic: string): void {
  if (index < 0 || index >= records.length) {
    throw new Error(`Record ${index} is outside record table.`);
  }
  const got = decodeUtf8(records[index].data.slice(0, magic.length));
  if (got !== magic) {
    throw new Error(`Record ${index} should start with ${magic}, got ${JSON.stringify(got)}.`);
  }
}

function buildAzw3FromKf8(options: Azw3BuildOptions, kf8: Kf8BuildResult, embedSource: boolean): Azw3BuildResult {
  const textRecordCount = kf8.textRecords.length;
  const imageResources = buildImageResources(options.textual);
  const imageRecords: PdbRecord[] = imageResources.map((image) => ({ data: image.data }));
  const imageResourceCount = imageRecords.length;
  const firstImageRecord = imageResourceCount > 0 ? textRecordCount + 1 : null;
  const coverImageOffset = imageResources.findIndex((image) => hasResourceProperty(image.resource, "cover-image"));
  const thumbnailImageOffset = imageResources.findIndex((image) => hasResourceProperty(image.resource, "kindle-thumbnail"));

  const fragmentIndexRecord = textRecordCount + 1 + imageResourceCount;
  const fragmentCncxRecord = fragmentIndexRecord + kf8.fragmentIndx.length;
  const skeletonIndexRecord = fragmentCncxRecord + kf8.fragmentCncx.length;
  const ncxIndexRecord = skeletonIndexRecord + kf8.skeletonIndx.length;
  const ncxCncxRecord = ncxIndexRecord + kf8.ncxIndx.length;
  const fdstRecord = ncxCncxRecord + kf8.ncxCncx.length;
  const datpRecord = fdstRecord + 1;
  const flisRecord = datpRecord + 1;
  const fcisRecord = flisRecord + 1;
  const srcsRecord = embedSource ? fcisRecord + 1 : null;
  const eofRecord = embedSource ? fcisRecord + 2 : fcisRecord + 1;
  const firstNonTextRecord = firstImageRecord ?? fragmentIndexRecord;
  const firstResourceRecord = firstImageRecord ?? NULL_INDEX;

  const nonBookRecords: PdbRecord[] = [
    ...imageRecords,
    ...kf8.fragmentIndx.map((data) => ({ data })),
    ...kf8.fragmentCncx.map((data) => ({ data })),
    ...kf8.skeletonIndx.map((data) => ({ data })),
    ...kf8.ncxIndx.map((data) => ({ data })),
    ...kf8.ncxCncx.map((data) => ({ data })),
    { data: kf8.fdst },
    { data: kf8.datp },
    { data: buildFlisRecord() },
    { data: buildFcisRecord(kf8.textLength) },
  ];

  if (embedSource) {
    nonBookRecords.push({ data: buildSrcsRecord(kf8.sourceEpub) });
  }

  nonBookRecords.push({ data: buildEofRecord() });

  const recordZero = buildRecordZero({
    metadata: options.metadata,
    rawTextLength: kf8.textLength,
    textRecordCount,
    firstNonTextRecord,
    firstResourceRecord,
    coverImageOffset: coverImageOffset >= 0 ? coverImageOffset : null,
    thumbnailImageOffset: thumbnailImageOffset >= 0 ? thumbnailImageOffset : null,
    fcisRecord,
    flisRecord,
    srcsRecord,
    ncxIndexRecord,
    fragmentIndexRecord,
    skeletonIndexRecord,
    datpRecord,
  });

  const records: PdbRecord[] = [
    { data: recordZero },
    ...kf8.textRecords,
    ...nonBookRecords,
  ];

  assertRecordMagic(records, fdstRecord, "FDST");
  assertRecordMagic(records, fragmentIndexRecord, "INDX");
  assertRecordMagic(records, skeletonIndexRecord, "INDX");
  assertRecordMagic(records, ncxIndexRecord, "INDX");
  assertRecordMagic(records, datpRecord, "DATP");
  assertRecordMagic(records, flisRecord, "FLIS");
  assertRecordMagic(records, fcisRecord, "FCIS");
  if (srcsRecord !== null) assertRecordMagic(records, srcsRecord, "SRCS");
  const expectedEof = buildEofRecord();
  const actualEof = records[eofRecord]?.data;
  if (!actualEof || actualEof.length !== expectedEof.length || expectedEof.some((byte, index) => actualEof[index] !== byte)) {
    throw new Error(`Record ${eofRecord} should be the MOBI EOF marker.`);
  }

  return {
    buffer: buildPdb(options.metadata.title || "Lyceum Book", records),
    stats: {
      chapterCount: options.textual.chapters.length,
      textRecordCount,
      recordCount: records.length,
      rawTextBytes: kf8.textLength,
      compressedTextBytes: kf8.textRecords.reduce((sum, record) => sum + record.data.length, 0),
      compressionRatio: kf8.textLength > 0
        ? Number((kf8.textRecords.reduce((sum, record) => sum + record.data.length, 0) / kf8.textLength).toFixed(4))
        : 1,
      htmlLength: kf8.htmlLength,
      totalTextLength: kf8.totalTextLength,
      skeletonCount: kf8.skeletonCount,
      fragmentCount: kf8.fragmentCount,
      anchorOffsetCount: 0,
      tocItemCount: options.textual.toc.length,
      maxTocDepth: options.textual.toc.reduce((max, item) => Math.max(max, item.level || 1), 0),
      imageResourceCount,
      firstImageRecord,
      coverImageOffset: coverImageOffset >= 0 ? coverImageOffset : null,
      thumbnailImageOffset: thumbnailImageOffset >= 0 ? thumbnailImageOffset : null,
      unsupportedResourceCount: kf8.unsupportedResourceCount,
      unresolvedInternalLinkCount: kf8.unresolvedInternalLinkCount,
      fdstRecord,
      fragmentIndexRecord,
      skeletonIndexRecord,
      ncxIndexRecord,
      datpRecord,
      flisRecord,
      fcisRecord,
      srcsRecord,
    },
  };
}

export function buildAzw3(options: Azw3BuildOptions): Azw3BuildResult {
  if (options.embedSource) {
    throw new Error("buildAzw3 com embedSource requer buildAzw3Async para empacotar o EPUB com JSZip.");
  }

  return buildAzw3FromKf8(
    options,
    buildKf8Section(options.metadata, options.textual),
    false,
  );
}

export async function buildAzw3Async(options: Azw3BuildOptions): Promise<Azw3BuildResult> {
  const embedSource = options.embedSource ?? false;
  const sourceEpub = embedSource
    ? await buildEmbeddedSourceEpub(options.metadata, options.textual)
    : new Uint8Array();

  return buildAzw3FromKf8(
    options,
    buildKf8Section(options.metadata, options.textual, sourceEpub),
    embedSource,
  );
}
