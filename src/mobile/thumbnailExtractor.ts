import JSZip, { type JSZipObject } from "jszip";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import type { MobileFileType } from "./types";

const THUMBNAIL_WIDTH = 420;
const THUMBNAIL_HEIGHT = 630;

type ManifestItem = {
  id: string;
  href: string;
  mediaType: string;
  properties: string;
};

function stripFragment(value: string) {
  return value.split("#")[0];
}

function normalizeZipPath(value: string) {
  const parts: string[] = [];
  value.replace(/\\/g, "/").split("/").forEach((part) => {
    if (!part || part === ".") return;
    if (part === "..") {
      parts.pop();
      return;
    }
    parts.push(part);
  });
  return parts.join("/");
}

function dirname(value: string) {
  const normalized = normalizeZipPath(value);
  const index = normalized.lastIndexOf("/");
  return index >= 0 ? normalized.slice(0, index) : "";
}

function resolveZipPath(baseDirectory: string, href: string) {
  const cleanHref = stripFragment(href);
  const decodedHref = decodeURIComponent(cleanHref);
  return normalizeZipPath(baseDirectory ? `${baseDirectory}/${decodedHref}` : decodedHref);
}

function localName(element: Element) {
  return element.localName || element.nodeName.split(":").pop() || element.nodeName;
}

function getElementsByLocalName(root: ParentNode, name: string) {
  return Array.from(root.querySelectorAll("*")).filter((element) => localName(element) === name);
}

function getZipEntry(zip: JSZip, entryPath: string): JSZipObject | null {
  const normalized = normalizeZipPath(entryPath);
  return (
    zip.file(normalized) ||
    zip.file(encodeURI(normalized)) ||
    Object.values(zip.files).find((entry) => normalizeZipPath(entry.name).toLowerCase() === normalized.toLowerCase()) ||
    null
  );
}

function inferMime(path: string) {
  const extension = path.split(".").pop()?.toLowerCase();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "gif") return "image/gif";
  if (extension === "webp") return "image/webp";
  if (extension === "svg") return "image/svg+xml";
  return "image/jpeg";
}

function dataUrlToArrayBuffer(dataUrl: string) {
  return fetch(dataUrl).then((response) => response.arrayBuffer());
}

function loadImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Nao foi possivel ler a imagem da capa"));
    image.src = dataUrl;
  });
}

async function fitImageToThumbnail(dataUrl: string) {
  try {
    const image = await loadImage(dataUrl);
    const canvas = document.createElement("canvas");
    canvas.width = THUMBNAIL_WIDTH;
    canvas.height = THUMBNAIL_HEIGHT;

    const context = canvas.getContext("2d");
    if (!context) return dataUrl;

    context.fillStyle = "#111114";
    context.fillRect(0, 0, canvas.width, canvas.height);

    const scale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    const x = (canvas.width - width) / 2;
    const y = (canvas.height - height) / 2;
    context.drawImage(image, x, y, width, height);

    return canvas.toDataURL("image/jpeg", 0.86);
  } catch {
    return dataUrl;
  }
}

async function extractPdfThumbnail(buffer: ArrayBuffer) {
  const pdfjs = await import("pdfjs-dist/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    cMapPacked: true,
    disableFontFace: true,
  });

  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(1);
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = Math.min(THUMBNAIL_WIDTH / baseViewport.width, THUMBNAIL_HEIGHT / baseViewport.height) * 2;
  const viewport = page.getViewport({ scale });
  const renderCanvas = document.createElement("canvas");
  renderCanvas.width = Math.max(1, Math.floor(viewport.width));
  renderCanvas.height = Math.max(1, Math.floor(viewport.height));
  const context = renderCanvas.getContext("2d");
  if (!context) return undefined;

  await page.render({ canvasContext: context, viewport }).promise;
  const pageDataUrl = renderCanvas.toDataURL("image/jpeg", 0.9);
  return fitImageToThumbnail(pageDataUrl);
}

function readManifestItems(opfDocument: Document) {
  return getElementsByLocalName(opfDocument, "item").map((element): ManifestItem => ({
    id: element.getAttribute("id") || "",
    href: element.getAttribute("href") || "",
    mediaType: element.getAttribute("media-type") || "",
    properties: element.getAttribute("properties") || "",
  })).filter((item) => item.id && item.href);
}

function getMetaCoverId(opfDocument: Document) {
  const meta = getElementsByLocalName(opfDocument, "meta").find((element) =>
    (element.getAttribute("name") || "").toLowerCase() === "cover" && element.getAttribute("content"),
  );
  return meta?.getAttribute("content") || undefined;
}

function getGuideCoverHref(opfDocument: Document) {
  const reference = getElementsByLocalName(opfDocument, "reference").find((element) =>
    (element.getAttribute("type") || "").toLowerCase() === "cover" && element.getAttribute("href"),
  );
  return reference?.getAttribute("href") || undefined;
}

function getImageHrefFromHtml(html: string) {
  const document = new DOMParser().parseFromString(html, "text/html");
  const image =
    document.querySelector("img[src]") ||
    document.querySelector("image[href]") ||
    document.querySelector("image[xlink\\:href]");
  const src = image?.getAttribute("src") || image?.getAttribute("href") || image?.getAttribute("xlink:href");
  if (src) return src;

  const source = document.querySelector("source[srcset]");
  return source?.getAttribute("srcset")?.split(",")[0]?.trim().split(/\s+/)[0];
}

async function resolveCoverPageImage(zip: JSZip, opfDirectory: string, coverPageHref: string) {
  const pagePath = resolveZipPath(opfDirectory, coverPageHref);
  const pageEntry = getZipEntry(zip, pagePath);
  if (!pageEntry) return undefined;

  const html = await pageEntry.async("text");
  const imageHref = getImageHrefFromHtml(html);
  return imageHref ? resolveZipPath(dirname(pagePath), imageHref) : undefined;
}

async function extractEpubThumbnail(buffer: ArrayBuffer) {
  const zip = await JSZip.loadAsync(buffer);
  const containerEntry = getZipEntry(zip, "META-INF/container.xml");
  if (!containerEntry) return undefined;

  const containerXml = await containerEntry.async("text");
  const containerDocument = new DOMParser().parseFromString(containerXml, "application/xml");
  const rootfile = getElementsByLocalName(containerDocument, "rootfile")[0];
  const opfPath = rootfile?.getAttribute("full-path");
  if (!opfPath) return undefined;

  const opfEntry = getZipEntry(zip, opfPath);
  if (!opfEntry) return undefined;

  const opfText = await opfEntry.async("text");
  const opfDocument = new DOMParser().parseFromString(opfText, "application/xml");
  const opfDirectory = dirname(opfPath);
  const manifest = readManifestItems(opfDocument);

  const metaCoverId = getMetaCoverId(opfDocument);
  let coverItem =
    manifest.find((item) => item.id === metaCoverId) ||
    manifest.find((item) => item.properties.split(/\s+/).includes("cover-image"));

  if (!coverItem) {
    const guideCoverHref = getGuideCoverHref(opfDocument);
    const imagePath = guideCoverHref ? await resolveCoverPageImage(zip, opfDirectory, guideCoverHref) : undefined;
    coverItem = imagePath
      ? manifest.find((item) => resolveZipPath(opfDirectory, item.href) === imagePath)
      : undefined;

    if (!coverItem && imagePath) {
      const entry = getZipEntry(zip, imagePath);
      if (entry) {
        const data = await entry.async("base64");
        return fitImageToThumbnail(`data:${inferMime(imagePath)};base64,${data}`);
      }
    }
  }

  coverItem ??= manifest.find((item) => item.mediaType.startsWith("image/"));
  if (!coverItem) return undefined;

  const coverPath = resolveZipPath(opfDirectory, coverItem.href);
  const coverEntry = getZipEntry(zip, coverPath);
  if (!coverEntry) return undefined;

  const data = await coverEntry.async("base64");
  const mime = coverItem.mediaType || inferMime(coverPath);
  return fitImageToThumbnail(`data:${mime};base64,${data}`);
}

export async function extractThumbnailFromFile(file: File, fileType: MobileFileType) {
  if (fileType !== "pdf" && fileType !== "epub") return undefined;
  const buffer = await file.arrayBuffer();
  return fileType === "pdf" ? extractPdfThumbnail(buffer) : extractEpubThumbnail(buffer);
}

export async function extractThumbnailFromDataUrl(dataUrl: string, fileType: MobileFileType) {
  if (fileType !== "pdf" && fileType !== "epub") return undefined;
  const buffer = await dataUrlToArrayBuffer(dataUrl);
  return fileType === "pdf" ? extractPdfThumbnail(buffer) : extractEpubThumbnail(buffer);
}
