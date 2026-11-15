/**
 * "lyceum" opens the language-learning reader. Its tabs carry the source
 * book path/hash; the reader prepares the `.lyceum` package itself, so no
 * file buffer is held in tab state.
 */
export type FileType = "pdf" | "epub" | "lyceum";
export type PdfRenderer = "pdfjs";

export interface DocumentTab {
  id: string;
  fileHash: string;
  fileName: string;
  fileType: FileType;
  buffer?: ArrayBuffer;
  filePath?: string;
  libraryDocumentId?: string;
  pdfRenderer?: PdfRenderer;
  position: number;
  isActive: boolean;
  source: "library" | "local";
  isLoading?: boolean;
  isResolved?: boolean;
  loadError?: string;
}

export interface TabRemoveOptions {
  tabId: string;
  detach?: boolean;
}

export interface PersistedDocumentTab {
  id: string;
  fileHash: string;
  fileName: string;
  fileType: FileType;
  filePath?: string;
  libraryDocumentId?: string;
  pdfRenderer?: PdfRenderer;
  position: number;
  source: "library" | "local";
}
