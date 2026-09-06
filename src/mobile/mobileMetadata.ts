import JSZip from "jszip";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import type { MobileBook } from "./types";
export async function extractMobileMetadata(file: File, type: MobileBook["fileType"]): Promise<Partial<MobileBook>> {
  if (type === "epub") {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const parser = new DOMParser();
    const container = parser.parseFromString(await zip.file("META-INF/container.xml")?.async("string") || "", "application/xml");
    const path = container.getElementsByTagNameNS("*", "rootfile")[0]?.getAttribute("full-path");
    if (!path) return {};
    const opf = parser.parseFromString(await zip.file(path)?.async("string") || "", "application/xml");
    const values = (name: string) => [...opf.getElementsByTagNameNS("http://purl.org/dc/elements/1.1/", name)].map(el => el.textContent?.trim() || "").filter(Boolean);
    const meta = [...opf.getElementsByTagNameNS("*", "meta")];
    const seriesName = meta.find(el => el.getAttribute("name") === "calibre:series")?.getAttribute("content") || meta.find(el => el.getAttribute("property") === "belongs-to-collection")?.textContent || undefined;
    const index = meta.find(el => el.getAttribute("name") === "calibre:series_index")?.getAttribute("content") || meta.find(el => el.getAttribute("property") === "group-position")?.textContent;
    return { ...(values("title")[0] ? { title: values("title")[0] } : {}), author: values("creator").join(", ") || undefined, language: values("language")[0], publisher: values("publisher")[0], description: values("description")[0], publishDate: values("date")[0], isbn: values("identifier").find(id => /^(?:urn:isbn:)?[\dX-]{10,17}$/i.test(id))?.replace(/^urn:isbn:/i, ""), seriesName, seriesIndex: index && Number.isFinite(Number(index)) ? Number(index) : undefined };
  }
  if (type === "pdf") {
    const pdfjs = await import("pdfjs-dist"); pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false });
    task.onPassword = () => { void task.destroy(); };
    try { const doc = await task.promise; const result = await doc.getMetadata(); const info = result.info as Record<string, unknown>; return { ...(typeof info.Title === "string" && info.Title.trim() ? { title: info.Title.trim() } : {}), author: typeof info.Author === "string" ? info.Author : undefined, totalPages: doc.numPages }; } finally { await task.destroy(); }
  }
  return {};
}
