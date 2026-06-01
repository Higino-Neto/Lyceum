import { JSDOM } from "jsdom";

export interface ParsedEpubContainer {
  opfPath: string;
  warnings: string[];
}

function detectBomEncoding(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return "utf-8";
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return "utf-16le";
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return "utf-16be";
  }
  return null;
}

function detectDeclaredEncoding(bytes: Uint8Array): string | null {
  const asciiPrefix = Array.from(bytes.slice(0, 256))
    .map((byte) => (byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : " "))
    .join("");
  return asciiPrefix.match(/<\?xml[^>]*\bencoding\s*=\s*["']([^"']+)["']/i)?.[1] || null;
}

export function decodeTextBytes(bytes: Uint8Array | ArrayBuffer, fallback = "utf-8") {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const encoding = detectBomEncoding(data) || detectDeclaredEncoding(data) || fallback;

  try {
    return new TextDecoder(encoding, { fatal: false }).decode(data);
  } catch {
    return new TextDecoder(fallback, { fatal: false }).decode(data);
  }
}

export function parseXmlDocument(xml: string, label: string): Document {
  const dom = new JSDOM(xml, { contentType: "text/xml" });
  const document = dom.window.document;
  const parserError = document.getElementsByTagName("parsererror")[0];
  if (parserError) {
    throw new Error(`${label} invalido: ${parserError.textContent?.replace(/\s+/g, " ").trim() || "erro XML"}`);
  }
  return document;
}

function byLocalName(root: ParentNode, localName: string) {
  return Array.from(root.querySelectorAll("*")).filter((node) => node.localName === localName);
}

export function parseContainerXml(containerXml: string): ParsedEpubContainer {
  const document = parseXmlDocument(containerXml, "container.xml");
  const rootfiles = byLocalName(document, "rootfile") as Element[];
  const selected = rootfiles.find((rootfile) => {
    const mediaType = rootfile.getAttribute("media-type") || "";
    return !mediaType || mediaType === "application/oebps-package+xml";
  }) || rootfiles[0];

  const opfPath = selected?.getAttribute("full-path")?.trim();
  if (!opfPath) {
    throw new Error("EPUB invalido: OPF nao encontrado no container.xml");
  }

  return {
    opfPath: opfPath.replace(/\\/g, "/").replace(/^\/+/, ""),
    warnings: rootfiles.length > 1 ? ["container.xml possui multiplos rootfiles; usando o primeiro OPF compativel."] : [],
  };
}
