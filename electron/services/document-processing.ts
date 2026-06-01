import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import AdmZip from "adm-zip";
import { PDFDocument } from "pdf-lib";
import { extractFirstCbzImage, inspectCbzPageCount, parseCbzBuffer } from "../../src/lib/lyceum/importers/cbzImporter";

const require = createRequire(import.meta.url);

export const THUMBNAIL_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
export const THUMB_WIDTH = 300;

export type BookFileType = "pdf" | "epub" | "cbz" | "azw3" | "kfx";

export interface PdfMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
  creationDate?: string;
  modificationDate?: string;
}

export interface EpubMetadata {
  title?: string;
  author?: string;
  producer?: string;
  creationDate?: string;
}

export interface GenerateThumbnailOptions {
  thumbnailsDir: string;
  force?: boolean;
  fileType?: BookFileType;
  logPrefix?: string;
}

export function formatPdfDate(pdfDate: string | undefined): string | undefined {
  if (!pdfDate) return undefined;

  const match = pdfDate.match(/D:(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?/);
  if (!match) {
    return pdfDate;
  }

  const year = match[1];
  const month = match[2] || "01";
  const day = match[3] || "01";
  const hour = match[4] || "00";
  const minute = match[5] || "00";
  const second = match[6] || "00";
  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}

export async function extractPdfMetadata(
  filePath: string,
  logPrefix = "[DocumentProcessing]",
): Promise<PdfMetadata | null> {
  try {
    const pdfBytes = fs.readFileSync(filePath);
    const pdfDoc = await PDFDocument.load(pdfBytes, {
      ignoreEncryption: true,
    });

    const metadata: PdfMetadata = {};

    try {
      const catalog = pdfDoc.catalog as unknown as { get?: (key: string) => unknown } | undefined;
      if (catalog) {
        const infoRef = catalog.get?.("Info");
        if (infoRef) {
          const info = infoRef as { [key: string]: unknown };
          const getStr = (key: string): string | undefined => {
            try {
              const val = info[key];
              return typeof val?.toString === "function" ? val.toString() : undefined;
            } catch {
              return undefined;
            }
          };

          metadata.title = getStr("Title");
          metadata.author = getStr("Author");
          metadata.subject = getStr("Subject");
          metadata.keywords = getStr("Keywords");
          metadata.creator = getStr("Creator");
          metadata.producer = getStr("Producer");

          const creationDate = getStr("CreationDate");
          const modDate = getStr("ModDate");
          if (creationDate) metadata.creationDate = formatPdfDate(creationDate);
          if (modDate) metadata.modificationDate = formatPdfDate(modDate);
        }
      }
    } catch (error) {
      console.error(`${logPrefix} Catalog metadata extraction failed:`, error);
    }

    return metadata;
  } catch (error) {
    console.error(`${logPrefix} Metadata extraction error:`, error);
    return null;
  }
}

export async function getPdfPageCount(
  filePath: string,
  logPrefix = "[DocumentProcessing]",
): Promise<number> {
  try {
    const pdfBytes = fs.readFileSync(filePath);
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    return pdfDoc.getPageCount();
  } catch (error) {
    console.error(`${logPrefix} Error getting PDF page count:`, error);
    return 1;
  }
}

export async function getEpubChapterCount(
  filePath: string,
  logPrefix = "[DocumentProcessing]",
): Promise<number> {
  try {
    const zip = new AdmZip(filePath);
    const entries = zip.getEntries();
    const htmlEntries = entries.filter((entry: any) => {
      const name = entry.entryName.toLowerCase();
      return name.endsWith(".html") || name.endsWith(".xhtml") || name.endsWith(".htm");
    });
    return Math.max(htmlEntries.length, 1);
  } catch (error) {
    console.error(`${logPrefix} Error getting EPUB chapter count:`, error);
    return 1;
  }
}

export async function getCbzPageCount(
  filePath: string,
  logPrefix = "[DocumentProcessing]",
): Promise<number> {
  try {
    return Math.max(await inspectCbzPageCount(filePath), 1);
  } catch (error) {
    console.error(`${logPrefix} Error getting CBZ page count:`, error);
    return 1;
  }
}

export async function validateCbzFile(
  filePath: string,
): Promise<{ pageCount: number }> {
  try {
    const parsed = await parseCbzBuffer(await fs.promises.readFile(filePath));
    const pageCount = parsed.comic.pageCount;
    if (pageCount <= 0) {
      throw new Error("nenhuma imagem suportada foi encontrada");
    }
    return { pageCount };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "nao foi possivel abrir o ZIP";
    throw new Error(`CBZ invalido: ${detail}`);
  }
}

export async function extractEpubMetadata(
  filePath: string,
  logPrefix = "[DocumentProcessing]",
): Promise<EpubMetadata | null> {
  try {
    const zip = new AdmZip(filePath);
    const entries = zip.getEntries();

    const containerEntry = entries.find((entry: any) => entry.entryName === "META-INF/container.xml");
    if (!containerEntry) return null;

    const containerXml = containerEntry.getData().toString("utf8");
    const rootFileMatch = containerXml.match(/full-path="([^"]+)"/);
    if (!rootFileMatch) return null;

    const opfPath = rootFileMatch[1];
    const opfEntry = entries.find((entry: any) => entry.entryName === opfPath || entry.entryName.endsWith(".opf"));
    if (!opfEntry) return null;

    const opfXml = opfEntry.getData().toString("utf8");
    const title = opfXml.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i)?.[1]?.trim();
    const author = opfXml.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/i)?.[1]?.trim();
    const producer = opfXml.match(/<dc:publisher[^>]*>([^<]+)<\/dc:publisher>/i)?.[1]?.trim();

    return { title, author, producer };
  } catch (error) {
    console.error(`${logPrefix} Error extracting EPUB metadata:`, error);
    return null;
  }
}

export function findThumbnailByHash(thumbnailsDir: string, fileHash: string): string | null {
  if (!fs.existsSync(thumbnailsDir)) {
    return null;
  }

  const files = fs.readdirSync(thumbnailsDir);
  const matchingFile = files.find(
    (file) =>
      file.startsWith(`${fileHash}-`) &&
      THUMBNAIL_EXTENSIONS.includes(path.extname(file).toLowerCase()),
  );

  return matchingFile ? path.join(thumbnailsDir, matchingFile) : null;
}

export async function generateThumbnail(
  filePath: string,
  fileHash: string,
  options: GenerateThumbnailOptions,
): Promise<string | null> {
  const {
    thumbnailsDir,
    force = false,
    fileType = "pdf",
    logPrefix = "[DocumentProcessing]",
  } = options;

  try {
    if (!fs.existsSync(thumbnailsDir)) {
      fs.mkdirSync(thumbnailsDir, { recursive: true });
    }

    if (!force) {
      const existingPath = findThumbnailByHash(thumbnailsDir, fileHash);
      if (existingPath) {
        console.log(`${logPrefix} Found existing thumbnail: ${existingPath}`);
        return existingPath;
      }
    }

    if (force) {
      const existingFiles = fs.readdirSync(thumbnailsDir);
      for (const file of existingFiles) {
        if (
          file.startsWith(`${fileHash}-`) &&
          THUMBNAIL_EXTENSIONS.includes(path.extname(file).toLowerCase())
        ) {
          fs.unlinkSync(path.join(thumbnailsDir, file));
          console.log(`${logPrefix} Deleted existing thumbnail: ${file}`);
        }
      }
    }

    if (fileType === "epub") {
      return await generateEpubThumbnail(filePath, fileHash, thumbnailsDir, logPrefix);
    }

    if (fileType === "cbz") {
      return await generateCbzThumbnail(filePath, fileHash, thumbnailsDir, logPrefix);
    }

    if (fileType === "azw3") {
      return await generateAzw3Thumbnail(filePath, fileHash, thumbnailsDir, logPrefix);
    }

    if (fileType === "kfx") {
      return await generateKfxThumbnail(filePath, fileHash, thumbnailsDir, logPrefix);
    }

    const pdfRequire = require("pdf-poppler");
    await pdfRequire.convert(filePath, {
      format: "jpeg",
      out_dir: thumbnailsDir,
      out_prefix: fileHash,
      page: 1,
    });

    const generatedPath = findThumbnailByHash(thumbnailsDir, fileHash);
    if (!generatedPath) {
      console.error(`${logPrefix} No thumbnail file found after generation for hash: ${fileHash}`);
      return null;
    }

    const outputPath = path.join(thumbnailsDir, `${fileHash}-thumb.webp`);
    const sharp = require("sharp");
    const imageBuffer = fs.readFileSync(generatedPath);
    await sharp(imageBuffer)
      .resize(THUMB_WIDTH, undefined, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toFile(outputPath);
    fs.unlinkSync(generatedPath);
    console.log(`${logPrefix} Thumbnail generated: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error(`${logPrefix} Error generating thumbnail:`, error);
    return null;
  }
}

function readAzw3Records(buffer: Buffer): Buffer[] {
  const recordCount = buffer.readUInt16BE(76);
  const offsets = Array.from({ length: recordCount }, (_, index) => buffer.readUInt32BE(78 + index * 8));
  return offsets.map((offset, index) => {
    const nextOffset = index + 1 < offsets.length ? offsets[index + 1] : buffer.length;
    return buffer.subarray(offset, nextOffset);
  });
}

function readExthUInt(recordZero: Buffer, type: number): number | null {
  const mobiOffset = 16;
  const mobiHeaderLength = recordZero.readUInt32BE(mobiOffset + 4);
  const exthOffset = mobiOffset + mobiHeaderLength;
  if (recordZero.subarray(exthOffset, exthOffset + 4).toString("ascii") !== "EXTH") return null;
  const exthLength = recordZero.readUInt32BE(exthOffset + 4);
  let cursor = exthOffset + 12;
  const end = exthOffset + exthLength;
  while (cursor + 8 <= end) {
    const recordType = recordZero.readUInt32BE(cursor);
    const length = recordZero.readUInt32BE(cursor + 4);
    if (length < 8 || cursor + length > end) break;
    if (recordType === type && length >= 12) return recordZero.readUInt32BE(cursor + 8);
    cursor += length;
  }
  return null;
}

function isImageBuffer(buffer: Buffer) {
  return (
    (buffer[0] === 0xff && buffer[1] === 0xd8) ||
    (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) ||
    buffer.subarray(0, 6).toString("ascii") === "GIF87a" ||
    buffer.subarray(0, 6).toString("ascii") === "GIF89a"
  );
}

async function writeImageThumbnail(imageBuffer: Buffer, outputPath: string) {
  const sharp = require("sharp");
  await sharp(imageBuffer)
    .resize(THUMB_WIDTH, undefined, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 85 })
    .toFile(outputPath);
  return outputPath;
}

async function generateAzw3Thumbnail(
  filePath: string,
  fileHash: string,
  thumbnailsDir: string,
  logPrefix: string,
): Promise<string | null> {
  try {
    const buffer = fs.readFileSync(filePath);
    const records = readAzw3Records(buffer);
    const recordZero = records[0];
    const firstResourceRecord = recordZero.readUInt32BE(16 + 92);
    const coverOffset = readExthUInt(recordZero, 201);
    const candidates = typeof coverOffset === "number" && firstResourceRecord + coverOffset < records.length
      ? [records[firstResourceRecord + coverOffset]]
      : records.slice(Math.max(1, firstResourceRecord)).filter(isImageBuffer);
    const cover = candidates.find(isImageBuffer);
    if (!cover) return null;
    const outputPath = path.join(thumbnailsDir, `${fileHash}-thumb.webp`);
    return await writeImageThumbnail(cover, outputPath);
  } catch (error) {
    console.error(`${logPrefix} Error generating AZW3 thumbnail:`, error);
    return null;
  }
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

async function generateKfxThumbnail(
  filePath: string,
  fileHash: string,
  thumbnailsDir: string,
  logPrefix: string,
): Promise<string | null> {
  const kfxlibRoot = findKfxlibRoot();
  if (!kfxlibRoot) {
    console.error(`${logPrefix} kfxlib not found for KFX thumbnail extraction`);
    return null;
  }
  try {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execFileAsync = promisify(execFile);
    const workspace = await fs.promises.mkdtemp(path.join(os.tmpdir(), "lyceum-kfx-thumb-"));
    const outputImage = path.join(workspace, "cover.bin");
    const scriptPath = path.join(workspace, "extract-cover.py");
    await fs.promises.writeFile(scriptPath, String.raw`
import json, sys, types
payload=json.loads(sys.argv[1])
calibre=types.ModuleType("calibre")
constants=types.ModuleType("calibre.constants")
constants.config_dir=payload["configDir"]
sys.modules.setdefault("calibre", calibre)
sys.modules["calibre.constants"]=constants
sys.path.insert(0, payload["kfxlibRoot"])
from kfxlib import YJ_Book
book=YJ_Book(payload["inputPath"])
book.decode_book()
md=book.get_yj_metadata_from_book()
if md.cover_image_data:
    with open(payload["outputImage"], "wb") as out:
        out.write(md.cover_image_data[1])
`);
    await fs.promises.mkdir(path.join(workspace, "config"), { recursive: true });
    await execFileAsync(process.env.LYCEUM_PYTHON || "python", [scriptPath, JSON.stringify({
      inputPath: filePath,
      outputImage,
      configDir: path.join(workspace, "config"),
      kfxlibRoot,
    })], { timeout: 10 * 60 * 1000, windowsHide: true });
    if (!fs.existsSync(outputImage)) return null;
    const outputPath = path.join(thumbnailsDir, `${fileHash}-thumb.webp`);
    return await writeImageThumbnail(fs.readFileSync(outputImage), outputPath);
  } catch (error) {
    console.error(`${logPrefix} Error generating KFX thumbnail:`, error);
    return null;
  }
}

async function generateEpubThumbnail(
  filePath: string,
  fileHash: string,
  thumbnailsDir: string,
  logPrefix: string,
): Promise<string | null> {
  try {
    const zip = new AdmZip(filePath);
    const entries = zip.getEntries();

    const getEntry = (entryPath: string) =>
      entries.find((entry: any) => entry.entryName === entryPath);
    const normalizeZipPath = (entryPath: string) => entryPath.replace(/\\/g, "/");
    const joinZipPath = (basePath: string, relativePath: string) =>
      normalizeZipPath(path.posix.normalize(path.posix.join(basePath, relativePath)));

    let coverImage: any = null;

    const containerEntry = getEntry("META-INF/container.xml");
    if (containerEntry) {
      const containerXml = containerEntry.getData().toString("utf8");
      const rootFileMatch = containerXml.match(/full-path="([^"]+)"/);
      const opfPath = rootFileMatch?.[1];
      const opfEntry = opfPath ? getEntry(opfPath) : undefined;

      if (opfEntry && opfPath) {
        const opfXml = opfEntry.getData().toString("utf8");
        const opfDir = opfPath.split("/").slice(0, -1).join("/");
        const metaCoverId = opfXml.match(/<meta[^>]+name=["']cover["'][^>]+content=["']([^"']+)["']/i)?.[1];
        const manifestItems = Array.from(opfXml.matchAll(/<item\b([^>]+)>/gi));

        const readAttr = (source: string, attr: string) =>
          source.match(new RegExp(`${attr}=["']([^"']+)["']`, "i"))?.[1];

        const coverItem = manifestItems.find((match) => {
          const attrs = match[1];
          const id = readAttr(attrs, "id");
          const properties = readAttr(attrs, "properties") || "";
          const href = readAttr(attrs, "href") || "";
          return (
            (metaCoverId && id === metaCoverId) ||
            properties.split(/\s+/).includes("cover-image") ||
            /cover|front/i.test(href)
          );
        });

        const href = coverItem ? readAttr(coverItem[1], "href") : undefined;
        if (href) {
          coverImage = getEntry(joinZipPath(opfDir, href));
        }
      }
    }

    const coverNames = ["cover.jpg", "cover.jpeg", "cover.png", "cover.webp"];
    for (const name of coverNames) {
      const found = entries.find((entry: any) =>
        entry.entryName.toLowerCase().endsWith(name),
      );
      if (found) {
        coverImage = found;
        break;
      }
    }

    if (!coverImage) {
      const imageEntries = entries.filter((entry: any) => {
        const name = entry.entryName.toLowerCase();
        return THUMBNAIL_EXTENSIONS.some((ext) => name.endsWith(ext)) &&
          (name.includes("cover") || name.includes("front"));
      });
      if (imageEntries.length > 0) {
        coverImage = imageEntries[0];
      }
    }

    if (!coverImage) {
      const anyImage = entries.find((entry: any) => {
        const name = entry.entryName.toLowerCase();
        return THUMBNAIL_EXTENSIONS.some((ext) => name.endsWith(ext));
      });
      if (anyImage) {
        coverImage = anyImage;
      }
    }

    if (!coverImage) {
      console.log(`${logPrefix} No cover image found in EPUB`);
      return null;
    }

    const outputPath = path.join(thumbnailsDir, `${fileHash}-thumb.webp`);
    const sharp = require("sharp");
    await sharp(coverImage.getData())
      .resize(THUMB_WIDTH, undefined, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toFile(outputPath);

    console.log(`${logPrefix} Generated EPUB thumbnail: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error(`${logPrefix} Error generating EPUB thumbnail:`, error);
    return null;
  }
}

async function generateCbzThumbnail(
  filePath: string,
  fileHash: string,
  thumbnailsDir: string,
  logPrefix: string,
): Promise<string | null> {
  try {
    const firstImage = await extractFirstCbzImage(filePath);
    if (!firstImage) {
      console.log(`${logPrefix} No image found in CBZ`);
      return null;
    }

    const outputPath = path.join(thumbnailsDir, `${fileHash}-thumb.webp`);
    return await writeImageThumbnail(Buffer.from(firstImage.data), outputPath);
  } catch (error) {
    console.error(`${logPrefix} Error generating CBZ thumbnail:`, error);
    return null;
  }
}
