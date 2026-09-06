import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { resolveMobileBookDataUrl } from "./bookFileStorage";
import { ReaderControls, hasNativeReaderControls } from "./readerControls";
import type { MobileBook } from "./types";

export async function exportMobileBook(book: MobileBook, share = false) {
  if (share && hasNativeReaderControls() && book.storagePath) {
    await ReaderControls.shareBook({ path: book.storagePath, name: book.fileName, mimeType: book.mimeType || (book.fileType === "epub" ? "application/epub+zip" : book.fileType === "pdf" ? "application/pdf" : "text/plain") });
    return "Seletor Android aberto. Escolha Kindle ou outro destino e confirme o envio. A entrega não foi verificada pelo Lyceum.";
  }
  const url = await resolveMobileBookDataUrl(book);
  if (!url) throw new Error("Religue o arquivo do livro antes de exportar.");
  const name = book.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  if (Capacitor.isNativePlatform()) {
    await Filesystem.writeFile({ path: `Lyceum/${name}`, directory: Directory.Documents, data: url.split(",")[1], recursive: true });
    return `Arquivo salvo em Documentos/Lyceum/${name}. Você pode compartilhá-lo com o Kindle.`;
  }
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  return "Download do livro iniciado.";
}
