/**
 * Minimal native reader for KFX (Kindle Format 10) book metadata and cover.
 *
 * A KFX file is a "CONT" container of "ENTY" entities whose payloads are
 * Amazon Ion binary values (https://amazon-ion.github.io/ion-docs/docs/binary.html).
 * This reader never needs Amazon's shared symbol catalog: entity names are
 * resolved through the document's local symbol table, metadata is recognised
 * structurally ({key: "title", value: "..."} pairs) and the cover is the raw
 * media entity referenced by the "cover_image" key, falling back to the first
 * embedded JPEG/PNG. DRM-protected books (KFX-ZIP/DRMION) are not supported.
 */

export interface KfxMetadata {
  title?: string;
  author?: string;
  authors?: string[];
  publisher?: string;
  language?: string;
  publishDate?: string;
  description?: string;
  asin?: string;
  cdeType?: string;
  bookId?: string;
  coverImage?: Uint8Array;
  coverMediaType?: string;
}

type IonValue =
  | { kind: "null" }
  | { kind: "bool"; value: boolean }
  | { kind: "int"; value: number }
  | { kind: "float"; value: number }
  | { kind: "symbol"; id: number }
  | { kind: "string"; value: string }
  | { kind: "blob"; value: Uint8Array }
  | { kind: "list"; items: IonValue[] }
  | { kind: "struct"; fields: Array<[number, IonValue]> }
  | { kind: "other" };

interface Annotated {
  annotations: number[];
  value: IonValue;
}

const BVM = [0xe0, 0x01, 0x00, 0xea];
const SYSTEM_SYMBOL_COUNT = 9; // $ion ... $ion_shared_symbol_table
const MAX_DEPTH = 64;

class IonReader {
  private pos: number;
  constructor(private readonly data: Uint8Array, start = 0, private readonly end = data.length) {
    this.pos = start;
  }

  get done() {
    return this.pos >= this.end;
  }

  private varUInt(): number {
    let result = 0;
    for (let i = 0; i < 8 && this.pos < this.end; i += 1) {
      const byte = this.data[this.pos++];
      result = result * 128 + (byte & 0x7f);
      if (byte & 0x80) return result;
    }
    throw new Error("VarUInt invalido");
  }

  private uint(length: number): number {
    let result = 0;
    for (let i = 0; i < length; i += 1) result = result * 256 + this.data[this.pos + i];
    this.pos += length;
    return result;
  }

  private text(length: number): string {
    const value = new TextDecoder("utf-8").decode(this.data.subarray(this.pos, this.pos + length));
    this.pos += length;
    return value;
  }

  /** Next top-level value, skipping version markers and padding. */
  next(depth = 0): Annotated | null {
    while (this.pos < this.end) {
      if (
        this.data[this.pos] === BVM[0] && this.data[this.pos + 1] === BVM[1]
        && this.data[this.pos + 2] === BVM[2] && this.data[this.pos + 3] === BVM[3]
      ) {
        this.pos += 4;
        continue;
      }
      const value = this.readValue(depth);
      if (value) return value;
    }
    return null;
  }

  private readValue(depth: number): Annotated | null {
    if (depth > MAX_DEPTH) throw new Error("Ion aninhado demais");
    const descriptor = this.data[this.pos++];
    const type = descriptor >> 4;
    let length = descriptor & 0x0f;

    if (length === 15 && type !== 0) return { annotations: [], value: { kind: "null" } };
    if (type === 1) return { annotations: [], value: { kind: "bool", value: length === 1 } };
    if (length === 14 || (type === 13 && length === 1)) length = this.varUInt();
    const start = this.pos;
    const stop = start + length;
    if (stop > this.end) throw new Error("Valor Ion truncado");

    let value: IonValue;
    switch (type) {
      case 0: // NOP padding
        this.pos = stop;
        return null;
      case 2:
        value = { kind: "int", value: this.uint(length) };
        break;
      case 3:
        value = { kind: "int", value: -this.uint(length) };
        break;
      case 4: {
        const view = new DataView(this.data.buffer, this.data.byteOffset + start, length);
        value = { kind: "float", value: length === 8 ? view.getFloat64(0) : length === 4 ? view.getFloat32(0) : 0 };
        this.pos = stop;
        break;
      }
      case 7:
        value = { kind: "symbol", id: this.uint(length) };
        break;
      case 8:
        value = { kind: "string", value: this.text(length) };
        break;
      case 9:
      case 10:
        value = { kind: "blob", value: this.data.subarray(start, stop) };
        this.pos = stop;
        break;
      case 11:
      case 12: {
        const reader = new IonReader(this.data, start, stop);
        const items: IonValue[] = [];
        for (let item = reader.next(depth + 1); item; item = reader.next(depth + 1)) items.push(item.value);
        value = { kind: "list", items };
        this.pos = stop;
        break;
      }
      case 13: {
        const reader = new IonReader(this.data, start, stop);
        const fields: Array<[number, IonValue]> = [];
        while (!reader.done) {
          const fieldId = reader.varUInt();
          const field = reader.readValue(depth + 1);
          if (field) fields.push([fieldId, field.value]);
        }
        value = { kind: "struct", fields };
        this.pos = stop;
        break;
      }
      case 14: {
        const annotationsLength = this.varUInt();
        const annotationsEnd = this.pos + annotationsLength;
        const annotations: number[] = [];
        while (this.pos < annotationsEnd) annotations.push(this.varUInt());
        const inner = this.readValue(depth + 1);
        this.pos = stop;
        return inner ? { annotations: [...annotations, ...inner.annotations], value: inner.value } : null;
      }
      default:
        value = { kind: "other" };
        this.pos = stop;
    }
    this.pos = stop;
    return { annotations: [], value };
  }
}

function readU32LE(data: Uint8Array, offset: number) {
  return (data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16)) + data[offset + 3] * 0x1000000;
}

function readU64LE(data: Uint8Array, offset: number) {
  return readU32LE(data, offset) + readU32LE(data, offset + 4) * 0x100000000;
}

function ascii(data: Uint8Array, offset: number, length: number) {
  return String.fromCharCode(...data.subarray(offset, offset + length));
}

function field(struct: IonValue, id: number): IonValue | undefined {
  return struct.kind === "struct" ? struct.fields.find(([fieldId]) => fieldId === id)?.[1] : undefined;
}

/**
 * Local symbol table: the first `$ion_symbol_table::{imports, symbols}` value
 * in the file. Returns a resolver from symbol id to text.
 */
function readSymbolTable(data: Uint8Array, searchEnd: number): (id: number) => string | undefined {
  for (let offset = 0; offset + 6 < searchEnd; offset += 1) {
    if (data[offset] !== BVM[0] || data[offset + 1] !== BVM[1] || data[offset + 2] !== BVM[2] || data[offset + 3] !== BVM[3]) continue;
    try {
      const value = new IonReader(data, offset, Math.min(data.length, searchEnd)).next();
      if (!value || !value.annotations.includes(3) || value.value.kind !== "struct") continue;
      let importedMax = 0;
      const imports = field(value.value, 6);
      if (imports?.kind === "list") {
        for (const item of imports.items) {
          const maxId = field(item, 8);
          if (maxId?.kind === "int") importedMax += maxId.value;
        }
      }
      const symbols = field(value.value, 7);
      const local = symbols?.kind === "list"
        ? symbols.items.map((item) => (item.kind === "string" ? item.value : ""))
        : [];
      const firstLocal = SYSTEM_SYMBOL_COUNT + importedMax + 1;
      return (id) => (id >= firstLocal ? local[id - firstLocal] : undefined);
    } catch {
      continue;
    }
  }
  return () => undefined;
}

/** Random access to the file, so large books can be read in a few small chunks. */
export interface ByteSource {
  size: number;
  read(offset: number, length: number): Uint8Array;
}

export function bufferSource(data: Uint8Array): ByteSource {
  return { size: data.length, read: (offset, length) => data.subarray(offset, offset + length) };
}

interface Entity {
  id: number;
  type: number;
  /** Absolute offset of the entity record ("ENTY"). */
  offset: number;
  length: number;
}

function readEntities(source: ByteSource, header: Uint8Array): Entity[] {
  if (ascii(header, 0, 4) !== "CONT") throw new Error("Arquivo nao e um contêiner KFX (CONT).");
  const headerLength = readU32LE(header, 6);
  const infoOffset = readU32LE(header, 10);
  const infoLength = readU32LE(header, 14);
  const infoBytes = source.read(infoOffset, infoLength);
  const info = new IonReader(infoBytes).next();
  if (!info || info.value.kind !== "struct") throw new Error("Cabecalho KFX invalido.");

  // The container info holds two integer pairs: (index table offset, length)
  // and others. The index table is the pair whose length is a multiple of 24
  // and whose entries all point at "ENTY" records.
  const ints = info.value.fields.filter(([, value]) => value.kind === "int") as Array<[number, { kind: "int"; value: number }]>;
  for (let i = 0; i + 1 < ints.length; i += 1) {
    const tableOffset = ints[i][1].value;
    const tableLength = ints[i + 1][1].value;
    if (tableLength <= 0 || tableLength % 24 !== 0 || tableOffset + tableLength > source.size) continue;
    const table = source.read(tableOffset, tableLength);
    const entities: Entity[] = [];
    let valid = true;
    for (let entry = 0; entry < tableLength; entry += 24) {
      const offset = headerLength + readU64LE(table, entry + 8);
      const length = readU64LE(table, entry + 16);
      if (length < 10 || offset + length > source.size) {
        valid = false;
        break;
      }
      entities.push({ id: readU32LE(table, entry), type: readU32LE(table, entry + 4), offset, length });
    }
    // Spot-check the first entity's magic before trusting this table.
    if (valid && entities.length > 0 && ascii(source.read(entities[0].offset, 4), 0, 4) === "ENTY") return entities;
  }
  throw new Error("Indice de entidades KFX nao encontrado.");
}

const METADATA_KEYS = new Set([
  "title", "author", "publisher", "language", "issue_date", "description",
  "ASIN", "asin", "cde_content_type", "book_id", "cover_image", "content_id",
]);

function imageType(bytes: Uint8Array): string | undefined {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (ascii(bytes, 0, 4) === "GIF8") return "image/gif";
  return undefined;
}

/** Entities at most this big are read eagerly (text, layout, metadata). */
const SMALL_ENTITY_BYTES = 64 * 1024;
const COALESCE_GAP_BYTES = 64 * 1024;

/** Payload of every small entity, read in a few coalesced chunks. */
function readSmallPayloads(source: ByteSource, entities: Entity[]): Map<Entity, Uint8Array> {
  const small = entities.filter((entity) => entity.length <= SMALL_ENTITY_BYTES).sort((a, b) => a.offset - b.offset);
  const payloads = new Map<Entity, Uint8Array>();
  let index = 0;
  while (index < small.length) {
    const start = small[index].offset;
    let end = start + small[index].length;
    let last = index;
    while (last + 1 < small.length && small[last + 1].offset - end <= COALESCE_GAP_BYTES) {
      last += 1;
      end = Math.max(end, small[last].offset + small[last].length);
    }
    const chunk = source.read(start, end - start);
    for (let item = index; item <= last; item += 1) {
      const entity = small[item];
      const record = chunk.subarray(entity.offset - start, entity.offset - start + entity.length);
      payloads.set(entity, entityPayload(record));
    }
    index = last + 1;
  }
  return payloads;
}

function entityPayload(record: Uint8Array): Uint8Array {
  if (ascii(record, 0, 4) !== "ENTY") return new Uint8Array();
  return record.subarray(readU32LE(record, 6));
}

export function readKfxMetadata(input: Uint8Array | ArrayBuffer): KfxMetadata {
  return readKfxMetadataFromSource(bufferSource(input instanceof Uint8Array ? input : new Uint8Array(input)));
}

export function readKfxMetadataFromSource(source: ByteSource): KfxMetadata {
  const start = source.read(0, Math.min(source.size, 18));
  if (ascii(start, 0, 4) === "PK\u0003\u0004") throw new Error("KFX-ZIP (com DRM) nao suportado.");
  if (ascii(start, 0, 4) !== "CONT" || start.length < 18) throw new Error("Arquivo nao e um contêiner KFX (CONT).");
  const headerLength = readU32LE(start, 6);
  const header = source.read(0, Math.min(source.size, headerLength));
  const entities = readEntities(source, header);
  const symbolName = readSymbolTable(header, header.length);
  const smallPayloads = readSmallPayloads(source, entities);
  const resolve = (value: IonValue | undefined): string | undefined => {
    if (!value) return undefined;
    if (value.kind === "string") return value.value;
    if (value.kind === "symbol") return symbolName(value.id);
    return undefined;
  };

  const pairs = new Map<string, string[]>();
  const collect = (value: IonValue, depth: number) => {
    if (depth > MAX_DEPTH) return;
    if (value.kind === "struct") {
      if (value.fields.length === 2) {
        const key = resolve(value.fields[0][1]);
        const content = resolve(value.fields[1][1]);
        if (key && METADATA_KEYS.has(key) && content !== undefined) {
          pairs.set(key, [...(pairs.get(key) || []), content]);
          return;
        }
      }
      for (const [, child] of value.fields) collect(child, depth + 1);
    } else if (value.kind === "list") {
      for (const child of value.items) collect(child, depth + 1);
    }
  };

  const resourceLocations = new Map<string, string>();
  const isIonPayload = (payload: Uint8Array) => (
    payload[0] === BVM[0] && payload[1] === BVM[1] && payload[2] === BVM[2] && payload[3] === BVM[3]
  );
  for (const entity of entities) {
    const payload = smallPayloads.get(entity);
    if (!payload || !isIonPayload(payload)) continue;
    const name = symbolName(entity.id);
    let value: IonValue | undefined;
    try {
      value = new IonReader(payload).next()?.value;
    } catch {
      continue;
    }
    if (!value) continue;
    collect(value, 0);
    // External resources: a struct whose string fields include a
    // "resource/..." style location; remember it by the entity name.
    if (value.kind === "struct" && name) {
      for (const [, child] of value.fields) {
        const text = resolve(child);
        if (text && /^resource\//.test(text)) resourceLocations.set(name, text);
      }
    }
  }

  const first = (key: string) => pairs.get(key)?.find((value) => value.trim())?.trim();
  const authors = (pairs.get("author") || []).map((value) => value.trim()).filter(Boolean);
  const readPayload = (entity: Entity) => smallPayloads.get(entity) || entityPayload(source.read(entity.offset, entity.length));
  const coverName = first("cover_image");
  const coverLocation = coverName ? resourceLocations.get(coverName) || coverName : undefined;
  let coverImage: Uint8Array | undefined;
  const coverEntity = coverLocation ? entities.find((entity) => symbolName(entity.id) === coverLocation) : undefined;
  if (coverEntity) {
    const payload = readPayload(coverEntity);
    if (imageType(payload)) coverImage = payload;
  }
  if (!coverImage) {
    // Fallback: the first embedded image, checking only a few bytes of each.
    for (const entity of [...entities].sort((a, b) => a.offset - b.offset)) {
      const small = smallPayloads.get(entity);
      if (small && isIonPayload(small)) continue;
      const head = small || entityPayload(source.read(entity.offset, Math.min(entity.length, 256)));
      if (!imageType(head)) continue;
      coverImage = readPayload(entity);
      break;
    }
  }

  return {
    title: first("title"),
    author: authors.length ? authors.join(" & ") : undefined,
    authors: authors.length ? authors : undefined,
    publisher: first("publisher"),
    language: first("language"),
    publishDate: first("issue_date"),
    description: first("description"),
    asin: first("ASIN") || first("asin"),
    cdeType: first("cde_content_type"),
    bookId: first("book_id") || first("content_id"),
    coverImage,
    coverMediaType: coverImage ? imageType(coverImage) : undefined,
  };
}
