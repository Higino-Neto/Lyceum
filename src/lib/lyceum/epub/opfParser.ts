import type { LyceumBookMetadata } from "../schema/types";
import { decodeHtmlEntities, stripHtml } from "../textual";
import { parseXmlDocument } from "./containerParser";

export interface ParsedOpfManifestItem {
  id: string;
  href: string;
  mediaType: string;
  properties: string;
  fallback?: string;
}

export interface ParsedOpfSpineItem {
  idref: string;
  linear: boolean;
}

export interface ParsedOpfGuideReference {
  type: string;
  href: string;
  title?: string;
}

export interface ParsedOpfIdentifier {
  id?: string;
  value: string;
  scheme?: string;
}

export interface ParsedOpf {
  metadata: Partial<LyceumBookMetadata>;
  identifiers: ParsedOpfIdentifier[];
  primaryIdentifier?: string;
  manifest: Map<string, ParsedOpfManifestItem>;
  spine: ParsedOpfSpineItem[];
  guide: ParsedOpfGuideReference[];
  navItemIds: string[];
  ncxItemIds: string[];
  metaCoverId?: string;
  warnings: string[];
}

const DC_NAMESPACE = "http://purl.org/dc/elements/1.1/";

function directChildrenByLocalName(element: Element | Document, localName: string) {
  return Array.from(element.children).filter((child) => child.localName === localName) as Element[];
}

function descendantsByLocalName(element: Element | Document, localName: string) {
  return Array.from(element.querySelectorAll("*")).filter((child) => child.localName === localName) as Element[];
}

function firstDirectChild(element: Element | Document, localName: string) {
  return directChildrenByLocalName(element, localName)[0] || null;
}

function cleanText(value: string | null | undefined) {
  return decodeHtmlEntities(stripHtml(value || "")).replace(/\s+/g, " ").trim();
}

function attr(element: Element | undefined | null, name: string) {
  return element?.getAttribute(name) || undefined;
}

function metaProperty(element: Element) {
  return attr(element, "property") || attr(element, "name") || "";
}

function metaValue(element: Element) {
  return attr(element, "content") || cleanText(element.textContent);
}

function normalizeRefines(value?: string) {
  return value?.replace(/^#/, "") || "";
}

function metadataChildren(metadataElement: Element | null) {
  return metadataElement ? Array.from(metadataElement.children) as Element[] : [];
}

function dcElements(metadataElement: Element | null, localName: string) {
  return metadataChildren(metadataElement).filter((element) => (
    element.localName === localName && (!element.namespaceURI || element.namespaceURI === DC_NAMESPACE || element.prefix)
  ));
}

function firstDc(metadataElement: Element | null, localName: string) {
  return cleanText(dcElements(metadataElement, localName)[0]?.textContent) || undefined;
}

function allDc(metadataElement: Element | null, localName: string) {
  return dcElements(metadataElement, localName)
    .map((element) => cleanText(element.textContent))
    .filter(Boolean);
}

function collectRefinements(metadataElement: Element | null) {
  const refinements = new Map<string, Map<string, string[]>>();

  for (const element of metadataChildren(metadataElement)) {
    if (element.localName !== "meta") continue;
    const refines = normalizeRefines(attr(element, "refines"));
    const property = metaProperty(element);
    const value = metaValue(element);
    if (!refines || !property || !value) continue;

    const byProperty = refinements.get(refines) || new Map<string, string[]>();
    byProperty.set(property, [...(byProperty.get(property) || []), value]);
    refinements.set(refines, byProperty);
  }

  return refinements;
}

function firstRefinement(refinements: Map<string, Map<string, string[]>>, id: string | undefined, property: string) {
  return id ? refinements.get(id)?.get(property)?.[0] : undefined;
}

function firstMeta(metadataElement: Element | null, names: string[]) {
  const lowerNames = new Set(names.map((name) => name.toLowerCase()));
  for (const element of metadataChildren(metadataElement)) {
    if (element.localName !== "meta") continue;
    const property = metaProperty(element).toLowerCase();
    const name = attr(element, "name")?.toLowerCase();
    if ((property && lowerNames.has(property)) || (name && lowerNames.has(name))) {
      const value = metaValue(element);
      if (value) return value;
    }
  }
  return undefined;
}

function parseIdentifiers(metadataElement: Element | null, refinements: Map<string, Map<string, string[]>>) {
  return dcElements(metadataElement, "identifier").map<ParsedOpfIdentifier>((element) => ({
    id: attr(element, "id"),
    value: cleanText(element.textContent),
    scheme: attr(element, "opf:scheme") || attr(element, "scheme") || firstRefinement(refinements, attr(element, "id"), "identifier-type"),
  })).filter((identifier) => Boolean(identifier.value));
}

function parseManifest(packageElement: Element): Map<string, ParsedOpfManifestItem> {
  const manifest = new Map<string, ParsedOpfManifestItem>();
  const manifestElement = firstDirectChild(packageElement, "manifest");
  for (const item of directChildrenByLocalName(manifestElement || packageElement, "item")) {
    const id = attr(item, "id");
    const href = attr(item, "href");
    if (!id || !href) continue;
    manifest.set(id, {
      id,
      href,
      mediaType: attr(item, "media-type") || "",
      properties: attr(item, "properties") || "",
      fallback: attr(item, "fallback"),
    });
  }
  return manifest;
}

function parseSpine(packageElement: Element): ParsedOpfSpineItem[] {
  const spineElement = firstDirectChild(packageElement, "spine");
  if (!spineElement) return [];
  return directChildrenByLocalName(spineElement, "itemref")
    .map((itemref) => ({
      idref: attr(itemref, "idref") || "",
      linear: (attr(itemref, "linear") || "yes").toLowerCase() !== "no",
    }))
    .filter((item) => Boolean(item.idref));
}

function parseGuide(packageElement: Element): ParsedOpfGuideReference[] {
  const guideElement = firstDirectChild(packageElement, "guide");
  if (!guideElement) return [];
  return directChildrenByLocalName(guideElement, "reference")
    .map((reference) => ({
      type: attr(reference, "type") || "",
      href: attr(reference, "href") || "",
      title: attr(reference, "title"),
    }))
    .filter((reference) => Boolean(reference.type && reference.href));
}

function joinValues(values: string[]) {
  return values.length ? values.join("; ") : undefined;
}

function parseRating(value?: string) {
  if (!value) return undefined;
  const rating = Number(value);
  return Number.isFinite(rating) ? rating : undefined;
}

export function parseOpfDocument(opfXml: string): ParsedOpf {
  const document = parseXmlDocument(opfXml, "OPF");
  const packageElement = document.documentElement;
  if (!packageElement || packageElement.localName !== "package") {
    throw new Error("OPF invalido: elemento package ausente.");
  }

  const warnings: string[] = [];
  const metadataElement = firstDirectChild(packageElement, "metadata");
  const refinements = collectRefinements(metadataElement);
  const identifiers = parseIdentifiers(metadataElement, refinements);
  const uniqueIdentifierId = attr(packageElement, "unique-identifier");
  const primaryIdentifier = (
    identifiers.find((identifier) => identifier.id === uniqueIdentifierId)
    || identifiers[0]
  )?.value;
  const isbn = identifiers.find((identifier) => {
    const scheme = identifier.scheme?.toLowerCase() || "";
    return scheme.includes("isbn") || /^(?:urn:isbn:)?97[89][0-9-]{10,}$/i.test(identifier.value);
  })?.value;

  const titleElements = dcElements(metadataElement, "title");
  const primaryTitle = titleElements
    .sort((a, b) => Number(firstRefinement(refinements, attr(a, "id"), "display-seq") || 999) - Number(firstRefinement(refinements, attr(b, "id"), "display-seq") || 999))
    .find((title) => firstRefinement(refinements, attr(title, "id"), "title-type") !== "subtitle")
    || titleElements[0];
  const creatorElements = dcElements(metadataElement, "creator");
  const firstCreator = creatorElements[0];
  const subjects = allDc(metadataElement, "subject");
  const titleId = attr(primaryTitle, "id");
  const creatorId = attr(firstCreator, "id");
  const series = firstMeta(metadataElement, ["calibre:series", "belongs-to-collection"]);
  const seriesIndex = firstMeta(metadataElement, ["calibre:series_index", "group-position"]);

  const manifest = parseManifest(packageElement);
  const navItemIds = [...manifest.values()]
    .filter((item) => item.properties.split(/\s+/).includes("nav"))
    .map((item) => item.id);
  const ncxItemIds = [...manifest.values()]
    .filter((item) => /\.ncx$/i.test(item.href) || /application\/x-dtbncx\+xml/i.test(item.mediaType))
    .map((item) => item.id);

  const metaCoverId = firstMeta(metadataElement, ["cover"]);
  if (!metadataElement) warnings.push("OPF sem metadata; usando metadados inferidos pelo Lyceum.");

  return {
    metadata: {
      title: cleanText(primaryTitle?.textContent) || undefined,
      author: joinValues(creatorElements.map((element) => cleanText(element.textContent)).filter(Boolean)),
      language: firstDc(metadataElement, "language"),
      identifier: primaryIdentifier,
      publisher: firstDc(metadataElement, "publisher"),
      description: firstDc(metadataElement, "description"),
      publishDate: firstDc(metadataElement, "date") || firstMeta(metadataElement, ["dcterms:modified", "modified"]),
      subject: joinValues(subjects),
      rights: firstDc(metadataElement, "rights"),
      contributor: joinValues(allDc(metadataElement, "contributor")),
      series,
      seriesIndex,
      groupPosition: firstMeta(metadataElement, ["group-position"]) || seriesIndex,
      displaySeq: firstRefinement(refinements, titleId, "display-seq"),
      authorSort: firstMeta(metadataElement, ["calibre:author_sort", "author_sort"]) || firstRefinement(refinements, creatorId, "file-as"),
      titleSort: firstMeta(metadataElement, ["calibre:title_sort", "title_sort"]) || firstRefinement(refinements, titleId, "file-as"),
      isbn,
      asin: firstMeta(metadataElement, ["amazon:asin", "mobi-asin"]),
      rating: parseRating(firstMeta(metadataElement, ["calibre:rating"])),
      timestamp: firstMeta(metadataElement, ["calibre:timestamp"]),
    },
    identifiers,
    primaryIdentifier,
    manifest,
    spine: parseSpine(packageElement),
    guide: parseGuide(packageElement),
    navItemIds,
    ncxItemIds,
    metaCoverId,
    warnings,
  };
}

export function hasManifestProperty(item: ParsedOpfManifestItem, property: string) {
  return item.properties.split(/\s+/).includes(property);
}

export function isContentDocument(item: ParsedOpfManifestItem) {
  return /xhtml|html/i.test(item.mediaType) || /\.(xhtml|html?)$/i.test(item.href.split(/[?#]/)[0]);
}

export function isNavigationDocument(item: ParsedOpfManifestItem) {
  return hasManifestProperty(item, "nav") || /(^|\/)(toc|nav|navigation)\.(xhtml|html?)$/i.test(item.href.split(/[?#]/)[0]);
}

export function isNcxDocument(item: ParsedOpfManifestItem) {
  return /\.ncx$/i.test(item.href.split(/[?#]/)[0]) || /application\/x-dtbncx\+xml/i.test(item.mediaType);
}

export function allElementsByLocalName(element: Element | Document, localName: string) {
  return descendantsByLocalName(element, localName);
}
