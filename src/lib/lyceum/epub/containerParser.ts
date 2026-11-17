import { JSDOM } from "jsdom";
import { decodeTextBytes } from "./textDecoding";

export { decodeTextBytes };

export interface ParsedEpubContainer {
  opfPath: string;
  warnings: string[];
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
