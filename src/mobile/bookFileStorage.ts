import { Directory, Filesystem } from "@capacitor/filesystem";
import type { MobileBook } from "./types";

const BOOKS_DIR = "lyceum-books";

function safePathPart(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "book";
}

function extensionFor(book: Pick<MobileBook, "fileName" | "fileType">) {
  const match = book.fileName.match(/\.([a-z0-9]+)$/i);
  if (match?.[1]) return match[1].toLowerCase();
  return book.fileType;
}

function folderPart(folderId?: string) {
  return folderId ? safePathPart(folderId) : "root";
}

function storagePathFor(book: Pick<MobileBook, "id" | "fileName" | "fileType" | "folderId">, folderId = book.folderId) {
  return `${BOOKS_DIR}/${folderPart(folderId)}/${safePathPart(book.id)}.${extensionFor(book)}`;
}

function mimeFor(book: Pick<MobileBook, "fileType" | "mimeType">) {
  if (book.mimeType) return book.mimeType;
  if (book.fileType === "pdf") return "application/pdf";
  if (book.fileType === "epub") return "application/epub+zip";
  if (book.fileType === "txt") return "text/plain";
  return "application/octet-stream";
}

function splitDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;,]+)?(?:;[^,]*)?,(.*)$/);
  return {
    mimeType: match?.[1] || "application/octet-stream",
    data: match?.[2] || "",
  };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Falha ao ler arquivo salvo"));
    reader.readAsDataURL(blob);
  });
}

export async function writeMobileBookFile(book: MobileBook, dataUrl: string, folderId = book.folderId) {
  const { data } = splitDataUrl(dataUrl);
  if (!data) throw new Error("O arquivo importado esta vazio");
  const path = storagePathFor(book, folderId);

  await Filesystem.mkdir({
    path: `${BOOKS_DIR}/${folderPart(folderId)}`,
    directory: Directory.Data,
    recursive: true,
  }).catch(() => undefined);

  await Filesystem.writeFile({
    path,
    directory: Directory.Data,
    data,
  });

  return path;
}

export async function moveMobileBookFile(book: MobileBook, folderId?: string) {
  if (!book.storagePath) return undefined;
  const nextPath = storagePathFor(book, folderId);
  if (nextPath === book.storagePath) return nextPath;

  await Filesystem.mkdir({
    path: `${BOOKS_DIR}/${folderPart(folderId)}`,
    directory: Directory.Data,
    recursive: true,
  }).catch(() => undefined);

  await Filesystem.rename({
    from: book.storagePath,
    to: nextPath,
    directory: Directory.Data,
    toDirectory: Directory.Data,
  });
  return nextPath;
}

export async function deleteMobileBookFile(book?: MobileBook | null) {
  if (!book?.storagePath) return;
  await Filesystem.deleteFile({
    path: book.storagePath,
    directory: Directory.Data,
  }).catch(() => undefined);
}

export async function resolveMobileBookDataUrl(book?: MobileBook | null) {
  if (!book) return undefined;
  if (book.dataUrl) return book.dataUrl;
  if (!book.storagePath) return undefined;

  const result = await Filesystem.readFile({
    path: book.storagePath,
    directory: Directory.Data,
  });
  if (result.data instanceof Blob) {
    return blobToDataUrl(result.data);
  }

  const data = typeof result.data === "string" ? result.data : "";
  if (!data) return undefined;

  return `data:${mimeFor(book)};base64,${data}`;
}

export function getStoredBookPatch(book: MobileBook, file: File, dataUrl: string, storagePath?: string): Partial<MobileBook> {
  const { mimeType } = splitDataUrl(dataUrl);
  return {
    fileName: file.name,
    fileType: book.fileType,
    mimeType: file.type || mimeType,
    fileSize: file.size,
    storagePath,
    dataUrl: storagePath ? undefined : dataUrl,
    updatedAt: new Date().toISOString(),
  };
}
