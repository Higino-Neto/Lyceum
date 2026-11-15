import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { JSDOM } from "jsdom";
import type { ImportInput, ImportResult, LyceumBookMetadata, LyceumImporter } from "../schema/types";
import { escapeXml } from "../textual";
import {
  imageMediaType,
  writeAssembledBook,
  type AssembledChapter,
  type AssembledResource,
} from "./bookAssembly";
import { LyceumImportError } from "./importErrors";

/**
 * DOCX (WordprocessingML) importer. Covers what matters for reading: headings
 * (chapter split), paragraphs, inline formatting, lists, tables, links,
 * bookmarks, images and foot/endnotes.
 */

interface Relationship {
  target: string;
  external: boolean;
}

interface StyleInfo {
  headingLevel?: number;
  basedOn?: string;
}

interface DocxContext {
  zip: JSZip;
  relationships: Map<string, Relationship>;
  styles: Map<string, StyleInfo>;
  numberingFormats: Map<string, Map<number, string>>;
  resources: AssembledResource[];
  imageByTarget: Map<string, AssembledResource>;
  noteNumbers: Map<string, number>;
  notes: Array<{ kind: "footnote" | "endnote"; id: string; number: number; html: string }>;
  footnotes: Map<string, Element>;
  endnotes: Map<string, Element>;
}

interface Block {
  html: string;
  headingLevel?: number;
  headingText?: string;
}

function parseXml(xml: string): Document {
  return new JSDOM(xml, { contentType: "text/xml" }).window.document;
}

function children(element: Element | null | undefined, localName?: string): Element[] {
  if (!element) return [];
  return Array.from(element.children).filter((child) => !localName || child.localName === localName);
}

function child(element: Element | null | undefined, localName: string): Element | undefined {
  return children(element, localName)[0];
}

function attr(element: Element | null | undefined, localName: string): string | undefined {
  if (!element) return undefined;
  for (const attribute of Array.from(element.attributes)) {
    if (attribute.localName === localName) return attribute.value;
  }
  return undefined;
}

function descendants(element: Element, localName: string): Element[] {
  return Array.from(element.getElementsByTagName("*")).filter((node) => node.localName === localName);
}

async function readZipText(zip: JSZip, name: string): Promise<string | null> {
  const file = zip.file(name);
  return file ? file.async("string") : null;
}

async function readRelationships(zip: JSZip): Promise<Map<string, Relationship>> {
  const relationships = new Map<string, Relationship>();
  const xml = await readZipText(zip, "word/_rels/document.xml.rels");
  if (!xml) return relationships;
  for (const relationship of descendants(parseXml(xml).documentElement, "Relationship")) {
    const id = attr(relationship, "Id");
    const target = attr(relationship, "Target");
    if (id && target) relationships.set(id, { target, external: attr(relationship, "TargetMode") === "External" });
  }
  return relationships;
}

async function readStyles(zip: JSZip): Promise<Map<string, StyleInfo>> {
  const styles = new Map<string, StyleInfo>();
  const xml = await readZipText(zip, "word/styles.xml");
  if (!xml) return styles;
  for (const style of descendants(parseXml(xml).documentElement, "style")) {
    const id = attr(style, "styleId");
    if (!id) continue;
    const name = (attr(child(style, "name"), "val") || "").toLowerCase();
    const outline = attr(child(child(style, "pPr"), "outlineLvl"), "val");
    let headingLevel: number | undefined;
    const headingMatch = /^heading\s*(\d)$/.exec(name);
    if (headingMatch) headingLevel = Number(headingMatch[1]);
    else if (name === "title") headingLevel = 1;
    else if (outline !== undefined && Number(outline) < 6) headingLevel = Number(outline) + 1;
    styles.set(id, { headingLevel, basedOn: attr(child(style, "basedOn"), "val") });
  }
  return styles;
}

async function readNumbering(zip: JSZip): Promise<Map<string, Map<number, string>>> {
  const formats = new Map<string, Map<number, string>>();
  const xml = await readZipText(zip, "word/numbering.xml");
  if (!xml) return formats;
  const root = parseXml(xml).documentElement;
  const abstractFormats = new Map<string, Map<number, string>>();
  for (const abstract of children(root, "abstractNum")) {
    const levels = new Map<number, string>();
    for (const level of children(abstract, "lvl")) {
      levels.set(Number(attr(level, "ilvl") || 0), attr(child(level, "numFmt"), "val") || "bullet");
    }
    const id = attr(abstract, "abstractNumId");
    if (id) abstractFormats.set(id, levels);
  }
  for (const num of children(root, "num")) {
    const id = attr(num, "numId");
    const abstractId = attr(child(num, "abstractNumId"), "val");
    if (id && abstractId && abstractFormats.has(abstractId)) formats.set(id, abstractFormats.get(abstractId)!);
  }
  return formats;
}

async function readNotes(zip: JSZip, name: string, localName: string): Promise<Map<string, Element>> {
  const notes = new Map<string, Element>();
  const xml = await readZipText(zip, name);
  if (!xml) return notes;
  for (const note of children(parseXml(xml).documentElement, localName)) {
    const id = attr(note, "id");
    const type = attr(note, "type");
    if (id && (!type || type === "normal")) notes.set(id, note);
  }
  return notes;
}

async function readCoreMetadata(zip: JSZip): Promise<Partial<LyceumBookMetadata>> {
  const xml = await readZipText(zip, "docProps/core.xml");
  if (!xml) return {};
  const root = parseXml(xml).documentElement;
  const text = (localName: string) => descendants(root, localName)[0]?.textContent?.trim() || undefined;
  return {
    title: text("title"),
    author: text("creator"),
    description: text("description"),
    subject: text("subject"),
    language: text("language"),
    publishDate: text("created")?.slice(0, 10),
  };
}

function headingLevel(paragraph: Element, context: DocxContext): number | undefined {
  const properties = child(paragraph, "pPr");
  const outline = attr(child(properties, "outlineLvl"), "val");
  if (outline !== undefined && Number(outline) < 6) return Number(outline) + 1;
  let styleId = attr(child(properties, "pStyle"), "val");
  for (let depth = 0; styleId && depth < 8; depth += 1) {
    const style = context.styles.get(styleId);
    if (!style) break;
    if (style.headingLevel) return style.headingLevel;
    styleId = style.basedOn;
  }
  if (styleId && /^heading(\d)$/i.test(styleId)) return Number(/\d/.exec(styleId)![0]);
  return undefined;
}

async function resolveImage(relationshipId: string | undefined, context: DocxContext): Promise<AssembledResource | null> {
  if (!relationshipId) return null;
  const relationship = context.relationships.get(relationshipId);
  if (!relationship || relationship.external) return null;
  const zipPath = path.posix.normalize(path.posix.join("word", relationship.target)).replace(/^\/+/, "");
  const known = context.imageByTarget.get(zipPath);
  if (known) return known;
  const file = context.zip.file(zipPath);
  if (!file) return null;
  const data = await file.async("uint8array");
  const type = imageMediaType(data);
  if (!type) return null;
  const resource: AssembledResource = {
    href: `images/docx-${String(context.resources.length + 1).padStart(4, "0")}.${type.extension}`,
    mediaType: type.mediaType,
    data,
  };
  context.resources.push(resource);
  context.imageByTarget.set(zipPath, resource);
  return resource;
}

function wrapRun(html: string, properties: Element | undefined) {
  if (!properties || !html) return html;
  const enabled = (localName: string) => {
    const element = child(properties, localName);
    if (!element) return false;
    const value = attr(element, "val");
    return value !== "0" && value !== "false" && value !== "none";
  };
  let result = html;
  const vertical = attr(child(properties, "vertAlign"), "val");
  if (vertical === "superscript") result = `<sup>${result}</sup>`;
  if (vertical === "subscript") result = `<sub>${result}</sub>`;
  if (enabled("strike") || enabled("dstrike")) result = `<s>${result}</s>`;
  if (enabled("u")) result = `<u>${result}</u>`;
  if (enabled("i")) result = `<em>${result}</em>`;
  if (enabled("b")) result = `<strong>${result}</strong>`;
  return result;
}

async function renderNoteReference(kind: "footnote" | "endnote", id: string | undefined, context: DocxContext) {
  if (!id) return "";
  const source = kind === "footnote" ? context.footnotes : context.endnotes;
  const note = source.get(id);
  if (!note) return "";
  const key = `${kind}-${id}`;
  let number = context.noteNumbers.get(key);
  if (number === undefined) {
    number = context.noteNumbers.size + 1;
    context.noteNumbers.set(key, number);
    const blocks = await renderBlocks(children(note), context);
    context.notes.push({ kind, id, number, html: blocks.map((block) => block.html).join("") });
  }
  return `<sup><a id="ref-${key}" href="#note-${key}">${number}</a></sup>`;
}

async function renderInline(nodes: Element[], context: DocxContext): Promise<string> {
  let html = "";
  for (const node of nodes) {
    switch (node.localName) {
      case "r": {
        let runHtml = "";
        for (const item of children(node)) {
          switch (item.localName) {
            case "t":
            case "delText":
              if (item.localName === "t") runHtml += escapeXml(item.textContent || "");
              break;
            case "tab":
              runHtml += " ";
              break;
            case "br":
            case "cr":
              if (attr(item, "type") !== "page") runHtml += "<br />";
              break;
            case "noBreakHyphen":
              runHtml += "‑";
              break;
            case "drawing":
            case "pict":
            case "object": {
              const blip = descendants(item, "blip")[0];
              const imageData = descendants(item, "imagedata")[0];
              const image = await resolveImage(attr(blip, "embed") || attr(imageData, "id"), context);
              if (image) {
                const description = attr(descendants(item, "docPr")[0], "descr") || "";
                runHtml += `<img src="../${image.href}" alt="${escapeXml(description)}" />`;
              }
              break;
            }
            case "footnoteReference":
              runHtml += await renderNoteReference("footnote", attr(item, "id"), context);
              break;
            case "endnoteReference":
              runHtml += await renderNoteReference("endnote", attr(item, "id"), context);
              break;
            default:
              break;
          }
        }
        html += wrapRun(runHtml, child(node, "rPr"));
        break;
      }
      case "hyperlink": {
        const inner = await renderInline(children(node), context);
        const relationship = context.relationships.get(attr(node, "id") || "");
        const anchor = attr(node, "anchor");
        const href = relationship?.external ? relationship.target : anchor ? `#${anchor}` : "";
        html += href ? `<a href="${escapeXml(href)}">${inner}</a>` : inner;
        break;
      }
      case "bookmarkStart": {
        const name = attr(node, "name");
        if (name && name !== "_GoBack") html += `<a id="${escapeXml(name)}"></a>`;
        break;
      }
      case "ins":
      case "smartTag":
      case "fldSimple":
      case "customXml":
        html += await renderInline(children(node), context);
        break;
      case "sdt":
        html += await renderInline(children(child(node, "sdtContent")), context);
        break;
      default:
        break;
    }
  }
  return html;
}

function paragraphListInfo(paragraph: Element, context: DocxContext) {
  const numbering = child(child(paragraph, "pPr"), "numPr");
  if (!numbering) return null;
  const numId = attr(child(numbering, "numId"), "val");
  if (!numId || numId === "0") return null;
  const level = Number(attr(child(numbering, "ilvl"), "val") || 0);
  const format = context.numberingFormats.get(numId)?.get(level) || "bullet";
  return { level, ordered: format !== "bullet" && format !== "none" };
}

async function renderTable(table: Element, context: DocxContext): Promise<string> {
  const rows: string[] = [];
  for (const row of children(table, "tr")) {
    const cells: string[] = [];
    for (const cell of children(row, "tc")) {
      const span = Number(attr(child(child(cell, "tcPr"), "gridSpan"), "val") || 1);
      const blocks = await renderBlocks(children(cell), context);
      cells.push(`<td${span > 1 ? ` colspan="${span}"` : ""}>${blocks.map((block) => block.html).join("")}</td>`);
    }
    rows.push(`<tr>${cells.join("")}</tr>`);
  }
  return `<table>${rows.join("")}</table>`;
}

async function renderBlocks(nodes: Element[], context: DocxContext): Promise<Block[]> {
  const blocks: Block[] = [];
  const listStack: Array<{ ordered: boolean }> = [];
  let listHtml = "";
  const closeLists = (targetDepth: number) => {
    while (listStack.length > targetDepth) {
      const list = listStack.pop()!;
      listHtml += `</li></${list.ordered ? "ol" : "ul"}>`;
    }
    if (listStack.length === 0 && listHtml) {
      blocks.push({ html: listHtml });
      listHtml = "";
    }
  };

  for (const node of nodes) {
    if (node.localName === "p") {
      const list = paragraphListInfo(node, context);
      const inner = await renderInline(children(node), context);
      if (list) {
        const depth = list.level + 1;
        if (listStack.length > depth) closeLists(depth);
        if (listStack.length === depth) {
          listHtml += `</li><li>${inner}`;
        } else {
          while (listStack.length < depth) {
            const ordered = list.ordered;
            listHtml += `<${ordered ? "ol" : "ul"}><li>`;
            listStack.push({ ordered });
          }
          listHtml += inner;
        }
        continue;
      }
      closeLists(0);
      const level = headingLevel(node, context);
      if (level) {
        const tag = `h${Math.min(level, 6)}`;
        blocks.push({
          html: `<${tag}>${inner}</${tag}>`,
          headingLevel: level,
          headingText: node.textContent?.trim() || undefined,
        });
      } else {
        blocks.push({ html: inner.trim() ? `<p>${inner}</p>` : "" });
      }
    } else if (node.localName === "tbl") {
      closeLists(0);
      blocks.push({ html: await renderTable(node, context) });
    } else if (node.localName === "sdt") {
      closeLists(0);
      blocks.push(...await renderBlocks(children(child(node, "sdtContent")), context));
    }
  }
  closeLists(0);
  return blocks.filter((block) => block.html);
}

function splitChapters(blocks: Block[]): AssembledChapter[] {
  const levels = blocks.map((block) => block.headingLevel).filter((level): level is number => Boolean(level));
  if (levels.length === 0) return [{ html: blocks.map((block) => block.html).join("\n") }];
  const splitLevel = Math.min(...levels);
  const chapters: Array<{ title?: string; parts: string[] }> = [];
  for (const block of blocks) {
    if (block.headingLevel === splitLevel || chapters.length === 0) {
      chapters.push({ title: block.headingLevel === splitLevel ? block.headingText : undefined, parts: [] });
    }
    chapters[chapters.length - 1].parts.push(block.html);
  }
  return chapters.map((chapter) => ({ title: chapter.title, html: chapter.parts.join("\n") }));
}

export class DocxImporter implements LyceumImporter {
  inputFormat = "docx" as const;

  async import(input: ImportInput): Promise<ImportResult> {
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(await fs.promises.readFile(input.sourcePath));
    } catch {
      throw new LyceumImportError("corrupt", "DOCX invalido ou corrompido.");
    }
    const documentXml = await readZipText(zip, "word/document.xml");
    if (!documentXml) throw new LyceumImportError("corrupt", "DOCX sem word/document.xml.");
    input.onProgress?.(0.1, "Lendo documento Word");

    const context: DocxContext = {
      zip,
      relationships: await readRelationships(zip),
      styles: await readStyles(zip),
      numberingFormats: await readNumbering(zip),
      resources: [],
      imageByTarget: new Map(),
      noteNumbers: new Map(),
      notes: [],
      footnotes: await readNotes(zip, "word/footnotes.xml", "footnote"),
      endnotes: await readNotes(zip, "word/endnotes.xml", "endnote"),
    };
    const body = descendants(parseXml(documentXml).documentElement, "body")[0];
    const blocks = await renderBlocks(children(body), context);
    input.onProgress?.(0.6, "Montando capitulos");

    const chapters = splitChapters(blocks);
    if (context.notes.length > 0) {
      chapters.push({
        title: "Notas",
        html: `<h1>Notas</h1>${context.notes.map((note) => {
          const key = `${note.kind}-${note.id}`;
          return `<div class="note" id="note-${key}"><p><a href="#ref-${key}">${note.number}.</a></p>${note.html}</div>`;
        }).join("")}`,
      });
    }

    return writeAssembledBook(input, "docx", {
      metadata: await readCoreMetadata(zip),
      chapters,
      resources: context.resources,
      stats: { noteCount: context.notes.length },
    });
  }
}
