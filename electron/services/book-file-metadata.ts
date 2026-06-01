import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import AdmZip from "adm-zip";
import { PDFDocument } from "pdf-lib";

const require = createRequire(import.meta.url);
const execFileAsync = promisify(execFile);

export interface EditableBookMetadata {
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

export interface FileMetadataUpdateResult {
  success: boolean;
  warnings: string[];
  error?: string;
}

function cleanString(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function metadataValue(metadata: EditableBookMetadata, key: keyof EditableBookMetadata) {
  return cleanString(metadata[key]);
}

async function atomicWrite(filePath: string, data: Buffer | Uint8Array) {
  const tempPath = `${filePath}.lyceum-tmp`;
  await fs.promises.writeFile(tempPath, Buffer.from(data));
  await fs.promises.rename(tempPath, filePath);
}

async function updatePdfMetadata(filePath: string, metadata: EditableBookMetadata): Promise<FileMetadataUpdateResult> {
  const pdfDoc = await PDFDocument.load(fs.readFileSync(filePath), { ignoreEncryption: true });
  const title = metadataValue(metadata, "title");
  const author = metadataValue(metadata, "author");
  const subject = metadataValue(metadata, "subject") || metadataValue(metadata, "description");
  const keywords = [
    metadataValue(metadata, "isbn"),
    metadataValue(metadata, "identifier"),
    metadataValue(metadata, "asin"),
    metadataValue(metadata, "series"),
  ].filter(Boolean) as string[];

  if (title) pdfDoc.setTitle(title);
  if (author) pdfDoc.setAuthor(author);
  if (subject) pdfDoc.setSubject(subject);
  if (keywords.length > 0) pdfDoc.setKeywords(keywords);
  if (metadataValue(metadata, "publisher")) pdfDoc.setProducer(metadataValue(metadata, "publisher") || "");
  if (metadataValue(metadata, "publishDate")) {
    const parsedDate = new Date(metadataValue(metadata, "publishDate") || "");
    if (Number.isFinite(parsedDate.getTime())) pdfDoc.setCreationDate(parsedDate);
  }

  await atomicWrite(filePath, Buffer.from(await pdfDoc.save()));
  return {
    success: true,
    warnings: ["PDF nao possui campos nativos para todos os metadados; ISBN/ASIN/serie foram gravados como keywords quando presentes."],
  };
}

function readAttr(source: string, attr: string) {
  return source.match(new RegExp(`${attr}\\s*=\\s*["']([^"']+)["']`, "i"))?.[1];
}

function upsertDcTag(opf: string, tag: string, value: string | undefined) {
  const pattern = new RegExp(`<dc:${tag}\\b[^>]*>[\\s\\S]*?<\\/dc:${tag}>`, "i");
  if (!value) return opf.replace(pattern, "");
  const node = `<dc:${tag}>${escapeXml(value)}</dc:${tag}>`;
  if (pattern.test(opf)) return opf.replace(pattern, node);
  return opf.replace(/<metadata\b[^>]*>/i, (match) => `${match}\n    ${node}`);
}

function upsertMetaName(opf: string, name: string, value: string | undefined) {
  const pattern = new RegExp(`<meta\\b(?=[^>]*\\bname\\s*=\\s*["']${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'])[^>]*\\/?>`, "i");
  if (!value) return opf.replace(pattern, "");
  const node = `<meta name="${escapeXml(name)}" content="${escapeXml(value)}" />`;
  if (pattern.test(opf)) return opf.replace(pattern, node);
  return opf.replace(/<\/metadata>/i, `    ${node}\n  </metadata>`);
}

async function updateEpubMetadata(filePath: string, metadata: EditableBookMetadata): Promise<FileMetadataUpdateResult> {
  const zip = new AdmZip(filePath);
  const entries = zip.getEntries();
  const container = entries.find((entry) => entry.entryName === "META-INF/container.xml");
  const rootFile = container?.getData().toString("utf8").match(/full-path=["']([^"']+)["']/)?.[1];
  const opfEntry = entries.find((entry) => entry.entryName === rootFile || entry.entryName.toLowerCase().endsWith(".opf"));
  if (!opfEntry) return { success: false, warnings: [], error: "OPF do EPUB nao encontrado." };

  let opf = opfEntry.getData().toString("utf8");
  opf = upsertDcTag(opf, "title", metadataValue(metadata, "title"));
  opf = upsertDcTag(opf, "creator", metadataValue(metadata, "author"));
  opf = upsertDcTag(opf, "description", metadataValue(metadata, "description"));
  opf = upsertDcTag(opf, "publisher", metadataValue(metadata, "publisher"));
  opf = upsertDcTag(opf, "date", metadataValue(metadata, "publishDate"));
  opf = upsertDcTag(opf, "language", metadataValue(metadata, "language"));
  opf = upsertDcTag(opf, "subject", metadataValue(metadata, "subject") || metadataValue(metadata, "isbn"));
  opf = upsertDcTag(opf, "identifier", metadataValue(metadata, "identifier") || metadataValue(metadata, "isbn"));
  opf = upsertMetaName(opf, "amazon:asin", metadataValue(metadata, "asin"));
  opf = upsertMetaName(opf, "calibre:series", metadataValue(metadata, "series"));
  opf = upsertMetaName(opf, "calibre:series_index", metadataValue(metadata, "seriesIndex"));
  opf = upsertMetaName(opf, "calibre:author_sort", metadataValue(metadata, "authorSort"));
  opf = upsertMetaName(opf, "calibre:title_sort", metadataValue(metadata, "titleSort"));
  zip.updateFile(opfEntry.entryName, Buffer.from(opf, "utf8"));
  await fs.promises.writeFile(filePath, zip.toBuffer());
  return { success: true, warnings: [] };
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

function rebuildRecordZeroWithExth(recordZero: Buffer, metadata: EditableBookMetadata, coverOffset?: number, thumbnailOffset?: number) {
  const parsed = parseExth(recordZero);
  const replaceTypes = new Set([100, 101, 103, 104, 105, 106, 112, 113, 114, 115, 118, 119, 201, 202, 503, 524]);
  const kept = parsed.records.filter((record) => !replaceTypes.has(record.type));
  const identifier = metadataValue(metadata, "identifier") || metadataValue(metadata, "isbn");
  const asin = metadataValue(metadata, "asin") || identifier;
  const nextRecords = [
    ...kept,
    exthStringRecord(100, metadataValue(metadata, "author")),
    exthStringRecord(101, metadataValue(metadata, "publisher")),
    exthStringRecord(103, metadataValue(metadata, "description")),
    exthStringRecord(104, identifier),
    exthStringRecord(105, metadataValue(metadata, "subject") || metadataValue(metadata, "isbn")),
    exthStringRecord(106, metadataValue(metadata, "publishDate")),
    exthStringRecord(112, asin),
    exthStringRecord(113, asin),
    exthStringRecord(114, metadataValue(metadata, "series")),
    exthStringRecord(115, metadataValue(metadata, "seriesIndex")),
    exthStringRecord(118, metadataValue(metadata, "authorSort")),
    exthStringRecord(119, metadataValue(metadata, "titleSort")),
    exthUIntRecord(201, coverOffset),
    exthUIntRecord(202, thumbnailOffset),
    exthStringRecord(503, metadataValue(metadata, "title")),
    exthStringRecord(524, metadataValue(metadata, "language")),
  ].filter((record): record is { type: number; payload: Buffer } => Boolean(record));
  const exth = buildExth(nextRecords.sort((a, b) => a.type - b.type));
  const fullName = Buffer.from(metadataValue(metadata, "title") || "Untitled", "utf8");
  const prefix = Buffer.from(recordZero.subarray(0, parsed.exthOffset));
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
  const entries = zip.getEntries();
  const container = entries.find((entry) => entry.entryName === "META-INF/container.xml");
  const rootFile = container?.getData().toString("utf8").match(/full-path=["']([^"']+)["']/)?.[1];
  const opfEntry = entries.find((entry) => entry.entryName === rootFile || entry.entryName.toLowerCase().endsWith(".opf"));
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
  opf = upsertMetaName(opf, "cover", "lyceum-cover-image");
  zip.updateFile(opfEntry.entryName, Buffer.from(opf, "utf8"));
  await fs.promises.writeFile(filePath, zip.toBuffer());
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
  const candidates = [
    process.env.LYCEUM_KFXLIB_PATH,
    process.env.LYCEUM_KFX_OUTPUT_PLUGIN,
    path.join(process.cwd(), ".tmp", "calibre-kfx-output"),
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
  if (type === "kfx") return runKfxBridge(filePath, metadata);
  return { success: false, warnings: [], error: `Edicao de metadados nao suportada para ${type.toUpperCase()}.` };
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
