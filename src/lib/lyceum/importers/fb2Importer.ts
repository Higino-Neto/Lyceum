import fs from "node:fs";
import JSZip from "jszip";
import { JSDOM } from "jsdom";
import type { ImportInput, ImportResult, LyceumBookMetadata, LyceumImporter } from "../schema/types";
import { escapeXml } from "../textual";
import {
  imageMediaType,
  writeAssembledBook,
  type AssembledChapter,
  type AssembledResource,
  type AssembledTocEntry,
} from "./bookAssembly";
import { LyceumImportError } from "./importErrors";

/** FictionBook 2 (.fb2 and zipped .fb2.zip) importer. */

interface Fb2Context {
  images: Map<string, AssembledResource>;
}

function elementChildren(element: Element | null | undefined, localName?: string): Element[] {
  if (!element) return [];
  return Array.from(element.children).filter((child) => !localName || child.localName === localName);
}

function firstChild(element: Element | null | undefined, localName: string) {
  return elementChildren(element, localName)[0];
}

function hrefOf(element: Element): string | undefined {
  for (const attribute of Array.from(element.attributes)) {
    if (attribute.localName === "href") return attribute.value;
  }
  return undefined;
}

function idAttribute(element: Element) {
  const id = element.getAttribute("id");
  return id ? ` id="${escapeXml(id)}"` : "";
}

async function readFb2Bytes(sourcePath: string): Promise<Buffer> {
  const bytes = await fs.promises.readFile(sourcePath);
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) return bytes;
  const zip = await JSZip.loadAsync(bytes);
  const entry = Object.values(zip.files).find((file) => !file.dir && file.name.toLowerCase().endsWith(".fb2"));
  if (!entry) throw new LyceumImportError("corrupt", "Arquivo ZIP sem livro .fb2.");
  return Buffer.from(await entry.async("uint8array"));
}

function decodeFb2(bytes: Buffer): string {
  const head = bytes.toString("latin1", 0, 200);
  const declared = /encoding\s*=\s*["']([\w-]+)["']/i.exec(head)?.[1];
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes);
  try {
    return new TextDecoder(declared || "utf-8").decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

function collectImages(root: Element): Map<string, AssembledResource> {
  const images = new Map<string, AssembledResource>();
  elementChildren(root, "binary").forEach((binary, index) => {
    const id = binary.getAttribute("id");
    if (!id) return;
    const data = Buffer.from((binary.textContent || "").replace(/\s+/g, ""), "base64");
    const type = imageMediaType(data);
    if (!type) return;
    images.set(id, {
      href: `images/fb2-${String(index + 1).padStart(4, "0")}.${type.extension}`,
      mediaType: type.mediaType,
      data,
    });
  });
  return images;
}

function renderInline(element: Element, context: Fb2Context): string {
  let html = "";
  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType === 3) {
      html += escapeXml(node.textContent || "");
      continue;
    }
    if (node.nodeType !== 1) continue;
    const child = node as Element;
    const inner = () => renderInline(child, context);
    switch (child.localName) {
      case "strong": html += `<strong>${inner()}</strong>`; break;
      case "emphasis": html += `<em>${inner()}</em>`; break;
      case "strikethrough": html += `<s>${inner()}</s>`; break;
      case "sub": html += `<sub>${inner()}</sub>`; break;
      case "sup": html += `<sup>${inner()}</sup>`; break;
      case "code": html += `<code>${inner()}</code>`; break;
      case "a": {
        const href = hrefOf(child) || "";
        const content = inner();
        html += child.getAttribute("type") === "note"
          ? `<sup><a href="${escapeXml(href)}">${content}</a></sup>`
          : `<a href="${escapeXml(href)}">${content}</a>`;
        break;
      }
      case "image": html += renderImage(child, context); break;
      default: html += inner(); break;
    }
  }
  return html;
}

function renderImage(element: Element, context: Fb2Context): string {
  const href = hrefOf(element) || "";
  const image = href.startsWith("#") ? context.images.get(href.slice(1)) : undefined;
  if (!image) return "";
  const alt = element.getAttribute("alt") || "";
  return `<img src="../${image.href}" alt="${escapeXml(alt)}" />`;
}

function renderTitle(element: Element, level: number, context: Fb2Context) {
  const tag = `h${Math.min(Math.max(level, 1), 6)}`;
  const lines = elementChildren(element, "p").map((paragraph) => renderInline(paragraph, context));
  return `<${tag}${idAttribute(element)}>${lines.join("<br />")}</${tag}>`;
}

function titleText(element: Element | undefined) {
  if (!element) return "";
  return elementChildren(element, "p").map((paragraph) => paragraph.textContent?.trim() || "").filter(Boolean).join(" ");
}

function renderBlock(element: Element, level: number, context: Fb2Context): string {
  switch (element.localName) {
    case "title": return renderTitle(element, level, context);
    case "p": return `<p${idAttribute(element)}>${renderInline(element, context)}</p>`;
    case "subtitle": return `<p class="subtitle"${idAttribute(element)}><strong>${renderInline(element, context)}</strong></p>`;
    case "empty-line": return "<p>&#160;</p>";
    case "text-author": return `<p class="text-author"><em>${renderInline(element, context)}</em></p>`;
    case "v": return `<p class="verse">${renderInline(element, context)}</p>`;
    case "image": return `<div class="image">${renderImage(element, context)}</div>`;
    case "epigraph":
      return `<blockquote class="epigraph"${idAttribute(element)}>${renderBlocks(element, level, context)}</blockquote>`;
    case "cite":
      return `<blockquote${idAttribute(element)}>${renderBlocks(element, level, context)}</blockquote>`;
    case "annotation":
      return `<div class="annotation">${renderBlocks(element, level, context)}</div>`;
    case "poem":
      return `<div class="poem"${idAttribute(element)}>${renderBlocks(element, level + 1, context)}</div>`;
    case "stanza":
      return `<div class="stanza">${renderBlocks(element, level + 1, context)}</div>`;
    case "section":
      return `<div class="section"${idAttribute(element)}>${renderBlocks(element, level + 1, context)}</div>`;
    case "table":
      return `<table>${elementChildren(element, "tr").map((row) => `<tr>${elementChildren(row)
        .map((cell) => `<${cell.localName === "th" ? "th" : "td"}>${renderInline(cell, context)}</${cell.localName === "th" ? "th" : "td"}>`)
        .join("")}</tr>`).join("")}</table>`;
    default:
      return "";
  }
}

function renderBlocks(element: Element, level: number, context: Fb2Context): string {
  return elementChildren(element).map((child) => renderBlock(child, level, context)).join("\n");
}

function readMetadata(root: Element, images: Map<string, AssembledResource>): Partial<LyceumBookMetadata> {
  const description = firstChild(root, "description");
  const titleInfo = firstChild(description, "title-info");
  const publishInfo = firstChild(description, "publish-info");
  const text = (parent: Element | undefined, localName: string) => firstChild(parent, localName)?.textContent?.trim() || undefined;
  const authors = elementChildren(titleInfo, "author")
    .map((author) => {
      const parts = ["first-name", "middle-name", "last-name"].map((name) => text(author, name)).filter(Boolean);
      return parts.length ? parts.join(" ") : text(author, "nickname");
    })
    .filter((author): author is string => Boolean(author));
  const sequence = firstChild(titleInfo, "sequence");
  const genres = elementChildren(titleInfo, "genre").map((genre) => genre.textContent?.trim() || "").filter(Boolean);
  const coverImage = firstChild(firstChild(titleInfo, "coverpage"), "image");
  const coverHref = coverImage ? hrefOf(coverImage) : undefined;
  if (coverHref?.startsWith("#")) {
    const cover = images.get(coverHref.slice(1));
    if (cover) cover.isCover = true;
  }
  return {
    title: text(titleInfo, "book-title"),
    author: authors.length ? authors.join(" & ") : undefined,
    language: text(titleInfo, "lang"),
    description: firstChild(titleInfo, "annotation")?.textContent?.replace(/\s+/g, " ").trim() || undefined,
    subject: genres.length > 1 ? genres : genres[0],
    publishDate: text(publishInfo, "year") || text(titleInfo, "date"),
    publisher: text(publishInfo, "publisher"),
    isbn: text(publishInfo, "isbn"),
    series: sequence?.getAttribute("name") || undefined,
    seriesIndex: sequence?.getAttribute("number") || undefined,
  };
}

export class Fb2Importer implements LyceumImporter {
  inputFormat = "fb2" as const;

  async import(input: ImportInput): Promise<ImportResult> {
    const xml = decodeFb2(await readFb2Bytes(input.sourcePath));
    let root: Element;
    try {
      root = new JSDOM(xml, { contentType: "text/xml" }).window.document.documentElement;
    } catch {
      throw new LyceumImportError("corrupt", "FB2 invalido: XML malformado.");
    }
    if (root.localName !== "FictionBook") throw new LyceumImportError("corrupt", "Arquivo nao e um FictionBook.");
    input.onProgress?.(0.2, "Lendo FictionBook");

    const images = collectImages(root);
    const context: Fb2Context = { images };
    const metadata = readMetadata(root, images);
    const chapters: AssembledChapter[] = [];
    const toc: AssembledTocEntry[] = [];
    const bodies = elementChildren(root, "body");
    const mainBody = bodies.find((body) => !body.getAttribute("name")) || bodies[0];

    for (const body of bodies) {
      const isMain = body === mainBody;
      const sections = elementChildren(body, "section");
      const leading = elementChildren(body).filter((child) => child.localName !== "section");
      const leadingHtml = leading.map((child) => renderBlock(child, 1, context)).join("\n");
      if (!isMain || sections.length === 0) {
        const title = titleText(firstChild(body, "title")) || (isMain ? undefined : body.getAttribute("name") || undefined);
        const html = isMain ? leadingHtml : renderBlocks(body, 1, context);
        if (html.trim()) {
          toc.push({ title: title || metadata.title || "", chapterIndex: chapters.length, level: 1 });
          chapters.push({ title, html });
        }
        continue;
      }
      if (leadingHtml.trim()) chapters.push({ title: titleText(firstChild(body, "title")) || undefined, html: leadingHtml });
      for (const section of sections) {
        const title = titleText(firstChild(section, "title"));
        const chapterIndex = chapters.length;
        chapters.push({
          title: title || undefined,
          html: `<div class="section"${idAttribute(section)}>${renderBlocks(section, 1, context)}</div>`,
        });
        if (title) toc.push({ title, chapterIndex, level: 1 });
        for (const subsection of elementChildren(section, "section")) {
          const subtitle = titleText(firstChild(subsection, "title"));
          const id = subsection.getAttribute("id");
          if (subtitle && id) toc.push({ title: subtitle, chapterIndex, anchor: id, level: 2 });
        }
      }
    }
    input.onProgress?.(0.6, "Montando capitulos");

    return writeAssembledBook(input, "fb2", {
      metadata,
      chapters,
      resources: [...images.values()],
      toc,
    });
  }
}
