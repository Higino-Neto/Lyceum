import toast from "react-hot-toast";
import type { NavigateFunction } from "react-router-dom";
import { translate } from "../../i18n";
import type { BookWithThumbnail } from "../../types/LibraryTypes";
import { needsReaderConversion, readerErrorKey, readerFormatLabel } from "./model/readerFormats";

export const SELECT_LIBRARY_FOLDER_EVENT = "lyceum:select-library-folder";

/** Opens a library folder from anywhere (e.g. the command palette). */
export function navigateToLibraryFolder(navigate: NavigateFunction, folderPath: string | null) {
  try {
    localStorage.setItem("lyceum_library_selectedFolder", JSON.stringify(folderPath));
  } catch {
    // The event below still updates a mounted library.
  }
  window.dispatchEvent(new CustomEvent(SELECT_LIBRARY_FOLDER_EVENT, { detail: folderPath }));
  navigate("/library");
}

interface ReopenResult {
  error?: string;
  message?: string;
  foundAt?: string;
  fileBuffer?: ArrayBuffer;
  fileHash?: string;
  fileName?: string;
  filePath?: string;
  fileType?: string;
  readerErrorCode?: string;
}

/**
 * Opens a library book in /reading from outside the Library page. Mirrors
 * the library's own open flow (cached EPUB conversion toast, moved files).
 */
export async function openLibraryBook(book: BookWithThumbnail, navigate: NavigateFunction): Promise<boolean> {
  const filePath = book.filePath;
  if (!filePath || !window.api?.reopenPdf) return false;
  const preparing = needsReaderConversion(filePath)
    ? toast.loading(translate("library:reader.preparing", { format: readerFormatLabel(filePath) }))
    : null;
  let result: ReopenResult | null = null;
  try {
    result = await window.api.reopenPdf(filePath, book.fileHash, filePath.toLowerCase().endsWith(".pdf")) as ReopenResult | null;
  } finally {
    if (preparing) toast.dismiss(preparing);
  }
  if (!result || "error" in result) {
    const errorKey = readerErrorKey(result?.readerErrorCode);
    toast.error(errorKey ? translate(errorKey) : result?.message || translate("library:toasts.openFileFailed"));
    return false;
  }
  const fileType = result.fileType === "epub" || filePath.toLowerCase().endsWith(".epub") ? "epub" : "pdf";
  navigate("/reading", {
    state: {
      fileBuffer: result.fileBuffer,
      fileHash: result.fileHash || book.fileHash,
      fileName: result.fileName || filePath.split(/[/\\]/).pop(),
      filePath: result.foundAt || result.filePath || filePath,
      fileType,
      source: "library",
      navigationId: crypto.randomUUID(),
    },
  });
  return true;
}
