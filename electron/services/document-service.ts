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
  type DocumentRecord,
} from "../local-database";
import {
  generateFileHash,
  toArrayBuffer,
  LIBRARY_PATH,
  USER_DATA_PATH,
  findFileByHash,
  getUniqueFilePath,
  moveFileAcrossDevices,
  inferFileTypeFromPath,
  toReadableFileType,
} from "./file-service";
import { generateThumbnail, getPdfPageCount, getEpubChapterCount } from "./document-processing";

const { app } = electron;

export async function openReadableFile(
  filePath: string
): Promise<(DocumentRecord & { fileBuffer: ArrayBuffer; fileType: "pdf" | "epub"; title: string }) | null> {
  const fileType = inferFileTypeFromPath(filePath);
  const title = path.basename(filePath, path.extname(filePath));
  const fileHash = generateFileHash(filePath);
  const fileBuffer = toArrayBuffer(fs.readFileSync(filePath));

  const existingByPath = getDocumentByFilePath(filePath);
  if (existingByPath) {
    updateLastOpened(existingByPath.fileHash);
    return { ...existingByPath, filePath, fileBuffer, fileType, title };
  }

  const existingByHash = getDocumentByHash(fileHash);
  if (existingByHash) {
    updateLastOpened(existingByHash.fileHash);
    return { ...existingByHash, filePath, fileBuffer, fileType, title };
  }

  const thumbnailPath = await generateThumbnail(filePath, fileHash, {
    thumbnailsDir: path.join(app.getPath("userData"), "thumbnails"),
    force: false,
    fileType,
    logPrefix: "[DocumentService]",
  });
  const numPages = fileType === "pdf"
    ? await getPdfPageCount(filePath)
    : await getEpubChapterCount(filePath);

  addDocument(title, filePath, fileHash, thumbnailPath || undefined, numPages, fileType);

  const doc = getDocumentByHash(fileHash);
  if (!doc) return null;
  return { ...doc, filePath, fileBuffer, fileType, title };
}

export async function reopenDocument(
  filePath?: string,
  fileHash?: string,
): Promise<{
  fileBuffer?: ArrayBuffer;
  fileHash?: string;
  filePath?: string;
  fileType?: "pdf" | "epub";
  fileName?: string;
  foundAt?: string;
  error?: string;
  message?: string;
}> {
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

    if (!knownDocument?.filePath) {
      return {
        error: "FILE_NOT_FOUND",
        message: "O arquivo solicitado não pertence à biblioteca da aplicação",
      };
    }

    if (fs.existsSync(knownDocument.filePath)) {
      const fileBuffer = toArrayBuffer(fs.readFileSync(knownDocument.filePath));
      const hash = generateFileHash(knownDocument.filePath);
      const inferredFileType = inferFileTypeFromPath(
        knownDocument.filePath,
        toReadableFileType(knownDocument.fileType),
      );

      if (inferredFileType !== knownDocument.fileType) {
        updateDocumentFileType(knownDocument.fileHash, inferredFileType);
      }

      updateLastOpened(knownDocument.fileHash);

      return {
        fileBuffer,
        fileHash: hash,
        filePath: knownDocument.filePath,
        fileType: inferredFileType,
        fileName: knownDocument.title,
      };
    }

    if (!fileHash) {
      return { error: "FILE_NOT_FOUND", message: "Arquivo não encontrado e hash não fornecido" };
    }

    const searchPaths = [LIBRARY_PATH(), USER_DATA_PATH()];
    const foundPath = findFileByHash(fileHash, searchPaths);

    if (!foundPath) {
      return { error: "FILE_NOT_FOUND", message: "Arquivo não encontrado em nenhuma pasta da biblioteca" };
    }

    updateDocumentPath(fileHash, foundPath);
    updateLastOpened(fileHash);
    const inferredFileType = inferFileTypeFromPath(foundPath, toReadableFileType(knownDocument.fileType));
    if (inferredFileType !== knownDocument.fileType) {
      updateDocumentFileType(fileHash, inferredFileType);
    }

    const fileBuffer = toArrayBuffer(fs.readFileSync(foundPath));
    return {
      fileBuffer,
      fileHash,
      filePath: foundPath,
      fileType: inferredFileType,
      fileName: knownDocument.title,
      foundAt: foundPath,
    };
  } catch (error) {
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
      const foundPath = findFileByHash(fileHash, searchPaths);
      if (!foundPath) {
        return { success: false, error: "Arquivo não encontrado em nenhuma pasta da biblioteca" };
      }
      filePath = foundPath;
      updateDocumentPath(fileHash, foundPath);
    }

    const dir = path.dirname(filePath);
    const ext = path.extname(filePath);
    const newFileName = `${newTitle}${ext}`;
    const newFilePath = getUniqueFilePath(dir, newFileName);

    if (filePath !== newFilePath) {
      fs.renameSync(filePath, newFilePath);
      updateDocumentPath(fileHash, newFilePath);
    }

    const finalTitle = newTitle.toLowerCase().endsWith(".pdf") ? newTitle : `${newTitle}.pdf`;
    updateTitle(fileHash, finalTitle);
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
