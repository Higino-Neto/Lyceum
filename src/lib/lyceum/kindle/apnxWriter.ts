/**
 * Amazon Page Number Index (APNX) writer.
 *
 * An APNX file is a sidecar placed in `<book>.sdr/<book>.apnx` next to a
 * sideloaded MOBI/AZW3. It tells the Kindle where each "real" page starts so
 * it can show "Page X of Y" instead of only locations.
 *
 * Layout (all integers big-endian):
 *   u32  65537                       format version
 *   u32  12 + N                      offset of the page section
 *   u32  N                           length of the content header
 *   N    content header (ASCII JSON)
 *   u16  1                           page-section version
 *   u16  M                           length of the page header
 *   u16  P                           number of pages
 *   u16  32                          bits per page offset
 *   M    page header (ASCII JSON)    {"asin": ..., "pageMap": ...}
 *   P*4  u32 page start offsets      byte offsets in the uncompressed text
 */

export type ApnxLabelStyle = "arabic" | "roman" | "custom";

export interface ApnxPageGroup {
  style: ApnxLabelStyle;
  /** Number of pages in this group. */
  count: number;
  /** First number for arabic/roman groups (defaults to 1). */
  first?: number;
  /** Explicit labels for custom groups (length === count). */
  labels?: string[];
}

export interface BuildApnxOptions {
  /** Must match the book's EXTH 113 (ASIN) so the Kindle pairs the files. */
  asin: string;
  /** PalmDB database name of the book (first 32 bytes of the file). */
  acr: string;
  /** EXTH 501, "EBOK" for books, "PDOC" for personal documents. */
  cdeType?: string;
  /** "MOBI_8" for KF8/AZW3, "MOBI_7" for legacy MOBI. */
  format?: "MOBI_8" | "MOBI_7";
  /** Byte offset of each page start in the uncompressed text stream. */
  pageOffsets: number[];
  /** How pages are labelled; defaults to one arabic group numbered from 1. */
  groups?: ApnxPageGroup[];
  /** Short random id; generated when omitted. */
  contentGuid?: string;
}

/** "<dir>/<name>.azw3" -> "<dir>/<name>.apnx" (same base name as the book). */
export function apnxSidecarPath(bookPath: string): string {
  return bookPath.replace(/\.[^./\\]+$/, "") + ".apnx";
}

const FORMAT_VERSION = 65537;
const PAGE_SECTION_VERSION = 1;
const OFFSET_BITS = 32;
const MAX_PAGES = 0xffff;

function jsonString(value: string): string {
  // ASCII-only JSON string: non-ASCII characters become \uXXXX escapes.
  return JSON.stringify(value).replace(/[\u007f-￿]/g, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`);
}

function randomGuid(): string {
  const bytes = new Uint8Array(4);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

const STYLE_CODE: Record<ApnxLabelStyle, string> = { arabic: "a", roman: "r", custom: "c" };

/**
 * Serializes page groups as `(start,type,value),...` where `start` is the
 * 1-based index of the group's first page.
 */
export function buildPageMapString(groups: ApnxPageGroup[]): string {
  let start = 1;
  return groups
    .filter((group) => group.count > 0)
    .map((group) => {
      const value = group.style === "custom"
        ? (group.labels || []).map((label) => label.replace(/[|,()]/g, "")).join("|")
        : String(group.first ?? 1);
      const entry = `(${start},${STYLE_CODE[group.style]},${value})`;
      start += group.count;
      return entry;
    })
    .join(",");
}

/** Normalizes offsets: sorted non-decreasing, non-negative integers, max 65535 pages. */
export function normalizePageOffsets(offsets: number[]): number[] {
  const output: number[] = [];
  let previous = 0;
  for (const raw of offsets.slice(0, MAX_PAGES)) {
    const value = Math.max(previous, Math.max(0, Math.floor(Number.isFinite(raw) ? raw : 0)));
    output.push(value);
    previous = value;
  }
  return output;
}

function encodeAscii(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) bytes[index] = value.charCodeAt(index) & 0x7f;
  return bytes;
}

export function buildApnx(options: BuildApnxOptions): Uint8Array {
  const offsets = normalizePageOffsets(options.pageOffsets);
  if (offsets.length === 0) throw new Error("APNX precisa de pelo menos uma pagina.");

  const format = options.format || "MOBI_8";
  const asin = options.asin || "";
  const contentFields = [
    `"contentGuid":${jsonString(options.contentGuid || randomGuid())}`,
    `"asin":${jsonString(asin)}`,
    `"cdeType":${jsonString(options.cdeType || "EBOK")}`,
    ...(format === "MOBI_8" ? [`"format":"MOBI_8"`] : []),
    `"fileRevisionId":"1"`,
    ...(format === "MOBI_8" ? [`"acr":${jsonString(options.acr || "")}`] : []),
  ];
  const contentHeader = encodeAscii(`{${contentFields.join(",")}}`);

  const groups = options.groups?.length
    ? options.groups
    : [{ style: "arabic" as const, count: offsets.length, first: 1 }];
  const groupTotal = groups.reduce((sum, group) => sum + Math.max(0, group.count), 0);
  if (groupTotal !== offsets.length) {
    throw new Error(`Grupos de paginas somam ${groupTotal}, mas ha ${offsets.length} offsets.`);
  }
  const pageHeader = encodeAscii(`{"asin":${jsonString(asin)},"pageMap":${jsonString(buildPageMapString(groups))}}`);
  if (pageHeader.length > 0xffff) throw new Error("Cabecalho de paginas APNX grande demais.");

  const total = 12 + contentHeader.length + 8 + pageHeader.length + offsets.length * 4;
  const output = new Uint8Array(total);
  const view = new DataView(output.buffer);
  let cursor = 0;

  view.setUint32(cursor, FORMAT_VERSION); cursor += 4;
  view.setUint32(cursor, 12 + contentHeader.length); cursor += 4;
  view.setUint32(cursor, contentHeader.length); cursor += 4;
  output.set(contentHeader, cursor); cursor += contentHeader.length;
  view.setUint16(cursor, PAGE_SECTION_VERSION); cursor += 2;
  view.setUint16(cursor, pageHeader.length); cursor += 2;
  view.setUint16(cursor, offsets.length); cursor += 2;
  view.setUint16(cursor, OFFSET_BITS); cursor += 2;
  output.set(pageHeader, cursor); cursor += pageHeader.length;
  for (const offset of offsets) {
    view.setUint32(cursor, offset >>> 0);
    cursor += 4;
  }

  return output;
}

const ROMAN_PATTERN = /^(?=[ivxlcdm]+$)m{0,4}(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$/i;

function romanToNumber(value: string): number {
  const map: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };
  const chars = value.toLowerCase();
  let total = 0;
  for (let index = 0; index < chars.length; index += 1) {
    const current = map[chars[index]];
    const next = map[chars[index + 1]] || 0;
    total += current < next ? -current : current;
  }
  return total;
}

/**
 * Turns page labels ("i", "ii", "1", "2", "A-1") into compact APNX groups:
 * consecutive roman or arabic runs become ranges, anything else a custom group.
 */
export function groupsFromLabels(labels: string[]): ApnxPageGroup[] {
  const groups: ApnxPageGroup[] = [];
  const classify = (label: string): { style: ApnxLabelStyle; value: number } => {
    const trimmed = label.trim();
    if (/^\d+$/.test(trimmed)) return { style: "arabic", value: Number(trimmed) };
    if (ROMAN_PATTERN.test(trimmed)) return { style: "roman", value: romanToNumber(trimmed) };
    return { style: "custom", value: 0 };
  };

  for (const label of labels) {
    const { style, value } = classify(label);
    const last = groups[groups.length - 1];
    if (last && last.style === style) {
      if (style === "custom") {
        last.labels!.push(label.trim());
        last.count += 1;
        continue;
      }
      if ((last.first ?? 1) + last.count === value) {
        last.count += 1;
        continue;
      }
    }
    groups.push(style === "custom"
      ? { style, count: 1, labels: [label.trim()] }
      : { style, count: 1, first: value });
  }
  return groups;
}
