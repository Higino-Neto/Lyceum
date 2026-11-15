import zlib from "node:zlib";
import type { LyceumBookMetadata } from "../schema/types";
import type {
  AssembledBook,
  AssembledChapter,
  AssembledResource,
  AssembledTocEntry,
} from "../importers/bookAssembly";
import { CHAPTER_LINK_PREFIX, imageMediaType } from "../importers/bookAssembly";
import { LyceumImportError } from "../importers/importErrors";
import { stripHtml } from "../textual";

/**
 * Reader for MOBI 6, KF8 (AZW3) and joint MOBI/KF8 files, written from the
 * public format description (MobileRead wiki: PDB, PalmDOC, MOBI header,
 * EXTH, INDX/TAGX, KF8 skeleton/fragment tables, FDST, HUFF/CDIC).
 * The result is an {@link AssembledBook} ready for the EPUB pipeline.
 */

const NULL_INDEX = 0xffffffff;
const COMPRESSION_NONE = 1;
const COMPRESSION_PALMDOC = 2;
const COMPRESSION_HUFFCDIC = 17480;

type ExthMap = Map<number, Buffer[]>;

interface MobiHeader {
  recordIndex: number;
  compression: number;
  textLength: number;
  textRecordCount: number;
  encryption: number;
  version: number;
  encoding: number;
  fullName: string;
  firstResource: number;
  huffRecord: number;
  huffCount: number;
  extraDataFlags: number;
  fdst: number;
  ncx: number;
  fragment: number;
  skeleton: number;
  exth: ExthMap;
}

class PdbFile {
  readonly offsets: number[] = [];

  constructor(readonly buffer: Buffer) {
    if (buffer.length < 86) throw new LyceumImportError("corrupt", "Arquivo MOBI muito pequeno.");
    const type = buffer.toString("ascii", 60, 68);
    if (type !== "BOOKMOBI" && type !== "TEXtREAd") {
      throw new LyceumImportError("corrupt", "Arquivo nao e um livro MOBI/AZW.");
    }
    const count = buffer.readUInt16BE(76);
    for (let index = 0; index < count; index += 1) {
      const entry = 78 + index * 8;
      if (entry + 4 > buffer.length) break;
      this.offsets.push(buffer.readUInt32BE(entry));
    }
  }

  get recordCount() {
    return this.offsets.length;
  }

  record(index: number): Buffer {
    if (index < 0 || index >= this.offsets.length) return Buffer.alloc(0);
    const start = this.offsets[index];
    const end = index + 1 < this.offsets.length ? this.offsets[index + 1] : this.buffer.length;
    if (start >= end || end > this.buffer.length) return Buffer.alloc(0);
    return this.buffer.subarray(start, end);
  }
}

function u16(buffer: Buffer, offset: number) {
  return offset >= 0 && offset + 2 <= buffer.length ? buffer.readUInt16BE(offset) : 0;
}

function u32(buffer: Buffer, offset: number) {
  return offset >= 0 && offset + 4 <= buffer.length ? buffer.readUInt32BE(offset) : 0;
}

function ascii(buffer: Buffer, offset: number, length: number) {
  return offset >= 0 && offset + length <= buffer.length ? buffer.toString("ascii", offset, offset + length) : "";
}

function readHeader(pdb: PdbFile, recordIndex: number): MobiHeader {
  const record = pdb.record(recordIndex);
  const isMobi = ascii(record, 16, 4) === "MOBI";
  const headerLength = isMobi ? u32(record, 20) : 0;
  const headerEnd = 16 + headerLength;
  const field = (offset: number, fallback = NULL_INDEX) => (isMobi && offset + 4 <= headerEnd ? u32(record, offset) : fallback);
  const exth: ExthMap = new Map();
  if (isMobi && (field(0x80, 0) & 0x40) && ascii(record, headerEnd, 4) === "EXTH") {
    const exthLength = u32(record, headerEnd + 4);
    const count = u32(record, headerEnd + 8);
    let cursor = headerEnd + 12;
    for (let index = 0; index < count; index += 1) {
      const type = u32(record, cursor);
      const length = u32(record, cursor + 4);
      if (length < 8 || cursor + length > Math.min(headerEnd + exthLength, record.length)) break;
      const values = exth.get(type) || [];
      values.push(record.subarray(cursor + 8, cursor + length));
      exth.set(type, values);
      cursor += length;
    }
  }
  const fullNameOffset = field(0x54, 0);
  const fullNameLength = field(0x58, 0);
  const encoding = field(0x1c, 1252);
  const fullName = fullNameLength > 0 && fullNameOffset + fullNameLength <= record.length
    ? decodeText(record.subarray(fullNameOffset, fullNameOffset + fullNameLength), encoding)
    : record.toString("latin1", 0, 32).replace(/\0[\s\S]*$/, "");

  return {
    recordIndex,
    compression: u16(record, 0),
    textLength: u32(record, 4),
    textRecordCount: u16(record, 8),
    encryption: u16(record, 12),
    version: field(0x24, 0),
    encoding,
    fullName,
    firstResource: field(0x6c),
    huffRecord: field(0x70, 0),
    huffCount: field(0x74, 0),
    extraDataFlags: isMobi && headerEnd >= 0xf4 ? u16(record, 0xf2) : 0,
    fdst: field(0xc0),
    ncx: field(0xf4),
    fragment: field(0xf8),
    skeleton: field(0xfc),
    exth,
  };
}

function decodeText(bytes: Buffer, encoding: number) {
  if (encoding === 65001) return bytes.toString("utf8");
  return new TextDecoder("windows-1252").decode(bytes);
}

function exthString(exth: ExthMap, type: number, encoding: number): string | undefined {
  const value = exth.get(type)?.[0];
  if (!value?.length) return undefined;
  const text = decodeText(value, encoding).replace(/\0+$/, "").trim();
  return text || undefined;
}

function exthStrings(exth: ExthMap, type: number, encoding: number): string[] {
  return (exth.get(type) || [])
    .map((value) => decodeText(value, encoding).replace(/\0+$/, "").trim())
    .filter(Boolean);
}

function exthNumber(exth: ExthMap, type: number): number | undefined {
  const value = exth.get(type)?.[0];
  return value && value.length >= 4 ? value.readUInt32BE(0) : undefined;
}

/* ------------------------------------------------------------------ */
/* Text records                                                         */
/* ------------------------------------------------------------------ */

function trailingEntrySize(data: Buffer, end: number) {
  let value = 0;
  for (let index = Math.max(0, end - 4); index < end; index += 1) {
    const byte = data[index];
    if (byte & 0x80) value = 0;
    value = (value << 7) | (byte & 0x7f);
  }
  return value;
}

function trimTrailingEntries(record: Buffer, flags: number): Buffer {
  let end = record.length;
  for (let bits = flags >> 1; bits > 0; bits >>= 1) {
    if (bits & 1) {
      const size = trailingEntrySize(record, end);
      if (size <= 0 || size > end) break;
      end -= size;
    }
  }
  if ((flags & 1) && end > 0) {
    const size = (record[end - 1] & 3) + 1;
    if (size <= end) end -= size;
  }
  return record.subarray(0, end);
}

function decompressPalmDoc(input: Buffer): Buffer {
  const out = Buffer.alloc(Math.max(4096, input.length * 8));
  let length = 0;
  let index = 0;
  let target = out;
  const ensure = (extra: number) => {
    if (length + extra <= target.length) return;
    const grown = Buffer.alloc(Math.max(target.length * 2, length + extra));
    target.copy(grown, 0, 0, length);
    target = grown;
  };
  while (index < input.length) {
    const byte = input[index++];
    if (byte >= 1 && byte <= 8) {
      ensure(byte);
      for (let count = 0; count < byte && index < input.length; count += 1) target[length++] = input[index++];
    } else if (byte < 0x80) {
      ensure(1);
      target[length++] = byte;
    } else if (byte >= 0xc0) {
      ensure(2);
      target[length++] = 0x20;
      target[length++] = byte ^ 0x80;
    } else {
      if (index >= input.length) break;
      const pair = (byte << 8) | input[index++];
      const distance = (pair >> 3) & 0x7ff;
      const size = (pair & 7) + 3;
      ensure(size);
      for (let count = 0; count < size; count += 1) {
        const source = length - distance;
        target[length++] = source >= 0 ? target[source] : 0;
      }
    }
  }
  return target.subarray(0, length);
}

class HuffCdicReader {
  private dict1: Array<{ codeLength: number; terminal: boolean; maxCode: number }> = [];
  private minCodes: number[] = [];
  private maxCodes: number[] = [];
  private dictionary: Array<{ data: Buffer; expanded: boolean } | null> = [];

  constructor(huff: Buffer, cdics: Buffer[]) {
    if (ascii(huff, 0, 4) !== "HUFF") throw new LyceumImportError("corrupt", "Registro HUFF invalido.");
    const table1 = u32(huff, 8);
    const table2 = u32(huff, 12);
    for (let index = 0; index < 256; index += 1) {
      const value = u32(huff, table1 + index * 4);
      const codeLength = value & 0x1f;
      const terminal = (value & 0x80) !== 0;
      const maxCode = (((value >>> 8) + 1) * 2 ** (32 - codeLength)) - 1;
      this.dict1.push({ codeLength, terminal, maxCode });
    }
    this.minCodes.push(0);
    this.maxCodes.push(0);
    for (let codeLength = 1; codeLength <= 32; codeLength += 1) {
      const min = u32(huff, table2 + (codeLength - 1) * 8);
      const max = u32(huff, table2 + (codeLength - 1) * 8 + 4);
      this.minCodes.push(min * 2 ** (32 - codeLength));
      this.maxCodes.push(((max + 1) * 2 ** (32 - codeLength)) - 1);
    }
    for (const cdic of cdics) {
      if (ascii(cdic, 0, 4) !== "CDIC") continue;
      const phrases = u32(cdic, 8);
      const bits = u32(cdic, 12);
      const count = Math.min(2 ** bits, phrases - this.dictionary.length);
      for (let index = 0; index < count; index += 1) {
        const offset = u16(cdic, 16 + index * 2);
        const blen = u16(cdic, 16 + offset);
        const start = 18 + offset;
        this.dictionary.push({
          data: cdic.subarray(start, start + (blen & 0x7fff)),
          expanded: (blen & 0x8000) !== 0,
        });
      }
    }
  }

  decompress(data: Buffer, depth = 0): Buffer {
    if (depth > 32) throw new LyceumImportError("corrupt", "Dicionario HUFF/CDIC recursivo.");
    const padded = Buffer.concat([data, Buffer.alloc(8)]);
    const parts: Buffer[] = [];
    let bitPosition = 0;
    let bitsLeft = data.length * 8;
    const peek32 = (position: number) => {
      const byteIndex = position >>> 3;
      const shift = position & 7;
      const high = padded.readUInt32BE(byteIndex);
      if (!shift) return high;
      return ((high << shift) | (padded[byteIndex + 4] >>> (8 - shift))) >>> 0;
    };
    while (bitsLeft > 0) {
      const code = peek32(bitPosition);
      let { codeLength, maxCode } = this.dict1[code >>> 24];
      if (!this.dict1[code >>> 24].terminal) {
        while (codeLength < 32 && code < this.minCodes[codeLength]) codeLength += 1;
        maxCode = this.maxCodes[codeLength];
      }
      if (codeLength <= 0) break;
      bitPosition += codeLength;
      bitsLeft -= codeLength;
      if (bitsLeft < 0) break;
      const entryIndex = Math.floor((maxCode - code) / 2 ** (32 - codeLength));
      const entry = this.dictionary[entryIndex];
      if (!entry) throw new LyceumImportError("corrupt", "Entrada HUFF/CDIC ausente.");
      if (!entry.expanded) {
        this.dictionary[entryIndex] = null;
        entry.data = this.decompress(entry.data, depth + 1);
        entry.expanded = true;
        this.dictionary[entryIndex] = entry;
      }
      parts.push(entry.data);
    }
    return Buffer.concat(parts);
  }
}

function readTextStream(pdb: PdbFile, header: MobiHeader): Buffer {
  if (header.encryption !== 0) {
    throw new LyceumImportError("drm", "Livro protegido por DRM.");
  }
  const base = header.recordIndex;
  let decompress: (record: Buffer) => Buffer;
  if (header.compression === COMPRESSION_NONE) {
    decompress = (record) => record;
  } else if (header.compression === COMPRESSION_PALMDOC) {
    decompress = decompressPalmDoc;
  } else if (header.compression === COMPRESSION_HUFFCDIC) {
    const huffIndex = base + header.huffRecord;
    const cdics: Buffer[] = [];
    for (let index = 1; index < header.huffCount; index += 1) cdics.push(pdb.record(huffIndex + index));
    const reader = new HuffCdicReader(pdb.record(huffIndex), cdics);
    decompress = (record) => reader.decompress(record);
  } else {
    throw new LyceumImportError("unsupported-compression", `Compressao MOBI nao suportada (${header.compression}).`);
  }

  const chunks: Buffer[] = [];
  for (let index = 1; index <= header.textRecordCount; index += 1) {
    const record = pdb.record(base + index);
    if (!record.length) break;
    chunks.push(decompress(trimTrailingEntries(record, header.extraDataFlags)));
  }
  const text = Buffer.concat(chunks);
  return header.textLength > 0 && header.textLength < text.length ? text.subarray(0, header.textLength) : text;
}

/* ------------------------------------------------------------------ */
/* INDX                                                                 */
/* ------------------------------------------------------------------ */

interface IndexEntry {
  key: string;
  tags: Map<number, number[]>;
}

function forwardVwi(data: Buffer, offset: number): [value: number, consumed: number] {
  let value = 0;
  let consumed = 0;
  while (offset + consumed < data.length) {
    const byte = data[offset + consumed];
    consumed += 1;
    value = value * 128 + (byte & 0x7f);
    if (byte & 0x80) break;
    if (consumed >= 5) break;
  }
  return [value, consumed];
}

function countBits(value: number) {
  let count = 0;
  for (let bits = value; bits; bits >>= 1) count += bits & 1;
  return count;
}

function readIndex(pdb: PdbFile, indexRecord: number, encoding = 65001): { entries: IndexEntry[]; cncx: Map<number, string> } {
  const main = pdb.record(indexRecord);
  if (ascii(main, 0, 4) !== "INDX") return { entries: [], cncx: new Map() };
  const headerLength = u32(main, 4);
  const indexCount = u32(main, 24);
  const cncxCount = u32(main, 52);
  if (ascii(main, headerLength, 4) !== "TAGX") return { entries: [], cncx: new Map() };
  const tagxLength = u32(main, headerLength + 4);
  const controlByteCount = u32(main, headerLength + 8);
  const tagTable: Array<{ tag: number; perEntry: number; mask: number; end: number }> = [];
  for (let offset = headerLength + 12; offset + 4 <= headerLength + tagxLength; offset += 4) {
    tagTable.push({ tag: main[offset], perEntry: main[offset + 1], mask: main[offset + 2], end: main[offset + 3] });
  }

  const cncx = new Map<number, string>();
  for (let cncxIndex = 0; cncxIndex < cncxCount; cncxIndex += 1) {
    const record = pdb.record(indexRecord + indexCount + 1 + cncxIndex);
    let position = 0;
    while (position < record.length) {
      const [length, consumed] = forwardVwi(record, position);
      if (consumed === 0) break;
      if (length > 0) {
        cncx.set(cncxIndex * 0x10000 + position, decodeText(record.subarray(position + consumed, position + consumed + length), encoding));
      }
      position += consumed + length;
      if (length === 0 && record[position - consumed] === 0) {
        // Padding at the end of the record.
        if (record.subarray(position).every((byte) => byte === 0)) break;
      }
    }
  }

  const entries: IndexEntry[] = [];
  for (let recordIndex = 1; recordIndex <= indexCount; recordIndex += 1) {
    const record = pdb.record(indexRecord + recordIndex);
    if (ascii(record, 0, 4) !== "INDX") continue;
    const idxtOffset = u32(record, 20);
    const entryCount = u32(record, 24);
    if (ascii(record, idxtOffset, 4) !== "IDXT") continue;
    const positions: number[] = [];
    for (let index = 0; index < entryCount; index += 1) positions.push(u16(record, idxtOffset + 4 + index * 2));
    positions.push(idxtOffset);

    for (let index = 0; index < entryCount; index += 1) {
      const start = positions[index];
      const keyLength = record[start];
      const key = record.toString("latin1", start + 1, start + 1 + keyLength);
      const controlStart = start + 1 + keyLength;
      const controlBytes = record.subarray(controlStart, controlStart + controlByteCount);
      let dataOffset = controlStart + controlByteCount;
      let controlIndex = 0;
      const pending: Array<{ tag: number; count: number | null; bytes: number | null; perEntry: number }> = [];
      for (const definition of tagTable) {
        if (definition.end === 1) {
          controlIndex += 1;
          continue;
        }
        const value = (controlBytes[controlIndex] ?? 0) & definition.mask;
        if (value === 0) continue;
        if (value === definition.mask) {
          if (countBits(definition.mask) > 1) {
            const [bytes, consumed] = forwardVwi(record, dataOffset);
            dataOffset += consumed;
            pending.push({ tag: definition.tag, count: null, bytes, perEntry: definition.perEntry });
          } else {
            pending.push({ tag: definition.tag, count: 1, bytes: null, perEntry: definition.perEntry });
          }
        } else {
          let mask = definition.mask;
          let shifted = value;
          while (mask && !(mask & 1)) {
            mask >>= 1;
            shifted >>= 1;
          }
          pending.push({ tag: definition.tag, count: shifted, bytes: null, perEntry: definition.perEntry });
        }
      }
      const tags = new Map<number, number[]>();
      for (const item of pending) {
        const values: number[] = [];
        if (item.count !== null) {
          for (let count = 0; count < item.count * item.perEntry; count += 1) {
            const [value, consumed] = forwardVwi(record, dataOffset);
            dataOffset += consumed;
            values.push(value);
          }
        } else {
          let total = 0;
          while (total < (item.bytes || 0)) {
            const [value, consumed] = forwardVwi(record, dataOffset);
            if (!consumed) break;
            dataOffset += consumed;
            total += consumed;
            values.push(value);
          }
        }
        tags.set(item.tag, values);
      }
      entries.push({ key, tags });
    }
  }
  return { entries, cncx };
}

/* ------------------------------------------------------------------ */
/* Resources                                                            */
/* ------------------------------------------------------------------ */

const NON_IMAGE_RESOURCE_TAGS = new Set(["FLIS", "FCIS", "SRCS", "DATP", "RESC", "CMET", "PAGE", "CONT", "CRES", "BOUN", "FDST", "INDX", "kind"]);

function decodeFontRecord(record: Buffer): { data: Buffer; mediaType: string; extension: string } | null {
  if (ascii(record, 0, 4) !== "FONT") return null;
  const flags = u32(record, 8);
  const dataStart = u32(record, 12);
  const xorLength = u32(record, 16);
  const xorStart = u32(record, 20);
  let data = Buffer.from(record.subarray(dataStart));
  if ((flags & 2) && xorLength > 0) {
    const key = record.subarray(xorStart, xorStart + xorLength);
    for (let index = 0; index < Math.min(1040, data.length); index += 1) data[index] ^= key[index % xorLength];
  }
  if (flags & 1) {
    try {
      data = zlib.inflateSync(data);
    } catch {
      return null;
    }
  }
  const signature = data.toString("latin1", 0, 4);
  if (signature === "OTTO") return { data, mediaType: "font/otf", extension: "otf" };
  if (signature === "wOFF") return { data, mediaType: "font/woff", extension: "woff" };
  return { data, mediaType: "font/ttf", extension: "ttf" };
}

class ResourceTable {
  private readonly cache = new Map<number, AssembledResource | null>();
  readonly resources: AssembledResource[] = [];

  constructor(private readonly pdb: PdbFile, private readonly firstResource: number) {}

  /** 1-based index as used by `recindex` and `kindle:embed`. */
  get(index: number): AssembledResource | null {
    if (!Number.isFinite(index) || index < 1 || this.firstResource === NULL_INDEX) return null;
    if (this.cache.has(index)) return this.cache.get(index)!;
    const record = this.pdb.record(this.firstResource + index - 1);
    let resource: AssembledResource | null = null;
    const image = record.length ? imageMediaType(record) : null;
    if (image) {
      resource = {
        href: `images/image-${String(index).padStart(5, "0")}.${image.extension}`,
        mediaType: image.mediaType,
        data: record,
      };
    } else if (!NON_IMAGE_RESOURCE_TAGS.has(ascii(record, 0, 4))) {
      const font = decodeFontRecord(record);
      if (font) {
        resource = {
          href: `fonts/font-${String(index).padStart(5, "0")}.${font.extension}`,
          mediaType: font.mediaType,
          data: font.data,
        };
      }
    }
    this.cache.set(index, resource);
    if (resource) this.resources.push(resource);
    return resource;
  }
}

/** Finds the record holding the first resource; joint files may point it at the MOBI 6 half. */
function resolveFirstResource(pdb: PdbFile, candidates: number[]): number {
  for (const candidate of candidates) {
    if (candidate === NULL_INDEX || candidate <= 0 || candidate >= pdb.recordCount) continue;
    const record = pdb.record(candidate);
    if (imageMediaType(record) || ["FONT", "RESC", "FLIS", "FCIS", "DATP", "SRCS", "CMET"].includes(ascii(record, 0, 4))) {
      return candidate;
    }
  }
  return candidates.find((candidate) => candidate !== NULL_INDEX && candidate > 0 && candidate < pdb.recordCount) ?? NULL_INDEX;
}

/* ------------------------------------------------------------------ */
/* Metadata                                                             */
/* ------------------------------------------------------------------ */

function readMetadata(header: MobiHeader, mobi6Header: MobiHeader): Partial<LyceumBookMetadata> {
  const pick = (type: number) => exthString(header.exth, type, header.encoding) ?? exthString(mobi6Header.exth, type, mobi6Header.encoding);
  const authors = exthStrings(header.exth, 100, header.encoding);
  const subjects = exthStrings(header.exth, 105, header.encoding);
  const description = pick(103);
  return {
    title: pick(503) || header.fullName || mobi6Header.fullName || undefined,
    author: authors.length ? authors.join(" & ") : undefined,
    publisher: pick(101),
    description: description ? stripHtml(description).trim() || undefined : undefined,
    isbn: pick(104),
    subject: subjects.length > 1 ? subjects : subjects[0],
    publishDate: pick(106),
    contributor: pick(108),
    rights: pick(109),
    asin: pick(113),
    language: pick(524),
  };
}

/* ------------------------------------------------------------------ */
/* KF8                                                                  */
/* ------------------------------------------------------------------ */

function decodeBase32(value: string) {
  return Number.parseInt(value, 32);
}

interface Kf8Part {
  start: number;
  bytes: Buffer;
  ids: Array<{ position: number; id: string }>;
}

const ID_TAG_PATTERN = /<[a-zA-Z][^>]*?\s(id|aid)\s*=\s*["']([^"']+)["'][^>]*>/g;

function collectPartIds(bytes: Buffer): Array<{ position: number; id: string }> {
  const text = bytes.toString("latin1");
  const ids: Array<{ position: number; id: string }> = [];
  let match: RegExpExecArray | null;
  ID_TAG_PATTERN.lastIndex = 0;
  while ((match = ID_TAG_PATTERN.exec(text))) {
    const tag = match[0];
    const explicitId = /\sid\s*=\s*["']([^"']+)["']/.exec(tag)?.[1];
    const aid = /\said\s*=\s*["']([^"']+)["']/.exec(tag)?.[1];
    const id = explicitId || (aid ? `aid-${aid}` : "");
    if (id) ids.push({ position: match.index, id });
  }
  return ids;
}

function assembleKf8(pdb: PdbFile, header: MobiHeader, mobi6Header: MobiHeader): AssembledBook {
  const base = header.recordIndex;
  const rawText = readTextStream(pdb, header);
  const warnings: string[] = [];

  const flows: Buffer[] = [];
  const fdst = header.fdst !== NULL_INDEX ? pdb.record(base + header.fdst) : Buffer.alloc(0);
  if (ascii(fdst, 0, 4) === "FDST") {
    const count = u32(fdst, 8);
    for (let index = 0; index < count; index += 1) {
      const start = u32(fdst, 12 + index * 8);
      const end = u32(fdst, 16 + index * 8);
      flows.push(rawText.subarray(start, Math.min(end, rawText.length)));
    }
  }
  if (flows.length === 0) flows.push(rawText);
  const flow0 = flows[0];

  const skeletons = header.skeleton !== NULL_INDEX ? readIndex(pdb, base + header.skeleton).entries : [];
  const fragmentIndex = header.fragment !== NULL_INDEX ? readIndex(pdb, base + header.fragment) : { entries: [], cncx: new Map<number, string>() };
  const fragments = fragmentIndex.entries.map((entry) => {
    const position = entry.tags.get(6) || [0, 0];
    return {
      insertPosition: Number.parseInt(entry.key, 10),
      length: position[1] ?? 0,
    };
  });

  const parts: Kf8Part[] = [];
  if (skeletons.length === 0) {
    parts.push({ start: 0, bytes: flow0, ids: collectPartIds(flow0) });
  } else {
    let fragmentPointer = 0;
    for (const skeleton of skeletons) {
      const fragmentCount = skeleton.tags.get(1)?.[0] ?? 0;
      const [skeletonStart = 0, skeletonLength = 0] = skeleton.tags.get(6) || [];
      let assembled = Buffer.from(flow0.subarray(skeletonStart, skeletonStart + skeletonLength));
      let basePointer = skeletonStart + skeletonLength;
      for (let index = 0; index < fragmentCount && fragmentPointer < fragments.length; index += 1) {
        const fragment = fragments[fragmentPointer++];
        const slice = flow0.subarray(basePointer, basePointer + fragment.length);
        const insertAt = Math.min(Math.max(fragment.insertPosition - skeletonStart, 0), assembled.length);
        assembled = Buffer.concat([assembled.subarray(0, insertAt), slice, assembled.subarray(insertAt)]);
        basePointer += fragment.length;
      }
      parts.push({ start: skeletonStart, bytes: assembled, ids: collectPartIds(assembled) });
    }
  }

  const resolvePosition = (position: number): { chapterIndex: number; anchor?: string } => {
    let chapterIndex = parts.length - 1;
    for (let index = 0; index < parts.length; index += 1) {
      if (position < parts[index].start + parts[index].bytes.length) {
        chapterIndex = index;
        break;
      }
    }
    const part = parts[Math.max(chapterIndex, 0)];
    if (!part) return { chapterIndex: 0 };
    const offset = position - part.start;
    let anchor: string | undefined;
    for (const candidate of part.ids) {
      if (candidate.position <= offset) anchor = candidate.id;
      else {
        anchor ??= candidate.id;
        break;
      }
    }
    if (offset <= 0) anchor = undefined;
    return { chapterIndex: Math.max(chapterIndex, 0), anchor };
  };
  const resolveFid = (fid: number, offset: number) => {
    const fragment = fragments[fid];
    return resolvePosition((fragment ? fragment.insertPosition : 0) + offset);
  };

  const resourceTable = new ResourceTable(pdb, resolveFirstResource(pdb, [
    header.firstResource !== NULL_INDEX ? base + header.firstResource : NULL_INDEX,
    mobi6Header.firstResource,
    header.firstResource,
  ]));
  const extraResources: AssembledResource[] = [];
  const flowHrefs = new Map<number, string>();
  const embedHref = (code: string) => resourceTable.get(decodeBase32(code))?.href;
  const rewriteEmbeds = (text: string) => text.replace(
    /kindle:embed:([0-9A-Va-v]{4})(?:\?mime=[^"')\s]*)?/g,
    (match, code: string) => {
      const href = embedHref(code);
      return href ? `../${href}` : match;
    },
  );
  const flowHref = (code: string, mime: string | undefined) => {
    const index = decodeBase32(code);
    const existing = flowHrefs.get(index);
    if (existing) return existing;
    const flow = flows[index];
    if (!flow) return undefined;
    const isSvg = (mime || "").includes("svg");
    const href = isSvg ? `images/flow-${index}.svg` : `styles/flow-${index}.css`;
    const content = rewriteEmbeds(flow.toString("utf8"));
    extraResources.push({
      href,
      mediaType: isSvg ? "image/svg+xml" : "text/css",
      data: new TextEncoder().encode(content),
    });
    flowHrefs.set(index, href);
    return href;
  };

  const chapters: AssembledChapter[] = parts.map((part) => {
    let html = part.bytes.toString("utf8");
    html = html.replace(/kindle:pos:fid:([0-9A-Va-v]{4}):off:([0-9A-Va-v]{10})/g, (_match, fid: string, off: string) => {
      const target = resolveFid(decodeBase32(fid), decodeBase32(off));
      return `${CHAPTER_LINK_PREFIX}${target.chapterIndex}${target.anchor ? `#${target.anchor}` : ""}`;
    });
    html = html.replace(/kindle:flow:([0-9A-Va-v]{4})(?:\?mime=([^"')\s]*))?/g, (match, code: string, mime?: string) => {
      const href = flowHref(code, mime);
      return href ? `../${href}` : match;
    });
    html = rewriteEmbeds(html);
    // Elements addressed only through `aid` get a real id so links can land on them.
    html = html.replace(/<([a-zA-Z][\w:-]*)([^>]*?)\said\s*=\s*(["'])([^"']+)\3([^>]*)>/g, (match, name: string, before: string, _q: string, aid: string, after: string) => (
      /\sid\s*=/.test(`${before} ${after}`) ? match : `<${name}${before} id="aid-${aid}"${after}>`
    ));
    html = html.replace(/\said\s*=\s*(["'])[^"']*\1/g, "");
    return { html };
  });

  const toc: AssembledTocEntry[] = [];
  if (header.ncx !== NULL_INDEX) {
    try {
      const ncx = readIndex(pdb, base + header.ncx, header.encoding);
      for (const entry of ncx.entries) {
        const label = ncx.cncx.get(entry.tags.get(3)?.[0] ?? -1);
        if (!label) continue;
        const posFid = entry.tags.get(6);
        const target = posFid && posFid.length >= 2
          ? resolveFid(posFid[0], posFid[1])
          : resolvePosition(entry.tags.get(1)?.[0] ?? 0);
        toc.push({ title: label, ...target, level: (entry.tags.get(4)?.[0] ?? 0) + 1 });
      }
    } catch (error) {
      warnings.push(`Indice NCX ignorado: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const coverOffset = exthNumber(header.exth, 201) ?? exthNumber(mobi6Header.exth, 201);
  if (coverOffset !== undefined && coverOffset !== NULL_INDEX) {
    const cover = resourceTable.get(coverOffset + 1);
    if (cover) cover.isCover = true;
  }

  return {
    metadata: readMetadata(header, mobi6Header),
    chapters,
    resources: [...resourceTable.resources, ...extraResources],
    toc,
    warnings,
    stats: { mobiVersion: header.version, kf8: true, partCount: parts.length },
  };
}

/* ------------------------------------------------------------------ */
/* MOBI 6                                                               */
/* ------------------------------------------------------------------ */

function insertAnchors(text: string, positions: Set<number>): string {
  const sorted = [...positions].filter((position) => position >= 0 && position <= text.length).sort((a, b) => b - a);
  let result = text;
  for (const original of sorted) {
    let position = original;
    const lastOpen = result.lastIndexOf("<", position - 1);
    const lastClose = result.lastIndexOf(">", position - 1);
    if (lastOpen > lastClose) position = lastOpen;
    result = `${result.slice(0, position)}<a id="filepos${original}"></a>${result.slice(position)}`;
  }
  return result;
}

function assembleMobi6(pdb: PdbFile, header: MobiHeader): AssembledBook {
  const raw = readTextStream(pdb, header);
  // latin1 keeps one char per byte, so filepos offsets still line up.
  let text = raw.toString("latin1");
  const warnings: string[] = [];

  const ncxEntries: Array<{ label: string; position: number; level: number }> = [];
  if (header.ncx !== NULL_INDEX) {
    try {
      const ncx = readIndex(pdb, header.ncx, header.encoding);
      for (const entry of ncx.entries) {
        const labelOffset = entry.tags.get(3)?.[0];
        const label = labelOffset !== undefined ? ncx.cncx.get(labelOffset) : undefined;
        const position = entry.tags.get(1)?.[0];
        if (!label || position === undefined) continue;
        ncxEntries.push({
          label,
          position,
          level: (entry.tags.get(4)?.[0] ?? 0) + 1,
        });
      }
    } catch (error) {
      warnings.push(`Indice NCX ignorado: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const positions = new Set<number>();
  for (const match of text.matchAll(/filepos\s*=\s*["']?0*(\d+)/gi)) positions.add(Number.parseInt(match[1], 10));
  for (const entry of ncxEntries) positions.add(entry.position);
  text = insertAnchors(text, positions);
  text = text.replace(/\sfilepos\s*=\s*["']?0*(\d+)["']?/gi, (_match, value: string) => ` href="#filepos${Number.parseInt(value, 10)}"`);

  const resourceTable = new ResourceTable(pdb, resolveFirstResource(pdb, [header.firstResource]));
  text = text.replace(/\s(?:hi|lo)?recindex\s*=\s*["']?0*(\d+)["']?/gi, (_match, value: string) => {
    const resource = resourceTable.get(Number.parseInt(value, 10));
    return resource ? ` src="../${resource.href}"` : "";
  });

  const decoded = decodeText(Buffer.from(text, "latin1"), header.encoding);
  const body = decoded
    .replace(/<head\b[\s\S]*?<\/head>/i, "")
    .replace(/<\/?(?:html|body)\b[^>]*>/gi, "")
    .replace(/<guide\b[\s\S]*?<\/guide>/gi, "");
  let chunks = body.split(/<mbp:pagebreak\s*\/?>/i);
  if (chunks.length === 1 && body.length > 200_000) {
    chunks = body.split(/(?=<h[12]\b)/i);
  }
  const chapters: AssembledChapter[] = [];
  const chunkStarts: number[] = [];
  for (const chunk of chunks) {
    const cleaned = chunk.replace(/<\/?mbp:[^>]*>/gi, "");
    if (!stripHtml(cleaned).trim() && !/<img\b/i.test(cleaned)) continue;
    chunkStarts.push(chapters.length);
    chapters.push({ html: cleaned });
  }

  const anchorChapter = new Map<string, number>();
  chapters.forEach((chapter, index) => {
    for (const match of chapter.html.matchAll(/id="(filepos\d+)"/g)) anchorChapter.set(match[1], index);
  });
  const toc: AssembledTocEntry[] = ncxEntries
    .map((entry) => ({
      title: entry.label,
      chapterIndex: anchorChapter.get(`filepos${entry.position}`) ?? -1,
      anchor: `filepos${entry.position}`,
      level: entry.level,
    }))
    .filter((entry) => entry.chapterIndex >= 0);

  const coverOffset = exthNumber(header.exth, 201);
  if (coverOffset !== undefined && coverOffset !== NULL_INDEX) {
    const cover = resourceTable.get(coverOffset + 1);
    if (cover) cover.isCover = true;
  }

  return {
    metadata: readMetadata(header, header),
    chapters,
    resources: resourceTable.resources,
    toc,
    warnings,
    stats: { mobiVersion: header.version, kf8: false },
  };
}

/* ------------------------------------------------------------------ */
/* Entry points                                                         */
/* ------------------------------------------------------------------ */

function locateKf8Header(pdb: PdbFile, first: MobiHeader): MobiHeader | null {
  if (first.version >= 8) return first;
  const boundary = exthNumber(first.exth, 121);
  if (boundary === undefined || boundary === NULL_INDEX || boundary <= 0 || boundary >= pdb.recordCount) return null;
  const header = readHeader(pdb, boundary);
  return header.version >= 8 ? header : null;
}

/**
 * Print Replica (AZW4) books wrap a PDF; returns it when present so the PDF
 * reader can open the original pages.
 */
export function extractPrintReplicaPdf(input: Buffer | Uint8Array): Buffer | null {
  const pdb = new PdbFile(Buffer.isBuffer(input) ? input : Buffer.from(input.buffer, input.byteOffset, input.byteLength));
  for (let index = 1; index < pdb.recordCount; index += 1) {
    const record = pdb.record(index);
    if (ascii(record, 0, 5) === "%PDF-") return Buffer.from(record);
  }
  return null;
}

export function readMobiBook(input: Buffer | Uint8Array): AssembledBook {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  const pdb = new PdbFile(buffer);
  const first = readHeader(pdb, 0);
  const kf8 = locateKf8Header(pdb, first);
  if (kf8) return assembleKf8(pdb, kf8, first);
  if (first.textRecordCount === 0 && extractPrintReplicaPdf(buffer)) {
    throw new LyceumImportError("print-replica", "Livro Print Replica (AZW4) contem um PDF.");
  }
  return assembleMobi6(pdb, first);
}
