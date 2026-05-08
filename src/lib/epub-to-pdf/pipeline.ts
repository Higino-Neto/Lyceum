import JSZip, { type JSZipObject } from "jszip";
import { PDFDocument, StandardFonts, rgb, type PDFImage, type PDFFont, type PDFPage } from "pdf-lib";
import type {
  ConvertEpubToPdfOptions,
  ConvertEpubToPdfResult,
  EpubToPdfMetadata,
} from "./types";

type BlockType = "heading" | "paragraph" | "listItem" | "image";

interface ManifestItem {
  id: string;
  href: string;
  mediaType: string;
  properties: string;
}

interface ContentBlock {
  type: BlockType;
  text?: string;
  level?: number;
  imagePath?: string;
  alt?: string;
}

interface ParsedChapter {
  path: string;
  blocks: ContentBlock[];
}

interface ParsedEpub {
  chapters: ParsedChapter[];
  metadata: EpubToPdfMetadata;
  warnings: string[];
}

interface RenderContext {
  warnings: string[];
  imageCount: number;
  skippedImageCount: number;
  unsupportedCharacterCount: number;
}

type BinaryInput = ArrayBuffer | Uint8Array;

function toBuffer(buffer: BinaryInput): Buffer {
  if (buffer instanceof Uint8Array) {
    return Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

  return Buffer.from(new Uint8Array(buffer));
}

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 54;
const MARGIN_TOP = 60;
const MARGIN_BOTTOM = 58;
const BODY_FONT_SIZE = 11;
const LIST_FONT_SIZE = 11;
const HEADING_FONT_SIZE = 17;
const LINE_HEIGHT = 16;
const PARAGRAPH_GAP = 8;
const HEADING_GAP = 12;
const MAX_IMAGE_HEIGHT = 420;

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: "\"",
  apos: "'",
  lsquo: "'",
  rsquo: "'",
  ldquo: "\"",
  rdquo: "\"",
  ndash: "-",
  mdash: "-",
  hellip: "...",
  bull: "-",
  copy: "(c)",
  reg: "(r)",
  trade: "(tm)",
};

const WIN_ANSI_REPLACEMENTS: Record<string, string> = {
  "“": "\"",
  "”": "\"",
  "„": "\"",
  "‘": "'",
  "’": "'",
  "‚": "'",
  "–": "-",
  "—": "-",
  "−": "-",
  "…": "...",
  "•": "-",
  "·": "-",
  "‹": "<",
  "›": ">",
  "«": "<<",
  "»": ">>",
  "ﬁ": "fi",
  "ﬂ": "fl",
  "ﬃ": "ffi",
  "ﬄ": "ffl",
};

function normalizeZipPath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\/+/, "");
}

function dirname(value: string): string {
  const normalized = normalizeZipPath(value);
  const index = normalized.lastIndexOf("/");
  return index >= 0 ? normalized.slice(0, index + 1) : "";
}

function stripUrlSuffix(value: string): string {
  return value.split("#")[0].split("?")[0];
}

function resolveZipPath(baseDirectory: string, href: string): string {
  const cleanHref = stripUrlSuffix(href);
  const decodedHref = decodeURIComponent(cleanHref);
  const parts = `${baseDirectory}${decodedHref}`.split("/");
  const resolved: string[] = [];

  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") {
      resolved.pop();
    } else {
      resolved.push(part);
    }
  }

  return resolved.join("/");
}

function getEntry(zip: JSZip, entryPath: string): JSZipObject | null {
  const normalized = normalizeZipPath(entryPath);
  return zip.file(normalized)
    || Object.values(zip.files).find((entry) => !entry.dir && normalizeZipPath(entry.name).toLowerCase() === normalized.toLowerCase())
    || null;
}

async function getEntryText(zip: JSZip, entryPath: string): Promise<string | null> {
  const entry = getEntry(zip, entryPath);
  return entry ? entry.async("text") : null;
}

function getAttribute(value: string, attribute: string): string | null {
  const pattern = new RegExp(`\\b${attribute}\\s*=\\s*["']([^"']+)["']`, "i");
  return value.match(pattern)?.[1] || null;
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, " ");
}

function decodeEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([a-f0-9]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z][a-z0-9]+);/gi, (match, entity) => NAMED_ENTITIES[entity.toLowerCase()] ?? match);
}

function cleanText(value: string): string {
  return decodeEntities(stripTags(value))
    .replace(/\u00ad/g, "")
    .replace(/[ \t\r\n]+/g, " ")
    .trim();
}

function getTagText(value: string, tagName: string): string | undefined {
  const pattern = new RegExp(`<[^:>]*(?::)?${tagName}[^>]*>([\\s\\S]*?)<\\/[^:>]*(?::)?${tagName}>`, "i");
  const text = value.match(pattern)?.[1];
  const cleaned = text ? cleanText(text) : "";
  return cleaned || undefined;
}

function isContentDocument(item: ManifestItem): boolean {
  return /xhtml|html/i.test(item.mediaType) || /\.(xhtml|html?)$/i.test(item.href);
}

function isNavigationDocument(item: ManifestItem): boolean {
  return /\bnav\b/i.test(item.properties) || /(^|\/)(toc|nav|navigation)\.(xhtml|html?)$/i.test(item.href);
}

function getBodyHtml(html: string): string {
  return html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html;
}

function htmlToBlocks(html: string, chapterPath: string): ContentBlock[] {
  const imagePlaceholders: { src: string; alt?: string }[] = [];
  const baseDirectory = dirname(chapterPath);
  let prepared = getBodyHtml(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<img\b[^>]*>/gi, (match) => {
      const src = getAttribute(match, "src") || getAttribute(match, "data-src");
      if (!src) return " ";
      const alt = getAttribute(match, "alt") || undefined;
      const index = imagePlaceholders.push({ src, alt }) - 1;
      return `\n\n{{IMG:${index}}}\n\n`;
    })
    .replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level, content) => (
      `\n\n{{H:${level}}}${content}{{/H}}\n\n`
    ))
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "\n\n{{LI}}")
    .replace(/<\/(li|p|div|section|article|blockquote|tr)>/gi, "\n\n");

  prepared = prepared.replace(/<[^>]+>/g, " ");

  return prepared
    .split(/\n{2,}/)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment): ContentBlock | null => {
      const imageMatch = segment.match(/^\{\{IMG:(\d+)}}$/);
      if (imageMatch) {
        const image = imagePlaceholders[Number(imageMatch[1])];
        return {
          type: "image",
          imagePath: resolveZipPath(baseDirectory, image.src),
          alt: image.alt,
        };
      }

      const headingMatch = segment.match(/^\{\{H:(\d+)}}([\s\S]*?)\{\{\/H}}$/);
      if (headingMatch) {
        const text = cleanText(headingMatch[2]);
        return text ? { type: "heading", level: Number(headingMatch[1]), text } : null;
      }

      const isListItem = segment.startsWith("{{LI}}");
      const text = cleanText(segment.replace(/^\{\{LI}}/, ""));
      if (!text) return null;

      return {
        type: isListItem ? "listItem" : "paragraph",
        text,
      };
    })
    .filter((block): block is ContentBlock => Boolean(block));
}

function parseManifest(opf: string): Map<string, ManifestItem> {
  const manifest = new Map<string, ManifestItem>();

  for (const match of opf.matchAll(/<item\b[^>]*>/gi)) {
    const item = match[0];
    const id = getAttribute(item, "id");
    const href = getAttribute(item, "href");
    const mediaType = getAttribute(item, "media-type") || "";
    const properties = getAttribute(item, "properties") || "";

    if (id && href) {
      manifest.set(id, { id, href, mediaType, properties });
    }
  }

  return manifest;
}

async function parseOpf(zip: JSZip, opfPath: string): Promise<ParsedEpub> {
  const opf = await getEntryText(zip, opfPath);
  if (!opf) {
    throw new Error("Arquivo OPF do EPUB não encontrado");
  }

  const baseDirectory = dirname(opfPath);
  const manifest = parseManifest(opf);
  const warnings: string[] = [];
  const chapters: ParsedChapter[] = [];
  const seenPaths = new Set<string>();

  const addChapter = async (item: ManifestItem) => {
    if (!isContentDocument(item) || isNavigationDocument(item)) return;

    const chapterPath = resolveZipPath(baseDirectory, item.href);
    if (seenPaths.has(chapterPath)) return;

    const chapter = await getEntryText(zip, chapterPath);
    if (!chapter) {
      warnings.push(`Capítulo não encontrado: ${chapterPath}`);
      return;
    }

    const blocks = htmlToBlocks(chapter, chapterPath);
    if (blocks.length === 0) {
      warnings.push(`Capítulo sem texto legível: ${chapterPath}`);
      return;
    }

    seenPaths.add(chapterPath);
    chapters.push({ path: chapterPath, blocks });
  };

  for (const match of opf.matchAll(/<itemref\b[^>]*>/gi)) {
    const itemref = match[0];
    const idref = getAttribute(itemref, "idref");
    const linear = getAttribute(itemref, "linear");
    const item = idref ? manifest.get(idref) : null;

    if (!item || linear?.toLowerCase() === "no") continue;
    await addChapter(item);
  }

  if (chapters.length === 0) {
    warnings.push("Spine ausente ou vazio; usando documentos HTML do manifesto.");
    for (const item of manifest.values()) {
      await addChapter(item);
    }
  }

  return {
    chapters,
    metadata: {
      title: getTagText(opf, "title"),
      author: getTagText(opf, "creator"),
      language: getTagText(opf, "language"),
    },
    warnings,
  };
}

async function parseEpub(zip: JSZip): Promise<ParsedEpub> {
  const container = await getEntryText(zip, "META-INF/container.xml");
  if (!container) {
    const entries = Object.keys(zip.files).slice(0, 5).join(", ");
    throw new Error(`EPUB inválido: container.xml não encontrado${entries ? ` (${entries})` : ""}`);
  }

  const rootfileMatch = [...container.matchAll(/<rootfile\b[^>]*>/gi)]
    .map((match) => match[0])
    .find((rootfile) => {
      const mediaType = getAttribute(rootfile, "media-type") || "";
      return !mediaType || mediaType === "application/oebps-package+xml";
    });
  const opfPath = rootfileMatch ? getAttribute(rootfileMatch, "full-path") : null;
  if (!opfPath) {
    throw new Error("EPUB inválido: OPF não encontrado");
  }

  return parseOpf(zip, opfPath);
}

function sanitizePdfText(value: string, context: RenderContext): string {
  let output = "";

  for (const char of value) {
    if (WIN_ANSI_REPLACEMENTS[char]) {
      output += WIN_ANSI_REPLACEMENTS[char];
      continue;
    }

    const codePoint = char.codePointAt(0) || 0;
    if (codePoint === 9 || codePoint === 10 || codePoint === 13 || (codePoint >= 32 && codePoint <= 255)) {
      output += char;
      continue;
    }

    const fallback = char.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
    const safeFallback = [...fallback].filter((item) => {
      const itemCode = item.codePointAt(0) || 0;
      return itemCode >= 32 && itemCode <= 255;
    }).join("");

    if (safeFallback) {
      output += safeFallback;
    } else {
      output += "?";
      context.unsupportedCharacterCount += 1;
    }
  }

  return output;
}

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number, context: RenderContext): string[] {
  const words = sanitizePdfText(text, context).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
    }

    if (font.widthOfTextAtSize(word, fontSize) <= maxWidth) {
      current = word;
    } else {
      let chunk = "";
      for (const char of word) {
        const candidateChunk = `${chunk}${char}`;
        if (font.widthOfTextAtSize(candidateChunk, fontSize) <= maxWidth) {
          chunk = candidateChunk;
        } else {
          if (chunk) lines.push(chunk);
          chunk = char;
        }
      }
      current = chunk;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function addPage(pdf: PDFDocument): PDFPage {
  return pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
}

function drawLines(
  pdf: PDFDocument,
  page: PDFPage,
  lines: string[],
  font: PDFFont,
  fontSize: number,
  y: number,
): { page: PDFPage; y: number } {
  let currentPage = page;
  let currentY = y;

  for (const line of lines) {
    if (currentY < MARGIN_BOTTOM + LINE_HEIGHT) {
      currentPage = addPage(pdf);
      currentY = PAGE_HEIGHT - MARGIN_TOP;
    }

    currentPage.drawText(line, {
      x: MARGIN_X,
      y: currentY,
      size: fontSize,
      font,
      color: rgb(0.12, 0.12, 0.14),
    });
    currentY -= LINE_HEIGHT;
  }

  return { page: currentPage, y: currentY };
}

async function embedImage(pdf: PDFDocument, imageBuffer: Uint8Array, mediaType: string): Promise<PDFImage | null> {
  const lowerMediaType = mediaType.toLowerCase();

  if (lowerMediaType.includes("jpeg") || lowerMediaType.includes("jpg")) {
    return pdf.embedJpg(imageBuffer);
  }

  if (lowerMediaType.includes("png")) {
    try {
      return await pdf.embedPng(imageBuffer);
    } catch {
      const sharp = await import("sharp");
      const sharpInput = Buffer.from(imageBuffer);
      const png = await sharp.default(sharpInput).png().toBuffer();
      return pdf.embedPng(png);
    }
  }

  if (lowerMediaType.includes("webp")) {
    const sharp = await import("sharp");
    const sharpInput = Buffer.from(imageBuffer);
    const png = await sharp.default(sharpInput).png().toBuffer();
    return pdf.embedPng(png);
  }

  return null;
}

async function drawImageBlock(
  pdf: PDFDocument,
  zip: JSZip,
  page: PDFPage,
  block: ContentBlock,
  y: number,
  context: RenderContext,
): Promise<{ page: PDFPage; y: number }> {
  if (!block.imagePath) {
    return { page, y };
  }

  const entry = getEntry(zip, block.imagePath);
  if (!entry) {
    context.skippedImageCount += 1;
    context.warnings.push(`Imagem não encontrada: ${block.imagePath}`);
    return { page, y };
  }

  try {
    const data = await entry.async("uint8array");
    const sharp = await import("sharp");
    const metadata = await sharp.default(Buffer.from(data)).metadata();
    const mediaType = metadata.format ? `image/${metadata.format}` : block.imagePath.toLowerCase().endsWith(".jpg") || block.imagePath.toLowerCase().endsWith(".jpeg")
      ? "image/jpeg"
      : block.imagePath.toLowerCase().endsWith(".png")
        ? "image/png"
        : block.imagePath.toLowerCase().endsWith(".webp")
          ? "image/webp"
          : "";
    const image = await embedImage(pdf, data, mediaType);

    if (!image) {
      context.skippedImageCount += 1;
      context.warnings.push(`Formato de imagem não suportado: ${block.imagePath}`);
      return { page, y };
    }

    const maxWidth = PAGE_WIDTH - MARGIN_X * 2;
    const naturalWidth = metadata.width || image.width;
    const naturalHeight = metadata.height || image.height;
    const scale = Math.min(1, maxWidth / naturalWidth, MAX_IMAGE_HEIGHT / naturalHeight);
    const width = naturalWidth * scale;
    const height = naturalHeight * scale;
    let currentPage = page;
    let currentY = y;

    if (currentY - height < MARGIN_BOTTOM) {
      currentPage = addPage(pdf);
      currentY = PAGE_HEIGHT - MARGIN_TOP;
    }

    currentPage.drawImage(image, {
      x: MARGIN_X + (maxWidth - width) / 2,
      y: currentY - height,
      width,
      height,
    });

    context.imageCount += 1;
    return { page: currentPage, y: currentY - height - PARAGRAPH_GAP };
  } catch (error) {
    context.skippedImageCount += 1;
    context.warnings.push(`Erro ao inserir imagem ${block.imagePath}: ${error instanceof Error ? error.message : "erro desconhecido"}`);
    return { page, y };
  }
}

function drawPageNumbers(pdf: PDFDocument, font: PDFFont) {
  const pages = pdf.getPages();

  pages.forEach((page, index) => {
    const text = `${index + 1}`;
    page.drawText(text, {
      x: PAGE_WIDTH / 2 - font.widthOfTextAtSize(text, 9) / 2,
      y: 28,
      size: 9,
      font,
      color: rgb(0.45, 0.45, 0.48),
    });
  });
}

export async function convertEpubToPdf(
  epubBuffer: BinaryInput,
  options: ConvertEpubToPdfOptions = {},
): Promise<ConvertEpubToPdfResult> {
  const zip = await JSZip.loadAsync(toBuffer(epubBuffer));
  const parsed = await parseEpub(zip);
  const textBlocks = parsed.chapters.flatMap((chapter) => chapter.blocks).filter((block) => block.text);

  if (textBlocks.length === 0) {
    throw new Error("Nenhum texto legível encontrado no EPUB");
  }

  const context: RenderContext = {
    warnings: [...parsed.warnings],
    imageCount: 0,
    skippedImageCount: 0,
    unsupportedCharacterCount: 0,
  };
  const pdf = await PDFDocument.create();
  pdf.setTitle(options.title || parsed.metadata.title || "Livro convertido");
  if (options.author || parsed.metadata.author) {
    pdf.setAuthor(options.author || parsed.metadata.author || "");
  }

  const bodyFont = await pdf.embedFont(StandardFonts.TimesRoman);
  const listFont = await pdf.embedFont(StandardFonts.TimesRoman);
  const headingFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageNumberFont = await pdf.embedFont(StandardFonts.Helvetica);
  let page = addPage(pdf);
  let y = PAGE_HEIGHT - MARGIN_TOP;
  const maxWidth = PAGE_WIDTH - MARGIN_X * 2;
  const title = options.title || parsed.metadata.title;

  if (title) {
    const titleLines = wrapText(title, headingFont, HEADING_FONT_SIZE + 2, maxWidth, context);
    const drawn = drawLines(pdf, page, titleLines, headingFont, HEADING_FONT_SIZE + 2, y);
    page = drawn.page;
    y = drawn.y - HEADING_GAP;
  }

  for (const chapter of parsed.chapters) {
    for (const block of chapter.blocks) {
      if (block.type === "image") {
        const drawn = await drawImageBlock(pdf, zip, page, block, y, context);
        page = drawn.page;
        y = drawn.y;
        continue;
      }

      const text = block.type === "listItem" ? `- ${block.text}` : block.text || "";
      const isHeading = block.type === "heading";
      const font = isHeading ? headingFont : block.type === "listItem" ? listFont : bodyFont;
      const fontSize = isHeading ? Math.max(13, HEADING_FONT_SIZE - Math.min((block.level || 1) - 1, 3) * 1.5) : block.type === "listItem" ? LIST_FONT_SIZE : BODY_FONT_SIZE;
      const lines = wrapText(text, font, fontSize, maxWidth, context);

      if (isHeading && y < MARGIN_BOTTOM + LINE_HEIGHT * (lines.length + 2)) {
        page = addPage(pdf);
        y = PAGE_HEIGHT - MARGIN_TOP;
      }

      const drawn = drawLines(pdf, page, lines, font, fontSize, y);
      page = drawn.page;
      y = drawn.y - (isHeading ? HEADING_GAP : PARAGRAPH_GAP);
    }
  }

  if (context.unsupportedCharacterCount > 0) {
    context.warnings.push(`${context.unsupportedCharacterCount} caractere(s) foram substituídos por falta de suporte da fonte PDF.`);
  }

  drawPageNumbers(pdf, pageNumberFont);

  const bytes = await pdf.save();
  const wordCount = textBlocks
    .map((block) => block.text || "")
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;

  return {
    pdf: bytes,
    metadata: parsed.metadata,
    report: {
      chapterCount: parsed.chapters.length,
      pageCount: pdf.getPageCount(),
      wordCount,
      imageCount: context.imageCount,
      skippedImageCount: context.skippedImageCount,
      unsupportedCharacterCount: context.unsupportedCharacterCount,
      warnings: context.warnings,
    },
  };
}
