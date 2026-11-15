import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import AdmZip from "adm-zip";
import { PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import {
  buildXmpPacket,
  clean,
  compactMetadata,
  readComicInfo,
  readOpfMetadata,
  readAttr,
  readXmpMetadata,
  sanitizePdfFields,
  normalizeIsbn,
  splitAuthors,
  splitSubjects,
  writeComicInfo,
  writeOpfMetadata,
  type BookFileMetadataFields,
} from "./book-metadata-formats";

const require = createRequire(import.meta.url);
const execFileAsync = promisify(execFile);

export type EditableBookMetadata = BookFileMetadataFields;

export interface FileMetadataUpdateResult {
  success: boolean;
  warnings: string[];
  error?: string;
}

function metadataValue(metadata: EditableBookMetadata, key: keyof EditableBookMetadata) {
  return clean(metadata[key]);
}

async function atomicWrite(filePath: string, data: Buffer | Uint8Array) {
  const tempPath = `${filePath}.lyceum-tmp`;
  try {
    await fs.promises.writeFile(tempPath, Buffer.from(data));
    await fs.promises.rename(tempPath, filePath);
  } catch (error) {
    await fs.promises.rm(tempPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

function readPdfXmp(pdfDoc: PDFDocument): string | undefined {
  try {
    const metadata = pdfDoc.catalog.lookup(PDFName.of("Metadata"));
    if (metadata instanceof PDFRawStream) return Buffer.from(decodePDFRawStream(metadata).decode()).toString("utf8");
  } catch {
    // A broken XMP stream is ignored: the Info dictionary is still usable.
  }
  return undefined;
}

function readPdfInfo(pdfDoc: PDFDocument) {
  const safe = (read: () => string | undefined) => {
    try {
      return clean(read());
    } catch {
      return undefined;
    }
  };
  return {
    title: safe(() => pdfDoc.getTitle()),
    author: safe(() => pdfDoc.getAuthor()),
    description: safe(() => pdfDoc.getSubject()),
    subject: safe(() => pdfDoc.getKeywords()),
    producer: safe(() => pdfDoc.getProducer()),
    creator: safe(() => pdfDoc.getCreator()),
  };
}

async function updatePdfMetadata(filePath: string, metadata: EditableBookMetadata): Promise<FileMetadataUpdateResult> {
  const pdfDoc = await PDFDocument.load(await fs.promises.readFile(filePath), { ignoreEncryption: true, updateMetadata: false });
  if (pdfDoc.isEncrypted) {
    return { success: false, warnings: [], error: "PDF protegido por senha: os metadados nao podem ser gravados no arquivo." };
  }

  const title = metadataValue(metadata, "title");
  const author = metadataValue(metadata, "author");
  const description = metadataValue(metadata, "description");
  const subjects = splitSubjects(metadata.subject);
  const language = metadataValue(metadata, "language");
  const previousXmp = readPdfXmp(pdfDoc);
  const previous = previousXmp ? readXmpMetadata(previousXmp) : {};
  const info = readPdfInfo(pdfDoc);

  // Standard Info dictionary: read by every PDF viewer.
  if (title) pdfDoc.setTitle(title, { showInWindowTitleBar: true });
  if (author) pdfDoc.setAuthor(author);
  if (description) pdfDoc.setSubject(description);
  if (subjects.length > 0) pdfDoc.setKeywords(subjects);
  if (language) pdfDoc.setLanguage(language);
  pdfDoc.setModificationDate(new Date());

  // XMP packet: carries the fields the Info dictionary has no slot for
  // (publisher, ISBN, series, sort keys...).
  const xmp = buildXmpPacket({
    ...metadata,
    producer: info.producer,
    creatorTool: info.creator,
    pdfaPart: previous.pdfaPart,
    pdfaConformance: previous.pdfaConformance,
  });
  // XMP must be UTF-8: pdf-lib would encode a JS string as Latin-1.
  const stream = pdfDoc.context.stream(new Uint8Array(Buffer.from(xmp, "utf8")), { Type: "Metadata", Subtype: "XML" });
  pdfDoc.catalog.set(PDFName.of("Metadata"), pdfDoc.context.register(stream));

  await atomicWrite(filePath, await pdfDoc.save({ useObjectStreams: false }));
  return { success: true, warnings: [] };
}

function findOpfEntry(zip: AdmZip) {
  const entries = zip.getEntries();
  const container = entries.find((entry) => entry.entryName === "META-INF/container.xml");
  const rootFile = container?.getData().toString("utf8").match(/full-path\s*=\s*["']([^"']+)["']/)?.[1];
  return entries.find((entry) => entry.entryName === rootFile)
    || entries.find((entry) => entry.entryName.toLowerCase().endsWith(".opf"));
}

async function updateEpubMetadata(filePath: string, metadata: EditableBookMetadata): Promise<FileMetadataUpdateResult> {
  const zip = new AdmZip(filePath);
  const opfEntry = findOpfEntry(zip);
  if (!opfEntry) return { success: false, warnings: [], error: "OPF do EPUB nao encontrado." };

  const opf = writeOpfMetadata(opfEntry.getData().toString("utf8"), metadata);
  zip.updateFile(opfEntry.entryName, Buffer.from(opf, "utf8"));
  await atomicWrite(filePath, zip.toBuffer());
  return { success: true, warnings: [] };
}

function findComicInfoEntry(zip: AdmZip) {
  return zip.getEntries().find((entry) => !entry.entryName.endsWith("/") && entry.entryName.toLowerCase() === "comicinfo.xml")
    || zip.getEntries().find((entry) => !entry.entryName.endsWith("/") && path.posix.basename(entry.entryName).toLowerCase() === "comicinfo.xml");
}

async function updateCbzMetadata(filePath: string, metadata: EditableBookMetadata): Promise<FileMetadataUpdateResult> {
  const zip = new AdmZip(filePath);
  const entry = findComicInfoEntry(zip);
  const xml = writeComicInfo(entry?.getData().toString("utf8"), metadata);
  if (entry) zip.updateFile(entry.entryName, Buffer.from(xml, "utf8"));
  else zip.addFile("ComicInfo.xml", Buffer.from(xml, "utf8"));
  await atomicWrite(filePath, zip.toBuffer());
  const unsupported = [metadataValue(metadata, "identifier") && "identificador", metadataValue(metadata, "asin") && "ASIN"].filter(Boolean);
  return {
    success: true,
    warnings: unsupported.length ? [`ComicInfo.xml nao possui campo para ${unsupported.join(" e ")}; mantido apenas na biblioteca.`] : [],
  };
}

interface PalmDbData {
  buffer: Buffer;
  records: Buffer[];
  attributes: number[];
}

function readPalmDb(filePath: string): PalmDbData {
  const buffer = fs.readFileSync(filePath);
  const recordCount = buffer.readUInt16BE(76);
  const offsets = Array.from({ length: recordCount }, (_, index) => buffer.readUInt32BE(78 + index * 8));
  const attributes = Array.from({ length: recordCount }, (_, index) => buffer.readUInt32BE(82 + index * 8));
  const records = offsets.map((offset, index) => {
    const nextOffset = index + 1 < offsets.length ? offsets[index + 1] : buffer.length;
    return buffer.subarray(offset, nextOffset);
  });
  return { buffer, records, attributes };
}

function buildPalmDb(original: PalmDbData, records: Buffer[], attributes: number[]) {
  const headerLength = 78 + records.length * 8;
  const header = Buffer.alloc(headerLength);
  original.buffer.copy(header, 0, 0, 78);
  header.writeUInt16BE(records.length, 76);

  let offset = headerLength;
  for (let index = 0; index < records.length; index += 1) {
    header.writeUInt32BE(offset, 78 + index * 8);
    header.writeUInt32BE(attributes[index] ?? index, 82 + index * 8);
    offset += records[index].length;
  }

  return Buffer.concat([header, ...records]);
}

function parseExth(recordZero: Buffer) {
  const mobiOffset = 16;
  const mobiHeaderLength = recordZero.readUInt32BE(mobiOffset + 4);
  const exthOffset = mobiOffset + mobiHeaderLength;
  if (recordZero.subarray(exthOffset, exthOffset + 4).toString("ascii") !== "EXTH") {
    throw new Error("EXTH nao encontrado no AZW3.");
  }
  const exthLength = recordZero.readUInt32BE(exthOffset + 4);
  const records: Array<{ type: number; payload: Buffer }> = [];
  let cursor = exthOffset + 12;
  const end = exthOffset + exthLength;
  while (cursor + 8 <= end) {
    const type = recordZero.readUInt32BE(cursor);
    const length = recordZero.readUInt32BE(cursor + 4);
    if (length < 8 || cursor + length > end) break;
    records.push({ type, payload: Buffer.from(recordZero.subarray(cursor + 8, cursor + length)) });
    cursor += length;
  }
  return { mobiOffset, exthOffset, exthLength, records };
}

function readMobiFullName(recordZero: Buffer) {
  try {
    const offset = recordZero.readUInt32BE(16 + 68);
    const length = recordZero.readUInt32BE(16 + 72);
    if (!length || offset + length > recordZero.length) return undefined;
    return clean(recordZero.subarray(offset, offset + length).toString("utf8"));
  } catch {
    return undefined;
  }
}

function readAzw3Metadata(filePath: string): EditableBookMetadata {
  const recordZero = readPalmDb(filePath).records[0];
  const { records } = parseExth(recordZero);
  const strings = (type: number) => records
    .filter((record) => record.type === type)
    .map((record) => clean(record.payload.toString("utf8")))
    .filter((value): value is string => Boolean(value));
  const first = (type: number) => strings(type)[0];
  const authors = strings(100);
  const subjects = strings(105);
  return {
    title: first(503) || readMobiFullName(recordZero),
    author: authors.length ? authors.join(" & ") : undefined,
    publisher: first(101),
    description: first(103),
    isbn: normalizeIsbn(first(104)) || first(104),
    subject: subjects.length ? subjects.join(", ") : undefined,
    publishDate: first(106),
    identifier: first(112),
    asin: first(113) || first(504),
    language: first(524),
  };
}

function exthStringRecord(type: number, value: string | undefined) {
  return value ? { type, payload: Buffer.from(value, "utf8") } : null;
}

function exthUIntRecord(type: number, value: number | undefined) {
  if (value === undefined || value < 0) return null;
  const payload = Buffer.alloc(4);
  payload.writeUInt32BE(value, 0);
  return { type, payload };
}

function buildExth(records: Array<{ type: number; payload: Buffer }>) {
  const body = Buffer.concat(records.map((record) => {
    const header = Buffer.alloc(8);
    header.writeUInt32BE(record.type, 0);
    header.writeUInt32BE(record.payload.length + 8, 4);
    return Buffer.concat([header, record.payload]);
  }));
  const length = 12 + body.length;
  const padding = (4 - (length % 4)) % 4;
  const header = Buffer.alloc(12);
  header.write("EXTH", 0, "ascii");
  header.writeUInt32BE(length + padding, 4);
  header.writeUInt32BE(records.length, 8);
  return Buffer.concat([header, body, Buffer.alloc(padding)]);
}

/**
 * Fixes MOBI header fields older Lyceum builds wrote wrongly: an orthographic
 * index of 0 (makes the Kindle treat the book as a dictionary) and a DRM count
 * of 0xFFFFFFFF.
 */
function repairOldLyceumHeader(header: Buffer, mobiOffset: number) {
  const NULL_INDEX = 0xffffffff;
  if (header.length >= mobiOffset + 28 && header.readUInt32BE(mobiOffset + 24) === 0) {
    header.writeUInt32BE(NULL_INDEX, mobiOffset + 24);
  }
  if (header.length >= mobiOffset + 160 && header.readUInt32BE(mobiOffset + 156) === NULL_INDEX) {
    header.writeUInt32BE(0, mobiOffset + 156);
  }
}

function rebuildRecordZeroWithExth(recordZero: Buffer, metadata: EditableBookMetadata, coverOffset?: number, thumbnailOffset?: number) {
  const parsed = parseExth(recordZero);
  // EXTH record types (MobileRead wiki): 100 author, 101 publisher, 103 description,
  // 104 ISBN, 105 subject (repeatable), 106 publishing date, 112 source identifier,
  // 113/504 ASIN, 201/202 cover/thumbnail offsets, 503 updated title, 524 language.
  const replaceTypes = new Set([100, 101, 103, 104, 105, 106, 112, 113, 201, 202, 503, 504, 524]);
  // Older Lyceum builds wrote these types with the wrong meaning (115 = sample
  // flag, 118/119 = price, 110/111/114 ...), which breaks opening on Kindle.
  const writtenByOldLyceum = parsed.records.some((record) => record.type === 112 && record.payload.toString("utf8") === "lyceum");
  const legacyMisusedTypes = new Set([102, 107, 110, 111, 114, 115, 118, 119, 121]);
  const kept = parsed.records.filter((record) => (
    !replaceTypes.has(record.type) && !(writtenByOldLyceum && legacyMisusedTypes.has(record.type))
  ));
  const previous = (type: number) => parsed.records.filter((record) => record.type === type);
  const keepOffset = (type: number, value: number | undefined) =>
    value !== undefined ? [exthUIntRecord(type, value)] : previous(type);
  const asin = metadataValue(metadata, "asin");
  const isbn = normalizeIsbn(metadata.isbn) || metadataValue(metadata, "isbn");
  const nextRecords = [
    ...kept,
    ...splitAuthors(metadata.author).map((author) => exthStringRecord(100, author)),
    exthStringRecord(101, metadataValue(metadata, "publisher")),
    exthStringRecord(103, metadataValue(metadata, "description")),
    exthStringRecord(104, isbn),
    ...splitSubjects(metadata.subject).map((subject) => exthStringRecord(105, subject)),
    exthStringRecord(106, metadataValue(metadata, "publishDate")),
    exthStringRecord(112, metadataValue(metadata, "identifier")),
    exthStringRecord(113, asin),
    exthStringRecord(504, asin),
    ...keepOffset(201, coverOffset),
    ...keepOffset(202, thumbnailOffset),
    exthStringRecord(503, metadataValue(metadata, "title")),
    exthStringRecord(524, metadataValue(metadata, "language")),
  ].filter((record): record is { type: number; payload: Buffer } => Boolean(record));
  const exth = buildExth(nextRecords.sort((a, b) => a.type - b.type));
  const fullName = Buffer.from(metadataValue(metadata, "title") || readMobiFullName(recordZero) || "Untitled", "utf8");
  const prefix = Buffer.from(recordZero.subarray(0, parsed.exthOffset));
  if (writtenByOldLyceum) repairOldLyceumHeader(prefix, parsed.mobiOffset);
  const rebuilt = Buffer.concat([prefix, exth, fullName, Buffer.from([0, 0])]);
  const padded = Buffer.concat([rebuilt, Buffer.alloc((4 - (rebuilt.length % 4)) % 4)]);
  padded.writeUInt32BE(parsed.exthOffset + exth.length, parsed.mobiOffset + 68);
  padded.writeUInt32BE(fullName.length, parsed.mobiOffset + 72);
  return padded;
}

async function updateAzw3Metadata(filePath: string, metadata: EditableBookMetadata): Promise<FileMetadataUpdateResult> {
  const palm = readPalmDb(filePath);
  const records = [...palm.records];
  records[0] = rebuildRecordZeroWithExth(records[0], metadata);
  await atomicWrite(filePath, buildPalmDb(palm, records, palm.attributes));
  return { success: true, warnings: [] };
}

async function imageToJpegBuffer(imagePath: string, width: number) {
  const sharp = require("sharp");
  return sharp(imagePath)
    .resize(width, undefined, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 88 })
    .toBuffer();
}

export async function writeThumbnailFile(imagePath: string, outputPath: string) {
  const sharp = require("sharp");
  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
  await sharp(imagePath)
    .resize(300, undefined, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 85 })
    .toFile(outputPath);
}

export async function writeCoverImageFile(imagePath: string, outputPath: string) {
  const sharp = require("sharp");
  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
  await sharp(imagePath)
    .rotate()
    .resize(1800, 2400, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 90 })
    .toFile(outputPath);
}

async function setEpubCover(filePath: string, imagePath: string, metadata: EditableBookMetadata): Promise<FileMetadataUpdateResult> {
  const zip = new AdmZip(filePath);
  const opfEntry = findOpfEntry(zip);
  if (!opfEntry) return { success: false, warnings: [], error: "OPF do EPUB nao encontrado." };
  const opfDir = path.posix.dirname(opfEntry.entryName);
  const imageExt = path.extname(imagePath).toLowerCase() === ".png" ? ".png" : ".jpg";
  const mediaType = imageExt === ".png" ? "image/png" : "image/jpeg";
  const coverHref = `images/lyceum-cover${imageExt}`;
  const coverPath = path.posix.join(opfDir === "." ? "" : opfDir, coverHref);
  const imageData = fs.readFileSync(imagePath);
  let opf = opfEntry.getData().toString("utf8");
  const items = Array.from(opf.matchAll(/<item\b([^>]+)>/gi));
  const existing = items.find((item) => (readAttr(item[1], "properties") || "").split(/\s+/).includes("cover-image"));
  if (existing) {
    const href = readAttr(existing[1], "href");
    if (href) zip.updateFile(path.posix.join(opfDir, href), imageData);
  } else {
    zip.addFile(coverPath, imageData);
    opf = opf.replace(/<\/manifest>/i, `    <item id="lyceum-cover-image" href="${coverHref}" media-type="${mediaType}" properties="cover-image" />\n  </manifest>`);
  }
  if (!existing) {
    const coverMeta = /<meta\b(?=[^>]*\bname\s*=\s*["']cover["'])[^>]*\/?>/i;
    const node = `<meta name="cover" content="lyceum-cover-image"/>`;
    opf = coverMeta.test(opf) ? opf.replace(coverMeta, node) : opf.replace(/<\/((?:opf:)?metadata)>/i, `  ${node}\n  </$1>`);
  }
  zip.updateFile(opfEntry.entryName, Buffer.from(opf, "utf8"));
  await atomicWrite(filePath, zip.toBuffer());
  await updateEpubMetadata(filePath, metadata);
  return { success: true, warnings: [] };
}

async function setAzw3Cover(filePath: string, imagePath: string, metadata: EditableBookMetadata): Promise<FileMetadataUpdateResult> {
  const palm = readPalmDb(filePath);
  const cover = await imageToJpegBuffer(imagePath, 1600);
  const thumbnail = await imageToJpegBuffer(imagePath, 300);
  const records = [...palm.records];
  const attributes = [...palm.attributes];
  const recordZero = records[0];
  const insertIndex = Math.max(1, recordZero.readUInt32BE(16 + 92) || recordZero.readUInt16BE(8) + 1);
  records.splice(insertIndex, 0, cover, thumbnail);
  attributes.splice(insertIndex, 0, 0, 0);

  const updatedZero = Buffer.from(recordZero);
  const adjustField = (relativeOffset: number) => {
    const absoluteOffset = 16 + relativeOffset;
    const value = updatedZero.readUInt32BE(absoluteOffset);
    if (value !== 0xffffffff && value >= insertIndex) updatedZero.writeUInt32BE(value + 2, absoluteOffset);
  };
  [184, 192, 208, 228, 232, 236, 240].forEach(adjustField);
  updatedZero.writeUInt32BE(insertIndex, 16 + 92);
  records[0] = rebuildRecordZeroWithExth(updatedZero, metadata, 0, 1);
  await atomicWrite(filePath, buildPalmDb(palm, records, attributes));
  return { success: true, warnings: [] };
}

function findKfxlibRoot() {
  const appRoot = process.env.APP_ROOT;
  const candidates = [
    process.env.LYCEUM_KFXLIB_PATH,
    process.env.LYCEUM_KFX_OUTPUT_PLUGIN,
    appRoot && !appRoot.includes("app.asar")
      ? path.join(appRoot, ".tmp", "calibre-kfx-output")
      : undefined,
  ].filter((candidate): candidate is string => Boolean(candidate));
  return candidates.map((candidate) => path.resolve(candidate)).find((candidate) =>
    fs.existsSync(path.join(candidate, "kfxlib", "yj_book.py")),
  );
}

async function runKfxBridge(filePath: string, metadata: EditableBookMetadata, imagePath?: string): Promise<FileMetadataUpdateResult> {
  const kfxlibRoot = findKfxlibRoot();
  if (!kfxlibRoot) {
    return { success: false, warnings: [], error: "kfxlib nao encontrado para editar KFX. Defina LYCEUM_KFXLIB_PATH." };
  }
  const workspace = await fs.promises.mkdtemp(path.join(os.tmpdir(), "lyceum-kfx-edit-"));
  const outputPath = path.join(workspace, "book.kfx");
  const scriptPath = path.join(workspace, "edit-kfx.py");
  const script = String.raw`
import json, sys, types, traceback
payload = json.loads(sys.argv[1])
calibre = types.ModuleType("calibre")
constants = types.ModuleType("calibre.constants")
constants.config_dir = payload["configDir"]
sys.modules.setdefault("calibre", calibre)
sys.modules["calibre.constants"] = constants
sys.path.insert(0, payload["kfxlibRoot"])
from kfxlib import YJ_Book, YJ_Metadata, file_write_binary
def author_sort(value): return value
try:
    meta = payload.get("metadata") or {}
    md = YJ_Metadata(author_sort_fn=author_sort, replace_existing_authors_with_sort=True)
    md.title = meta.get("title") or None
    md.authors = [meta.get("author")] if meta.get("author") else []
    md.asin = meta.get("asin") or meta.get("identifier") or True
    md.cde_content_type = "EBOK"
    md.description = meta.get("description") or None
    md.language = meta.get("language") or None
    md.publisher = meta.get("publisher") or None
    md.issue_date = meta.get("publishDate") or None
    if payload.get("imagePath"):
        with open(payload["imagePath"], "rb") as image:
            md.cover_image_data = ("jpeg", image.read())
    book = YJ_Book(payload["inputPath"])
    book.decode_book(set_metadata=md)
    file_write_binary(payload["outputPath"], book.convert_to_single_kfx())
    print(json.dumps({"success": True}))
except Exception as exc:
    print(json.dumps({"success": False, "error": str(exc), "traceback": traceback.format_exc()}))
    sys.exit(1)
`;
  await fs.promises.writeFile(scriptPath, script, "utf8");
  const payload = {
    inputPath: filePath,
    outputPath,
    configDir: path.join(workspace, "config"),
    kfxlibRoot,
    metadata,
    imagePath,
  };
  await fs.promises.mkdir(payload.configDir, { recursive: true });
  const command = process.env.LYCEUM_PYTHON || "python";
  const { stdout, stderr } = await execFileAsync(command, [scriptPath, JSON.stringify(payload)], {
    timeout: 10 * 60 * 1000,
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
  });
  const failed = stdout.split(/\r?\n/).find((line) => line.includes('"success": false'));
  if (failed) return { success: false, warnings: [stderr].filter(Boolean), error: failed };
  await atomicWrite(filePath, fs.readFileSync(outputPath));
  return {
    success: true,
    warnings: [stdout, stderr].join("\n").split(/\r?\n/).filter((line) => line.trim() && !line.includes('"success": true')),
  };
}

export async function writeBookMetadataToFile(
  filePath: string,
  fileType: string | null | undefined,
  metadata: EditableBookMetadata,
): Promise<FileMetadataUpdateResult> {
  const type = (fileType || path.extname(filePath).slice(1)).toLowerCase();
  if (type === "pdf") return updatePdfMetadata(filePath, metadata);
  if (type === "epub") return updateEpubMetadata(filePath, metadata);
  if (type === "azw3") return updateAzw3Metadata(filePath, metadata);
  if (type === "cbz") return updateCbzMetadata(filePath, metadata);
  if (type === "kfx") return runKfxBridge(filePath, metadata);
  return { success: false, warnings: [], error: `Edicao de metadados nao suportada para ${type.toUpperCase()}.` };
}

function epubFieldsFromFile(filePath: string): EditableBookMetadata {
  const opfEntry = findOpfEntry(new AdmZip(filePath));
  return opfEntry ? readOpfMetadata(opfEntry.getData().toString("utf8")) : {};
}

function cbzFieldsFromFile(filePath: string): EditableBookMetadata {
  const entry = findComicInfoEntry(new AdmZip(filePath));
  return entry ? readComicInfo(entry.getData().toString("utf8")) : {};
}

async function pdfFieldsFromFile(filePath: string): Promise<EditableBookMetadata> {
  const pdfDoc = await PDFDocument.load(await fs.promises.readFile(filePath), { ignoreEncryption: true, updateMetadata: false });
  const info = readPdfInfo(pdfDoc);
  const xmp = readPdfXmp(pdfDoc);
  const fromXmp = xmp ? compactMetadata(readXmpMetadata(xmp)) : {};
  delete (fromXmp as { pdfaPart?: string }).pdfaPart;
  delete (fromXmp as { pdfaConformance?: string }).pdfaConformance;
  // The Info dictionary is what viewers edit most often, so it wins over XMP.
  return sanitizePdfFields({
    ...fromXmp,
    ...compactMetadata({
      title: info.title,
      author: info.author,
      description: info.description,
      subject: info.subject,
    }),
  });
}

/**
 * Reads every metadata field embedded in a book file. Missing fields are
 * omitted (never blank) so callers can merge the result over stored values.
 */
export async function readBookMetadataFromFile(
  filePath: string,
  fileType: string | null | undefined,
): Promise<EditableBookMetadata> {
  const type = (fileType || path.extname(filePath).slice(1)).toLowerCase();
  try {
    if (type === "pdf") return compactMetadata(await pdfFieldsFromFile(filePath));
    if (type === "epub") return compactMetadata(epubFieldsFromFile(filePath));
    if (type === "cbz") return compactMetadata(cbzFieldsFromFile(filePath));
    if (type === "azw3") return compactMetadata(readAzw3Metadata(filePath));
  } catch (error) {
    console.warn(`[BookFileMetadata] Could not read embedded metadata from ${path.basename(filePath)}:`, error);
  }
  return {};
}

export async function setBookCoverInFile(
  filePath: string,
  fileType: string | null | undefined,
  imagePath: string,
  metadata: EditableBookMetadata,
): Promise<FileMetadataUpdateResult> {
  const type = (fileType || path.extname(filePath).slice(1)).toLowerCase();
  if (type === "epub") return setEpubCover(filePath, imagePath, metadata);
  if (type === "azw3") return setAzw3Cover(filePath, imagePath, metadata);
  if (type === "kfx") {
    const jpegPath = path.join(await fs.promises.mkdtemp(path.join(os.tmpdir(), "lyceum-kfx-cover-")), "cover.jpg");
    await fs.promises.writeFile(jpegPath, await imageToJpegBuffer(imagePath, 1600));
    return runKfxBridge(filePath, metadata, jpegPath);
  }
  return { success: false, warnings: [], error: `Capa embutida nao suportada para ${type.toUpperCase()}.` };
}
