import fs from "node:fs";
import path from "node:path";
import electron from "electron";
import {
  getDocumentByHash,
  getDocumentByFilePath,
  getDocumentByPath,
  updateLastOpened,
  updateDocumentPath,
  updateDocumentFileType,
  updateDocumentSyncStatus,
  updateThumbnailPath,
  updateTitle,
  updateAuthor,
  addDocument,
  deleteDocument,
  getSourceFolders,
  type DocumentRecord,
} from "../local-database";
import {
  LIBRARY_PATH,
  USER_DATA_PATH,
  getUniqueFilePath,
  moveFileAcrossDevices,
  inferFileTypeFromPath,
  toReadableFileType,
} from "./file-service";
import { findFileByHashInWorker, hashFile, readAndHash, openAndProcess } from "../workers/processingClient";
import { prepareReaderCopy, readerStrategyForPath, ReaderOpenError, type ReaderErrorCode } from "./reader-format-service";
import type { BookFileType } from "../../src/types/LibraryTypes";

const { app } = electron;

type ReopenedDocumentResult = {
  fileBuffer?: ArrayBuffer;
  fileHash?: string;
  filePath?: string;
  fileType?: "pdf" | "epub";
  fileName?: string;
  foundAt?: string;
  /** File actually rendered when the book was converted for the reader. */
  readerPath?: string;
  converted?: boolean;
  error?: string;
  message?: string;
  readerErrorCode?: ReaderErrorCode;
};

interface ReadableFile {
  fileBuffer?: ArrayBuffer;
  fileHash: string;
  fileType: "pdf" | "epub";
  readerPath: string;
  converted: boolean;
}

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

/**
 * Reads what the reader renders for `filePath`: the file itself for PDF/EPUB,
 * otherwise a cached EPUB/PDF copy. The hash is always the original file's,
 * so progress and library records stay attached to the real book.
 */
async function loadReadableFile(filePath: string, metadataOnly: boolean, knownHash?: string): Promise<ReadableFile> {
  const strategy = readerStrategyForPath(filePath);
  if (strategy.kind === "pdf" || strategy.kind === "epub") {
    const file = metadataOnly && strategy.kind === "pdf" ? await hashFile(filePath) : await readAndHash(filePath);
    return {
      fileBuffer: "buffer" in file ? file.buffer : undefined,
      fileHash: file.fileHash,
      fileType: strategy.kind,
      readerPath: filePath,
      converted: false,
    };
  }
  const fileHash = knownHash || (await hashFile(filePath)).fileHash;
  const copy = await prepareReaderCopy(filePath, fileHash);
  const fileBuffer = metadataOnly && copy.fileType === "pdf"
    ? undefined
    : toArrayBuffer(await fs.promises.readFile(copy.readPath));
  return { fileBuffer, fileHash, fileType: copy.fileType, readerPath: copy.readPath, converted: true };
}

function readerErrorResult(error: unknown): ReopenedDocumentResult | null {
  if (!(error instanceof ReaderOpenError)) return null;
  return { error: "UNSUPPORTED_FORMAT", message: error.message, readerErrorCode: error.code };
}

function storedFileType(filePath: string, fallback?: string | null): BookFileType {
  const extension = path.extname(filePath).toLowerCase().replace(/^\./, "");
  return (extension || fallback || "pdf") as BookFileType;
}

export async function openReadableFile(
  filePath: string
): Promise<(DocumentRecord & { fileBuffer: ArrayBuffer; fileType: "pdf" | "epub"; title: string; readerPath: string; converted: boolean }) | null> {
  const title = path.basename(filePath, path.extname(filePath));
  const thumbnailsDir = path.join(app.getPath("userData"), "thumbnails");
  const strategy = readerStrategyForPath(filePath);
  const isNative = strategy.kind === "pdf" || strategy.kind === "epub";

  const existingByPath = getDocumentByFilePath(filePath);
  if (existingByPath) {
    const readable = await loadReadableFile(filePath, false);
    updateLastOpened(existingByPath.fileHash);
    return {
      ...existingByPath,
      fileHash: readable.fileHash,
      filePath,
      fileBuffer: readable.fileBuffer!,
      fileType: readable.fileType,
      readerPath: readable.readerPath,
      converted: readable.converted,
      title,
    };
  }

  const bookFileType = storedFileType(filePath);
  // Thumbnails/page counts for converted formats are filled in later by the
  // library's thumbnail queue; inspection here only understands PDF/EPUB.
  const processed = isNative
    ? await openAndProcess({ filePath, thumbnailsDir, fileType: inferFileTypeFromPath(filePath) })
    : { ...(await hashFile(filePath)), thumbnailPath: undefined, numPages: 1, buffer: undefined };
  const readable = isNative && processed.buffer
    ? { fileBuffer: processed.buffer, fileHash: processed.fileHash, fileType: inferFileTypeFromPath(filePath), readerPath: filePath, converted: false }
    : await loadReadableFile(filePath, false, processed.fileHash);

  const existingByHash = getDocumentByHash(processed.fileHash);
  if (existingByHash) {
    updateLastOpened(existingByHash.fileHash);
    return {
      ...existingByHash,
      filePath,
      fileBuffer: readable.fileBuffer!,
      fileType: readable.fileType,
      readerPath: readable.readerPath,
      converted: readable.converted,
      title,
    };
  }

  addDocument(
    title,
    filePath,
    processed.fileHash,
    processed.thumbnailPath || undefined,
    processed.numPages ?? 1,
    isNative ? readable.fileType : bookFileType,
  );

  const doc = getDocumentByHash(processed.fileHash);
  if (!doc) return null;
  return {
    ...doc,
    filePath,
    fileBuffer: readable.fileBuffer!,
    fileType: readable.fileType,
    readerPath: readable.readerPath,
    converted: readable.converted,
    title,
  };
}

function getReopenSearchPaths(): string[] {
  const paths = [
    LIBRARY_PATH(),
    USER_DATA_PATH(),
    ...getSourceFolders().map((folder) => folder.path),
  ];
  return Array.from(new Set(paths.filter(Boolean).map((candidate) => path.resolve(candidate))));
}

function formatOpenedDocumentResult(
  document: DocumentRecord & {
    fileBuffer: ArrayBuffer;
    fileType: "pdf" | "epub";
    title: string;
    readerPath: string;
    converted: boolean;
  },
  foundAt?: string,
): ReopenedDocumentResult {
  return {
    fileBuffer: document.fileBuffer,
    fileHash: document.fileHash,
    filePath: document.filePath,
    fileType: document.fileType,
    fileName: document.title || document.fileName || path.basename(document.filePath || ""),
    foundAt,
    readerPath: document.readerPath,
    converted: document.converted,
  };
}

export async function reopenDocument(
  filePath?: string,
  fileHash?: string,
  metadataOnly = false,
): Promise<ReopenedDocumentResult> {
  try {
    if (!fileHash && !filePath) {
      return { error: "FILE_NOT_FOUND", message: "Nenhum parâmetro fornecido" };
    }

    let knownDocument: DocumentRecord | undefined;

    if (filePath) {
      knownDocument = getDocumentByPath(filePath) || getDocumentByHash(fileHash || "");
    } else if (fileHash) {
      knownDocument = getDocumentByHash(fileHash);
    }

    const candidatePaths = Array.from(
      new Set([knownDocument?.filePath, filePath].filter((candidate): candidate is string => Boolean(candidate))),
    );
    const existingCandidatePath = candidatePaths.find((candidate) => fs.existsSync(candidate));

    if (existingCandidatePath) {
      if (!knownDocument) {
        const openedDocument = await openReadableFile(existingCandidatePath);
        if (!openedDocument) {
          return { error: "READ_ERROR", message: "Erro ao ler o arquivo" };
        }
        const result = formatOpenedDocumentResult(openedDocument);
        if (metadataOnly && result.fileType === "pdf") result.fileBuffer = undefined;
        return result;
      }

      const readable = await loadReadableFile(existingCandidatePath, metadataOnly);
      const hash = readable.fileHash;

      if (existingCandidatePath !== knownDocument.filePath && hash === knownDocument.fileHash) {
        updateDocumentPath(knownDocument.fileHash, existingCandidatePath);
      }

      // Converted formats keep their real type (mobi, docx...) in the library.
      if (!readable.converted) {
        const inferredFileType = inferFileTypeFromPath(
          existingCandidatePath,
          toReadableFileType(knownDocument.fileType),
        );
        if (inferredFileType !== knownDocument.fileType) {
          updateDocumentFileType(knownDocument.fileHash, inferredFileType);
        }
      }

      updateLastOpened(knownDocument.fileHash);

      return {
        fileBuffer: readable.fileBuffer,
        fileHash: hash,
        filePath: existingCandidatePath,
        fileType: readable.fileType,
        fileName: knownDocument.title,
        foundAt: existingCandidatePath !== knownDocument.filePath ? existingCandidatePath : undefined,
        readerPath: readable.readerPath,
        converted: readable.converted,
      };
    }

    if (!fileHash) {
      return { error: "FILE_NOT_FOUND", message: "Arquivo não encontrado e hash não fornecido" };
    }

    const foundPath = await findFileByHashInWorker(fileHash, getReopenSearchPaths());

    if (!foundPath) {
      return { error: "FILE_NOT_FOUND", message: "Arquivo não encontrado em nenhuma pasta da biblioteca" };
    }

    if (!knownDocument) {
      const openedDocument = await openReadableFile(foundPath);
      if (!openedDocument) {
        return { error: "READ_ERROR", message: "Erro ao ler o arquivo" };
      }
      const result = formatOpenedDocumentResult(openedDocument, foundPath);
      if (metadataOnly && result.fileType === "pdf") result.fileBuffer = undefined;
      return result;
    }

    updateDocumentPath(fileHash, foundPath);
    updateLastOpened(fileHash);
    const readable = await loadReadableFile(foundPath, metadataOnly);
    if (!readable.converted) {
      const inferredFileType = inferFileTypeFromPath(foundPath, toReadableFileType(knownDocument.fileType));
      if (inferredFileType !== knownDocument.fileType) {
        updateDocumentFileType(fileHash, inferredFileType);
      }
    }

    return {
      fileBuffer: readable.fileBuffer,
      fileHash: readable.fileHash,
      filePath: foundPath,
      fileType: readable.fileType,
      fileName: knownDocument.title,
      foundAt: foundPath,
      readerPath: readable.readerPath,
      converted: readable.converted,
    };
  } catch (error) {
    const readerError = readerErrorResult(error);
    if (readerError) return readerError;
    console.error("[DocumentService] reopen error:", error);
    return { error: "READ_ERROR", message: "Erro ao ler o arquivo" };
  }
}

export async function renameBook(
  fileHash: string,
  newTitle: string,
  newAuthor: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    let doc = getDocumentByHash(fileHash);
    if (!doc) {
      return { success: false, error: "Documento não encontrado" };
    }

    let filePath = doc.filePath;
    if (!filePath || !fs.existsSync(filePath)) {
      const searchPaths = [LIBRARY_PATH(), USER_DATA_PATH()];
      const foundPath = await findFileByHashInWorker(fileHash, searchPaths);
      if (!foundPath) {
        return { success: false, error: "Arquivo não encontrado em nenhuma pasta da biblioteca" };
      }
      filePath = foundPath;
      updateDocumentPath(fileHash, foundPath);
    }

    const dir = path.dirname(filePath);
    const ext = path.extname(filePath);
    const safeTitle = newTitle
      .replace(/[\\/:*?"<>|]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!safeTitle) return { success: false, error: "Titulo invalido para nome de arquivo" };
    const newFileName = `${safeTitle}${ext}`;
    const requestedPath = path.join(dir, newFileName);
    const newFilePath = path.resolve(filePath) === path.resolve(requestedPath)
      ? filePath
      : getUniqueFilePath(dir, newFileName);

    if (filePath !== newFilePath) {
      fs.renameSync(filePath, newFilePath);
      updateDocumentPath(fileHash, newFilePath);
    }

    updateTitle(fileHash, safeTitle);
    updateAuthor(fileHash, newAuthor || null);

    return { success: true };
  } catch (error) {
    console.error("[DocumentService] rename error:", error);
    return { success: false, error: String(error) };
  }
}

export function deleteBook(
  fileHash: string,
  deleteFile: boolean = false,
): { success: boolean; error?: string } {
  const doc = getDocumentByHash(fileHash);
  if (!doc) return { success: false, error: "Document not found" };

  if (deleteFile && doc.filePath) {
    try {
      if (fs.existsSync(doc.filePath)) {
        fs.unlinkSync(doc.filePath);
      }
    } catch (error) {
      return { success: false, error: "Erro ao excluir arquivo do disco" };
    }
  }

  return deleteDocument(fileHash);
}
