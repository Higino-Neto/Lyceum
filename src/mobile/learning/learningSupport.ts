import type { MobileBook } from "../types";

/** Mobile formats that can be read in .lyceum mode (all of them have a text layer to analyze). */
const LYCEUM_READABLE = new Set<MobileBook["fileType"]>(["epub", "txt", "pdf"]);

export function canReadAsLyceum(book: Pick<MobileBook, "fileType">): book is Pick<MobileBook, "fileType"> & { fileType: "epub" | "txt" | "pdf" } {
  return LYCEUM_READABLE.has(book.fileType);
}
