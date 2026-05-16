import fs from "node:fs";

const PDB_HEADER_LENGTH = 78;
const PDB_RECORD_ENTRY_LENGTH = 8;
const PALMDOC_HEADER_LENGTH = 16;
const MOBI_HEADER_OFFSET = PALMDOC_HEADER_LENGTH;
const MOBI_VERSION_KF8 = 8;
const EXTH_PRESENT_FLAG = 0x40;
const MIN_AZW3_SIZE = 1024;
const EOF_MARKER = Buffer.from([0xe9, 0x8e, 0x0d, 0x0a]);

export interface Azw3ValidationMetadata {
  fileSize: number;
  pdbName?: string;
  compression?: number;
  recordCount?: number;
  textLength?: number;
  textRecordCount?: number;
  mobiHeaderLength?: number;
  mobiVersion?: number;
  firstNonTextRecord?: number;
  firstResourceRecord?: number;
  fullName?: string;
  hasExth?: boolean;
  exthRecordCount?: number;
  extraDataFlags?: number;
  ncxIndexRecord?: number;
  fragmentIndexRecord?: number;
  skeletonIndexRecord?: number;
  datpRecord?: number;
  hasFdst?: boolean;
  hasFlis?: boolean;
  hasFcis?: boolean;
  hasDatp?: boolean;
  hasIndx?: boolean;
  hasSrcs?: boolean;
  hasEof?: boolean;
}

export interface Azw3ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  metadata: Azw3ValidationMetadata;
}

function asBuffer(input: Buffer | Uint8Array | ArrayBuffer): Buffer {
  if (Buffer.isBuffer(input)) return input;
  if (input instanceof ArrayBuffer) return Buffer.from(input);
  return Buffer.from(input.buffer, input.byteOffset, input.byteLength);
}

function readAscii(buffer: Buffer, offset: number, length: number): string {
  if (offset < 0 || offset + length > buffer.length) return "";
  return buffer.toString("ascii", offset, offset + length);
}

function readUInt16BE(buffer: Buffer, offset: number): number {
  if (offset < 0 || offset + 2 > buffer.length) return 0;
  return buffer.readUInt16BE(offset);
}

function readUInt32BE(buffer: Buffer, offset: number): number {
  if (offset < 0 || offset + 4 > buffer.length) return 0;
  return buffer.readUInt32BE(offset);
}

function recordSlice(buffer: Buffer, offsets: number[], index: number): Buffer {
  const start = offsets[index] || 0;
  const end = index + 1 < offsets.length ? offsets[index + 1] : buffer.length;
  return buffer.subarray(start, end);
}

function startsWith(buffer: Buffer, marker: string): boolean {
  return readAscii(buffer, 0, marker.length) === marker;
}

function hasEofMarker(buffer: Buffer, offsets: number[]): boolean {
  if (buffer.length >= EOF_MARKER.length && buffer.subarray(buffer.length - EOF_MARKER.length).equals(EOF_MARKER)) {
    return true;
  }

  if (offsets.length === 0) return false;
  return recordSlice(buffer, offsets, offsets.length - 1).equals(EOF_MARKER);
}

function decodeTextPreview(buffer: Buffer, offsets: number[], firstNonTextRecord: number): string {
  if (offsets.length < 2) return "";
  const endRecord = Math.min(Math.max(firstNonTextRecord, 2), offsets.length - 1);
  const start = offsets[1];
  const end = offsets[endRecord] || Math.min(buffer.length, start + 32768);
  return buffer.subarray(start, Math.min(end, start + 32768)).toString("utf8");
}

function getSizeOfTrailingDataEntry(data: Buffer): number {
  let value = 0;
  for (const byte of data.subarray(Math.max(0, data.length - 4))) {
    if (byte & 0x80) value = 0;
    value = (value << 7) | (byte & 0x7f);
  }
  return value;
}

function trimExtraData(record: Buffer, extraDataFlags: number): Buffer {
  let data = record;
  let flags = extraDataFlags;
  const multibyte = flags & 1;

  while (flags > 1 && data.length > 0) {
    if (flags & 2) {
      const size = getSizeOfTrailingDataEntry(data);
      if (size <= 0 || size > data.length) break;
      data = data.subarray(0, data.length - size);
    }
    flags >>= 1;
  }

  if (multibyte && data.length > 0) {
    const size = (data[data.length - 1] & 3) + 1;
    if (size <= data.length) data = data.subarray(0, data.length - size);
  }

  return data;
}

function decompressPalmDoc(record: Buffer): Buffer {
  const out: number[] = [];
  for (let index = 0; index < record.length; index += 1) {
    const byte = record[index];

    if (byte >= 1 && byte <= 8) {
      const literal = record.subarray(index + 1, index + 1 + byte);
      out.push(...literal);
      index += byte;
    } else if (byte >= 0x80 && byte <= 0xbf && index + 1 < record.length) {
      const pair = (byte << 8) | record[index + 1];
      const distance = (pair >> 3) & 0x7ff;
      const length = (pair & 0x7) + 3;
      index += 1;

      for (let count = 0; count < length; count += 1) {
        const source = out.length - distance;
        out.push(source >= 0 ? out[source] : 0);
      }
    } else if (byte >= 0xc0) {
      out.push(0x20, byte ^ 0x80);
    } else {
      out.push(byte);
    }
  }

  return Buffer.from(out);
}

function decodeTextPreviewFromRecords(
  buffer: Buffer,
  offsets: number[],
  textRecordCount: number,
  compression: number,
  extraDataFlags: number,
): string {
  const records: Buffer[] = [];
  const count = Math.min(textRecordCount, Math.max(0, offsets.length - 1), 8);

  for (let index = 1; index <= count; index += 1) {
    const trimmed = trimExtraData(recordSlice(buffer, offsets, index), extraDataFlags);
    records.push(compression === 2 ? decompressPalmDoc(trimmed) : trimmed);
  }

  return Buffer.concat(records).subarray(0, 32768).toString("utf8");
}

export function validateAzw3Buffer(input: Buffer | Uint8Array | ArrayBuffer): Azw3ValidationResult {
  const buffer = asBuffer(input);
  const errors: string[] = [];
  const warnings: string[] = [];
  const metadata: Azw3ValidationMetadata = {
    fileSize: buffer.length,
    hasExth: false,
    hasFdst: false,
    hasFlis: false,
    hasFcis: false,
    hasDatp: false,
    hasIndx: false,
    hasSrcs: false,
    hasEof: false,
  };

  if (buffer.length < MIN_AZW3_SIZE) {
    errors.push(`Arquivo muito pequeno para AZW3/KF8 (${buffer.length} bytes).`);
  }

  metadata.pdbName = readAscii(buffer, 0, 32).replace(/\0+$/, "").trim();

  const databaseType = readAscii(buffer, 60, 4);
  const creator = readAscii(buffer, 64, 4);
  if (databaseType !== "BOOK" || creator !== "MOBI") {
    errors.push(`PalmDB invalido: esperado BOOK/MOBI, encontrado ${databaseType || "?"}/${creator || "?"}.`);
  }

  const recordCount = readUInt16BE(buffer, 76);
  metadata.recordCount = recordCount;
  if (recordCount < 4) {
    errors.push("Tabela PalmDB tem poucos registros para um AZW3/KF8 completo.");
  }

  const recordTableEnd = PDB_HEADER_LENGTH + recordCount * PDB_RECORD_ENTRY_LENGTH;
  if (recordTableEnd + 2 > buffer.length) {
    errors.push("Tabela de registros PalmDB truncada.");
    return { valid: false, errors, warnings, metadata };
  }

  const offsets: number[] = [];
  for (let index = 0; index < recordCount; index += 1) {
    const offset = readUInt32BE(buffer, PDB_HEADER_LENGTH + index * PDB_RECORD_ENTRY_LENGTH);
    offsets.push(offset);
    if (offset < recordTableEnd || offset >= buffer.length) {
      errors.push(`Registro PalmDB ${index} aponta para offset invalido (${offset}).`);
    }
    if (index > 0 && offset <= offsets[index - 1]) {
      errors.push(`Registro PalmDB ${index} nao esta em ordem crescente.`);
    }
  }

  const recordZeroOffset = offsets[0] || 0;
  const recordOneOffset = offsets[1] || buffer.length;
  if (recordOneOffset <= recordZeroOffset + MOBI_HEADER_OFFSET + 8) {
    errors.push("Registro zero PalmDOC/MOBI truncado.");
    return { valid: false, errors, warnings, metadata };
  }

  const mobiOffset = recordZeroOffset + MOBI_HEADER_OFFSET;
  if (readAscii(buffer, mobiOffset, 4) !== "MOBI") {
    errors.push("Registro zero nao contem cabecalho MOBI.");
    return { valid: false, errors, warnings, metadata };
  }

  const mobiHeaderLength = readUInt32BE(buffer, mobiOffset + 4);
  const mobiHeaderEnd = mobiOffset + mobiHeaderLength;
  metadata.mobiHeaderLength = mobiHeaderLength;
  if (mobiHeaderLength < 232 || mobiHeaderEnd > recordOneOffset) {
    errors.push(`Cabecalho MOBI invalido ou truncado (${mobiHeaderLength} bytes).`);
  }

  metadata.compression = readUInt16BE(buffer, recordZeroOffset);
  metadata.textLength = readUInt32BE(buffer, recordZeroOffset + 4);
  metadata.textRecordCount = readUInt16BE(buffer, recordZeroOffset + 8);
  metadata.mobiVersion = readUInt32BE(buffer, mobiOffset + 20);
  metadata.firstNonTextRecord = readUInt32BE(buffer, mobiOffset + 64);
  const fullNameOffset = readUInt32BE(buffer, mobiOffset + 68);
  const fullNameLength = readUInt32BE(buffer, mobiOffset + 72);
  const exthFlags = readUInt32BE(buffer, recordZeroOffset + 128);
  metadata.firstResourceRecord = readUInt32BE(buffer, mobiOffset + 92);
  metadata.extraDataFlags = readUInt32BE(buffer, mobiOffset + 224);
  metadata.ncxIndexRecord = readUInt32BE(buffer, mobiOffset + 228);
  metadata.fragmentIndexRecord = readUInt32BE(buffer, mobiOffset + 232);
  metadata.skeletonIndexRecord = readUInt32BE(buffer, mobiOffset + 236);
  metadata.datpRecord = readUInt32BE(buffer, mobiOffset + 240);

  if (metadata.mobiVersion !== MOBI_VERSION_KF8) {
    errors.push(`MOBI version ${metadata.mobiVersion || 0} encontrada; AZW3/KF8 precisa ser MOBI 8.`);
  }

  if (metadata.compression !== 1 && metadata.compression !== 2) {
    errors.push(`Compressao PalmDOC nao suportada (${metadata.compression || 0}).`);
  }

  if (!metadata.textRecordCount || metadata.textRecordCount < 1) {
    errors.push("AZW3 sem registros de texto.");
  }

  if (metadata.firstNonTextRecord && metadata.textRecordCount && metadata.firstNonTextRecord <= metadata.textRecordCount) {
    errors.push("Primeiro registro nao textual aponta para dentro do fluxo de texto.");
  }

  if (!metadata.firstNonTextRecord || metadata.firstNonTextRecord >= recordCount) {
    errors.push("Primeiro registro nao textual fora da tabela PalmDB.");
  }

  if (
    metadata.fragmentIndexRecord !== undefined &&
    metadata.fragmentIndexRecord !== 0xffffffff &&
    metadata.firstNonTextRecord !== metadata.fragmentIndexRecord
  ) {
    errors.push("Primeiro registro nao textual precisa apontar para o indice de fragmentos KF8.");
  }

  if (!metadata.firstResourceRecord || metadata.firstResourceRecord === 0xffffffff) {
    warnings.push("Primeiro registro de recurso nao declarado; Kindles reais podem classificar indices KF8 como recursos.");
  } else if (metadata.firstResourceRecord < (metadata.firstNonTextRecord || 0) || metadata.firstResourceRecord >= recordCount) {
    errors.push("Primeiro registro de recurso fora da faixa PalmDB.");
  }

  if (fullNameOffset > 0 && fullNameLength > 0 && recordZeroOffset + fullNameOffset + fullNameLength <= recordOneOffset) {
    metadata.fullName = buffer.subarray(recordZeroOffset + fullNameOffset, recordZeroOffset + fullNameOffset + fullNameLength).toString("utf8");
  } else {
    warnings.push("Nome completo do livro ausente ou fora do registro zero.");
  }

  if ((exthFlags & EXTH_PRESENT_FLAG) === 0) {
    errors.push("Cabecalho EXTH ausente; metadados Kindle nao foram gravados.");
  } else if (readAscii(buffer, mobiHeaderEnd, 4) === "EXTH") {
    metadata.hasExth = true;
    const exthLength = readUInt32BE(buffer, mobiHeaderEnd + 4);
    metadata.exthRecordCount = readUInt32BE(buffer, mobiHeaderEnd + 8);
    if (exthLength < 12 || mobiHeaderEnd + exthLength > recordOneOffset) {
      errors.push(`Cabecalho EXTH truncado (${exthLength} bytes).`);
    }
  } else {
    errors.push("Flag EXTH esta ativa, mas o registro EXTH nao foi encontrado apos o MOBI header.");
  }

  const nonTextStart = Math.min(Math.max(metadata.firstNonTextRecord || 1, 1), offsets.length);
  for (let index = nonTextStart; index < offsets.length; index += 1) {
    const record = recordSlice(buffer, offsets, index);
    metadata.hasFdst ||= startsWith(record, "FDST");
    metadata.hasFlis ||= startsWith(record, "FLIS");
    metadata.hasFcis ||= startsWith(record, "FCIS");
    metadata.hasDatp ||= startsWith(record, "DATP");
    metadata.hasIndx ||= startsWith(record, "INDX");
    metadata.hasSrcs ||= startsWith(record, "SRCS");
  }
  metadata.hasEof = hasEofMarker(buffer, offsets);

  if (!metadata.hasFdst) errors.push("Registro FDST ausente; fluxos KF8 nao foram declarados.");
  if (!metadata.hasFlis) errors.push("Registro FLIS ausente.");
  if (!metadata.hasFcis) errors.push("Registro FCIS ausente.");
  if (!metadata.hasDatp) warnings.push("Registro DATP ausente; alguns geradores AZW3 reais tambem omitem esse registro.");
  if (!metadata.hasIndx) errors.push("Registros INDX ausentes; indice KF8/NCX nao foi gravado.");
  if (!metadata.hasEof) errors.push("Marcador EOF MOBI ausente.");
  const textPreview = decodeTextPreviewFromRecords(
    buffer,
    offsets,
    metadata.textRecordCount || 0,
    metadata.compression || 1,
    metadata.extraDataFlags || 0,
  ).toLowerCase() || decodeTextPreview(buffer, offsets, metadata.firstNonTextRecord || 0).toLowerCase();
  if (!textPreview.includes("<html") || !textPreview.includes("<body")) {
    errors.push("Fluxo de texto KF8 nao contem XHTML legivel no inicio do livro.");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    metadata,
  };
}

export function validateAzw3File(filePath: string): Azw3ValidationResult {
  return validateAzw3Buffer(fs.readFileSync(filePath));
}

export function assertValidAzw3Buffer(input: Buffer | Uint8Array | ArrayBuffer): Azw3ValidationResult {
  const validation = validateAzw3Buffer(input);
  if (!validation.valid) {
    throw new Error(`AZW3 invalido: ${validation.errors.join("; ")}`);
  }
  return validation;
}

export function assertValidAzw3File(filePath: string): Azw3ValidationResult {
  const validation = validateAzw3File(filePath);
  if (!validation.valid) {
    throw new Error(`AZW3 invalido: ${validation.errors.join("; ")}`);
  }
  return validation;
}
