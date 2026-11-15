import fs from "node:fs";
import path from "node:path";
import { readKfxMetadataFromSource, type ByteSource } from "../../src/lib/lyceum/kfx/kfxMetadataReader";

/**
 * Reads title/author/cover of books stored on a Kindle (KFX, AZW3, AZW, MOBI,
 * PRC) with a handful of small positioned reads, which matters on MTP mounts
 * where reading whole books is slow. Falls back to the cover thumbnail the
 * Kindle itself keeps in system/thumbnails.
 */

export interface KindleBookDetails {
  title?: string;
  author?: string;
  publisher?: string;
  language?: string;
  publishDate?: string;
  description?: string;
  subject?: string;
  isbn?: string;
  asin?: string;
  cdeType?: string;
}

export interface InspectKindleBookInput {
  filePath: string;
  fileType: string;
  /** Where to write the cover thumbnail (.webp). */
  thumbnailPath: string;
  /** Device root (contains "system/thumbnails"), for the cover fallback. */
  deviceRoot?: string;
  /**
   * "webp" (default): small library thumbnail for Lyceum.
   * "kindle-jpeg": the JPEG the Kindle shows in its library
   * (system/thumbnails/thumbnail_<ASIN>_<TYPE>_portrait.jpg).
   */
  thumbnailFormat?: "webp" | "kindle-jpeg";
  /** Image used when the book has no embedded cover (e.g. the Lyceum cover). */
  fallbackImagePath?: string;
}

export interface InspectKindleBookResult {
  details: KindleBookDetails;
  thumbnailPath?: string;
  error?: string;
}

const THUMB_WIDTH = 400;
const MOBI_TYPES = new Set(["azw3", "azw", "mobi", "prc"]);

function fileSource(fd: number): ByteSource {
  const size = fs.fstatSync(fd).size;
  return {
    size,
    read(offset, length) {
      const safeLength = Math.max(0, Math.min(length, size - offset));
      const buffer = Buffer.alloc(safeLength);
      let done = 0;
      while (done < safeLength) {
        const read = fs.readSync(fd, buffer, done, safeLength - done, offset + done);
        if (read <= 0) break;
        done += read;
      }
      return new Uint8Array(buffer.buffer, buffer.byteOffset, done);
    },
  };
}

const PLACEHOLDER_VALUES = new Set(["unknown", "undefined", "null", "none", "n/a"]);

function clean(value: string | undefined): string | undefined {
  // eslint-disable-next-line no-control-regex
  const text = value?.replace(/\u0000/g, "").replace(/\s+/g, " ").trim();
  return text && !PLACEHOLDER_VALUES.has(text.toLowerCase()) ? text : undefined;
}

function stripHtml(value: string | undefined): string | undefined {
  return clean(value?.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&"));
}

interface MobiInfo {
  details: KindleBookDetails;
  cover?: Uint8Array;
}

/** EXTH metadata and embedded cover of a MOBI/AZW/AZW3 (KF8 half of joint files). */
function readMobiInfo(source: ByteSource): MobiInfo {
  const head = source.read(0, 78);
  if (Buffer.from(head.subarray(60, 68)).toString("latin1") !== "BOOKMOBI") throw new Error("Nao e um livro MOBI.");
  const recordCount = (head[76] << 8) | head[77];
  const table = Buffer.from(source.read(78, recordCount * 8));
  const offsets = Array.from({ length: recordCount }, (_, index) => table.readUInt32BE(index * 8));
  const recordAt = (index: number, maxLength = Infinity) => {
    const start = offsets[index];
    const end = index + 1 < offsets.length ? offsets[index + 1] : source.size;
    return Buffer.from(source.read(start, Math.min(end - start, maxLength)));
  };

  const parseRecordZero = (recordZero: Buffer) => {
    const mobiHeaderLength = recordZero.readUInt32BE(20);
    const exthStart = 16 + mobiHeaderLength;
    const strings = new Map<number, string[]>();
    const ints = new Map<number, number>();
    if ((recordZero.readUInt32BE(128) & 0x40) && recordZero.toString("latin1", exthStart, exthStart + 4) === "EXTH") {
      const count = recordZero.readUInt32BE(exthStart + 8);
      let cursor = exthStart + 12;
      for (let index = 0; index < count && cursor + 8 <= recordZero.length; index += 1) {
        const type = recordZero.readUInt32BE(cursor);
        const length = recordZero.readUInt32BE(cursor + 4);
        if (length < 8 || cursor + length > recordZero.length) break;
        const payload = recordZero.subarray(cursor + 8, cursor + length);
        strings.set(type, [...(strings.get(type) || []), payload.toString("utf8")]);
        if (length === 12) ints.set(type, payload.readUInt32BE(0));
        cursor += length;
      }
    }
    const fullNameOffset = recordZero.readUInt32BE(16 + 68);
    const fullNameLength = recordZero.readUInt32BE(16 + 72);
    const fullName = fullNameLength && fullNameOffset + fullNameLength <= recordZero.length
      ? recordZero.toString("utf8", fullNameOffset, fullNameOffset + fullNameLength)
      : undefined;
    return { strings, ints, fullName, firstResource: recordZero.readUInt32BE(16 + 92) };
  };

  let header = parseRecordZero(recordAt(0, 64 * 1024));
  const boundary = header.ints.get(121);
  if (boundary !== undefined && boundary > 0 && boundary < recordCount && boundary !== 0xffffffff) {
    const kf8 = parseRecordZero(recordAt(boundary, 64 * 1024));
    // The KF8 half usually repeats the EXTH; keep the first half's as fallback.
    header = { ...kf8, strings: new Map([...header.strings, ...kf8.strings]), firstResource: header.firstResource };
  }

  const first = (type: number) => header.strings.get(type)?.map(clean).find(Boolean);
  const authors = (header.strings.get(100) || []).map(clean).filter((value): value is string => Boolean(value));
  const subjects = (header.strings.get(105) || []).map(clean).filter((value): value is string => Boolean(value));
  const details: KindleBookDetails = {
    title: first(503) || clean(header.fullName),
    author: authors.length ? authors.join(" & ") : undefined,
    publisher: first(101),
    description: stripHtml(first(103)),
    isbn: first(104),
    subject: subjects.length ? subjects.join(", ") : undefined,
    publishDate: first(106),
    asin: first(113) || first(504),
    language: first(524),
    cdeType: first(501),
  };

  let cover: Uint8Array | undefined;
  const coverOffset = header.ints.get(201) ?? header.ints.get(202);
  const firstResource = header.firstResource;
  if (coverOffset !== undefined && coverOffset !== 0xffffffff && firstResource && firstResource !== 0xffffffff) {
    const index = firstResource + coverOffset;
    if (index < recordCount) {
      const record = recordAt(index);
      if (imageType(record)) cover = record;
    }
  }
  return { details, cover };
}

function imageType(bytes: Uint8Array): boolean {
  return (bytes[0] === 0xff && bytes[1] === 0xd8)
    || (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
    || Buffer.from(bytes.subarray(0, 4)).toString("latin1") === "GIF8";
}

/** Size of the library thumbnails a Paperwhite generates for store books. */
export const KINDLE_THUMB_WIDTH = 352;
export const KINDLE_THUMB_HEIGHT = 469;

async function writeThumbnail(image: Uint8Array | string, outputPath: string, format: "webp" | "kindle-jpeg" = "webp"): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const sharp = require("sharp");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const input = sharp(typeof image === "string" ? image : Buffer.from(image)).rotate();
  if (format === "kindle-jpeg") {
    await input
      .resize(KINDLE_THUMB_WIDTH, KINDLE_THUMB_HEIGHT, { fit: "inside" })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 88, mozjpeg: true })
      .toFile(outputPath);
  } else {
    await input
      .resize(THUMB_WIDTH, undefined, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(outputPath);
  }
  return outputPath;
}

/** Cover thumbnail the Kindle generated itself: system/thumbnails/thumbnail_<ASIN>_<TYPE>_portrait.jpg */
export function findKindleSystemThumbnail(deviceRoot: string | undefined, asin: string | undefined, cdeType?: string): string | undefined {
  if (!deviceRoot || !asin) return undefined;
  const dir = path.join(deviceRoot, "system", "thumbnails");
  const types = [cdeType, "EBOK", "PDOC"].filter((value, index, all): value is string => Boolean(value) && all.indexOf(value) === index);
  for (const type of types) {
    const candidate = path.join(dir, `thumbnail_${asin}_${type}_portrait.jpg`);
    if (fs.existsSync(candidate)) return candidate;
  }
  return undefined;
}

/** "Dom Quixote_E9DE6FA5C459482D82071164E8FD6CC5" -> "Dom Quixote" (Kindle's ASIN/GUID suffix). */
export function stripKindleFileNameSuffix(baseName: string): string {
  return baseName.replace(/_(?:[A-Z0-9]{10}|[A-F0-9]{32}|[a-f0-9-]{36})$/, "").trim() || baseName;
}

export async function inspectKindleBook(input: InspectKindleBookInput): Promise<InspectKindleBookResult> {
  const type = input.fileType.toLowerCase();
  let details: KindleBookDetails = {};
  let cover: Uint8Array | undefined;
  let error: string | undefined;

  const fd = fs.openSync(input.filePath, "r");
  try {
    const source = fileSource(fd);
    if (type === "kfx") {
      const kfx = readKfxMetadataFromSource(source);
      details = {
        title: clean(kfx.title),
        author: clean(kfx.author),
        publisher: clean(kfx.publisher),
        language: clean(kfx.language),
        publishDate: clean(kfx.publishDate),
        description: stripHtml(kfx.description),
        asin: kfx.asin,
        cdeType: kfx.cdeType,
      };
      cover = kfx.coverImage;
    } else if (MOBI_TYPES.has(type)) {
      const mobi = readMobiInfo(source);
      details = mobi.details;
      cover = mobi.cover;
    }
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
  } finally {
    fs.closeSync(fd);
  }

  let thumbnailPath: string | undefined;
  try {
    const format = input.thumbnailFormat || "webp";
    if (cover) {
      thumbnailPath = await writeThumbnail(cover, input.thumbnailPath, format);
    } else if (input.fallbackImagePath && fs.existsSync(input.fallbackImagePath)) {
      thumbnailPath = await writeThumbnail(input.fallbackImagePath, input.thumbnailPath, format);
    } else if (format === "webp") {
      const systemThumb = findKindleSystemThumbnail(input.deviceRoot, details.asin, details.cdeType);
      if (systemThumb) thumbnailPath = await writeThumbnail(systemThumb, input.thumbnailPath, format);
    }
  } catch (caught) {
    error ||= caught instanceof Error ? caught.message : String(caught);
  }

  return { details, thumbnailPath, error };
}
