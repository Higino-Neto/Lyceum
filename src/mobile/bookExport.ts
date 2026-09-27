import { Capacitor } from "@capacitor/core";
import { translate } from "../i18n";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { resolveMobileBookDataUrl } from "./bookFileStorage";
import { ReaderControls, hasNativeReaderControls } from "./readerControls";
import type { MobileBook } from "./types";

export async function exportMobileBook(book: MobileBook, share = false) {
  if (share && hasNativeReaderControls() && book.storagePath) {
    await ReaderControls.shareBook({ path: book.storagePath, name: book.fileName, mimeType: book.mimeType || (book.fileType === "epub" ? "application/epub+zip" : book.fileType === "pdf" ? "application/pdf" : "text/plain") });
    return translate("mobile:bookExport.androidPickerNotice");
  }
  const url = await resolveMobileBookDataUrl(book);
  if (!url) throw new Error(translate("mobile:bookExport.relinkBeforeExport"));
  const name = book.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  if (Capacitor.isNativePlatform()) {
    await Filesystem.writeFile({ path: `Lyceum/${name}`, directory: Directory.Documents, data: url.split(",")[1], recursive: true });
    return translate("mobile:bookExport.savedToDocuments", { name });
  }
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  return translate("mobile:bookExport.downloadStarted");
}
