import fs from "node:fs";
import { readMobiBookText } from "../mobi/azw3Pipeline";
import { computePageStarts } from "../pagination/paginate";
import { DEFAULT_CHARS_PER_PAGE } from "../pagination/pageAnchors";
import { apnxSidecarPath, buildApnx } from "./apnxWriter";

const SKIPPED_ELEMENTS = new Set(["head", "style", "script", "title"]);

interface VisibleScan {
  /** Byte offset of every visible character (whitespace runs count once). */
  positions: Uint32Array;
  count: number;
}

/**
 * Walks raw (X)HTML bytes and records where each visible character starts.
 * Markup, head/style/script content and UTF-8 continuation bytes are skipped,
 * so the count matches what a reader would display.
 */
export function scanVisibleText(html: Uint8Array, end = html.length): VisibleScan {
  const positions = new Uint32Array(Math.max(1, end));
  let count = 0;
  let inTag = false;
  let tagStart = 0;
  let skipDepth = 0;
  let inSpace = true;

  for (let index = 0; index < end; index += 1) {
    const byte = html[index];
    if (inTag) {
      if (byte === 0x3e /* > */) {
        inTag = false;
        const tag = Buffer.from(html.subarray(tagStart + 1, Math.min(index, tagStart + 24))).toString("latin1").toLowerCase();
        const match = /^(\/?)([a-z][a-z0-9]*)/.exec(tag);
        if (match && SKIPPED_ELEMENTS.has(match[2])) {
          if (match[1]) skipDepth = Math.max(0, skipDepth - 1);
          else if (!tag.endsWith("/")) skipDepth += 1;
        }
        // Block boundaries separate words even without whitespace in the source.
        inSpace = true;
      }
      continue;
    }
    if (byte === 0x3c /* < */) {
      inTag = true;
      tagStart = index;
      continue;
    }
    if (skipDepth > 0) continue;
    if ((byte & 0xc0) === 0x80) continue; // UTF-8 continuation byte
    const isSpace = byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d;
    if (isSpace) {
      if (!inSpace) positions[count++] = index;
      inSpace = true;
      continue;
    }
    positions[count++] = index;
    inSpace = false;
  }

  return { positions, count };
}

export interface MobiPageOptions {
  mode: "target-count" | "estimate";
  printPageCount?: number;
  charsPerPage?: number;
}

/** Byte offsets where each page starts, for an existing MOBI/AZW3 text stream. */
export function estimateMobiPageOffsets(html: Uint8Array, htmlLength: number, options: MobiPageOptions): number[] {
  const scan = scanVisibleText(html, htmlLength);
  const starts = computePageStarts(scan.count, options.mode === "target-count"
    ? { mode: "target-count", printPageCount: options.printPageCount }
    : { mode: "estimate", charsPerPage: options.charsPerPage || DEFAULT_CHARS_PER_PAGE });
  return starts.map((start, index) => (index === 0 ? 0 : scan.positions[Math.min(start, scan.count - 1)]));
}

export interface WriteMobiApnxResult {
  written: boolean;
  apnxPath?: string;
  pageCount: number;
  reason?: string;
}

/**
 * Generates "<book>.apnx" next to an existing MOBI/AZW3 file. Books without a
 * print page count get an estimate. Never throws for unsupported books: the
 * result says why nothing was written.
 */
export function writeApnxForMobiFile(
  bookPath: string,
  options: { pageNumbers?: "auto" | "off" | "target-count" | "estimate"; printPageCount?: number; charsPerPage?: number; outputPath?: string } = {},
): WriteMobiApnxResult {
  if (options.pageNumbers === "off") return { written: false, pageCount: 0, reason: "disabled" };
  try {
    const book = readMobiBookText(fs.readFileSync(bookPath));
    const useTarget = Boolean(options.printPageCount && options.printPageCount > 0 && options.pageNumbers !== "estimate");
    const offsets = estimateMobiPageOffsets(book.text, book.htmlLength, useTarget
      ? { mode: "target-count", printPageCount: options.printPageCount }
      : { mode: "estimate", charsPerPage: options.charsPerPage });
    if (offsets.length === 0) return { written: false, pageCount: 0, reason: "no-text" };
    const apnx = buildApnx({
      asin: book.asin || "",
      acr: book.pdbName,
      cdeType: book.cdeType || "EBOK",
      format: book.mobiVersion >= 8 ? "MOBI_8" : "MOBI_7",
      pageOffsets: offsets,
    });
    const apnxPath = options.outputPath || apnxSidecarPath(bookPath);
    fs.writeFileSync(apnxPath, apnx);
    return { written: true, apnxPath, pageCount: offsets.length };
  } catch (error) {
    return { written: false, pageCount: 0, reason: error instanceof Error ? error.message : String(error) };
  }
}
