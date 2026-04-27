export type FileType = "pdf" | "epub";

export interface DocumentTab {
  id: string;
  fileHash: string;
  fileName: string;
  fileType: FileType;
  buffer?: ArrayBuffer;
  filePath?: string;
  libraryDocumentId?: string;
  position: number;
  isActive: boolean;
  source: "library" | "local";
  isLoading?: boolean;
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
  position: number;
  source: "library" | "local";
}
