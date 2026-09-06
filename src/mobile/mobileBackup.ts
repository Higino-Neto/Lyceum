import type { MobileLibraryState } from "./types";
import { migrateMobileState, MOBILE_SCHEMA_VERSION } from "./storage";
import { migrateReaderData, type ReaderData } from "./readerModel";
export interface MobileBackup { format: "lyceum-mobile-backup"; version: 1; exportedAt: string; library: MobileLibraryState; reader: ReaderData }
export function createMobileBackup(library: MobileLibraryState, reader: ReaderData): MobileBackup {
  const books = library.books.map((source) => {
    const book = { ...source };
    delete book.dataUrl;
    delete book.storagePath;
    delete book.thumbnailPath;
    return book;
  });
  const sourceFolders = library.sourceFolders.map((source) => {
    const folder = { ...source };
    delete folder.nativeUri;
    return folder;
  });
  return { format: "lyceum-mobile-backup", version: 1, exportedAt: new Date().toISOString(),
    library: { ...library, books, sourceFolders }, reader };
}
export function parseMobileBackup(raw: string): MobileBackup {
  const value = JSON.parse(raw) as MobileBackup;
  if (value?.format !== "lyceum-mobile-backup" || value.version !== 1 || !Array.isArray(value.library?.books) || !Array.isArray(value.reader?.annotations)) throw new Error("Backup Lyceum inválido ou incompatível.");
  if (value.library.schemaVersion > MOBILE_SCHEMA_VERSION) throw new Error("Atualize o Lyceum antes de restaurar este backup.");
  const library = migrateMobileState(value.library);
  if (library.books.length !== value.library.books.length) throw new Error("O backup contém livros inválidos.");
  const reader = migrateReaderData(value.reader);
  if (reader.annotations.length !== value.reader.annotations.length) throw new Error("O backup contém anotações inválidas.");
  // Backup metadata must never grant access to arbitrary app-private file paths.
  return createMobileBackup(library, reader);
}
export async function hashMobileFile(file: Blob): Promise<string> {
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}
