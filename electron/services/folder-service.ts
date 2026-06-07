import fs from "node:fs";
import path from "node:path";
import {
  addSourceFolder,
  addWatchFolder,
  deleteDocumentsUnderPath,
  getAllDocuments,
  getDocumentByHash,
  getDocumentsByBookId,
  getSourceFolders,
  getUnsyncedBookCount,
  getWatchFolderBooks,
  getWatchFolders,
  removeSourceFolder,
  removeWatchFolder,
  updateDocumentPath,
  updateDocumentSyncStatus,
} from "../local-database";
import {
  LIBRARY_PATH,
  assertPathWithin,
  getUniqueDirPath,
  getUniqueFilePath,
  getAllBookFiles,
  isPathWithin,
  moveFileAcrossDevices,
  sanitizeFolderName,
} from "./file-service";
import { processFile, resolveManagedFolderPath } from "./library-service";

interface FolderOperationResult {
  success: boolean;
  error?: string;
}

function permissionError(defaultMessage: string, error: unknown) {
  const err = error as Error & { code?: string };
  if (err.code === "EBUSY" || err.code === "ENOTEMPTY") return "Pasta esta sendo usada";
  if (err.code === "EPERM" || err.code === "EACCES") return "Permissao negada";
  return defaultMessage;
}

function bookMoveError(defaultMessage: string, error: unknown) {
  const err = error as Error & { code?: string };
  if (err.code === "EBUSY") return "Arquivo esta sendo usado";
  if (err.code === "EPERM") return "Permissao negada";
  return defaultMessage;
}

function folderOperationError(defaultMessage: string, error: unknown) {
  return permissionError(defaultMessage, error);
}

function findExactSourceFolder(folderPath: string) {
  const resolvedPath = path.resolve(folderPath);
  return getSourceFolders().find(
    (folder) => path.resolve(folder.path) === resolvedPath,
  );
}

export function createManagedFolder(
  folderName: string,
  parentPath: string | null = null,
): FolderOperationResult {
  try {
    const target = resolveManagedFolderPath(parentPath);
    const basePath = target.targetDir;
    const safeFolderName = sanitizeFolderName(folderName);
    const newFolderPath = assertPathWithin(
      target.rootPath,
      path.join(basePath, safeFolderName),
      "Caminho invalido",
    );
    if (fs.existsSync(newFolderPath)) {
      return { success: false, error: "Pasta ja existe" };
    }
    fs.mkdirSync(newFolderPath, { recursive: true });
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: folderOperationError("Erro ao criar pasta", error) };
  }
}

export function renameManagedFolder(
  oldPath: string,
  newName: string,
): FolderOperationResult {
  try {
    const target = resolveManagedFolderPath(oldPath);
    const safeOldPath = target.targetDir;
    const parentPathDir = path.dirname(safeOldPath);
    const safeFolderName = sanitizeFolderName(newName);
    const newPath = assertPathWithin(
      target.rootPath,
      path.join(parentPathDir, safeFolderName),
      "Caminho invalido",
    );
    const sourceRoot = findExactSourceFolder(safeOldPath);

    if (fs.existsSync(newPath)) {
      return { success: false, error: "Ja existe uma pasta com este nome" };
    }

    const docsInFolder = getAllDocuments().filter((doc) =>
      doc.filePath && doc.filePath.startsWith(safeOldPath),
    );
    fs.renameSync(safeOldPath, newPath);
    if (sourceRoot) {
      removeSourceFolder(sourceRoot.id);
      addSourceFolder(newPath, path.basename(newPath));
    }

    for (const doc of docsInFolder) {
      if (doc.filePath) {
        updateDocumentPath(doc.fileHash, doc.filePath.replace(safeOldPath, newPath));
      }
    }

    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: folderOperationError("Erro ao renomear pasta", error) };
  }
}

export function deleteManagedFolder(
  folderPath: string,
  force = false,
): FolderOperationResult {
  try {
    const target = resolveManagedFolderPath(folderPath);
    const safeFolderPath = target.targetDir;
    if (safeFolderPath === LIBRARY_PATH()) {
      return { success: false, error: "A pasta raiz nao pode ser excluida" };
    }
    const sourceRoot = findExactSourceFolder(safeFolderPath);
    if (!fs.existsSync(safeFolderPath)) {
      return { success: false, error: "Pasta nao existe" };
    }

    if (!force) {
      const nonEmpty = fs
        .readdirSync(safeFolderPath, { withFileTypes: true })
        .filter((item) => !item.name.startsWith("."));
      if (nonEmpty.length > 0) {
        return { success: false, error: "Pasta nao esta vazia" };
      }
    }

    fs.rmSync(safeFolderPath, { recursive: true, force: true });
    deleteDocumentsUnderPath(safeFolderPath);
    if (sourceRoot) {
      removeSourceFolder(sourceRoot.id);
    }
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: folderOperationError("Erro ao excluir pasta", error) };
  }
}

export function moveManagedFolder(
  sourcePath: string,
  targetPath: string | null,
): FolderOperationResult {
  try {
    const source = resolveManagedFolderPath(sourcePath);
    const safeSourcePath = source.targetDir;
    if (!fs.existsSync(safeSourcePath)) {
      return { success: false, error: "Pasta nao existe" };
    }

    const target = resolveManagedFolderPath(targetPath);
    const targetDir = target.targetDir;
    const folderName = path.basename(safeSourcePath);
    let destinationPath = path.join(targetDir, folderName);
    const sourceRoot = findExactSourceFolder(safeSourcePath);
    if (fs.existsSync(destinationPath)) {
      destinationPath = getUniqueDirPath(targetDir, folderName);
    }
    if (safeSourcePath === destinationPath) return { success: true };
    if (isPathWithin(safeSourcePath, destinationPath)) {
      return { success: false, error: "Nao pode mover uma pasta para dentro de si mesma" };
    }

    const docsInFolder = getAllDocuments().filter((doc) =>
      doc.filePath && doc.filePath.startsWith(safeSourcePath),
    );
    fs.renameSync(safeSourcePath, destinationPath);
    if (sourceRoot) {
      removeSourceFolder(sourceRoot.id);
      addSourceFolder(destinationPath, path.basename(destinationPath));
    }

    for (const doc of docsInFolder) {
      if (doc.filePath) {
        updateDocumentPath(
          doc.fileHash,
          doc.filePath.replace(safeSourcePath, destinationPath),
        );
      }
    }

    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: folderOperationError("Erro ao mover pasta", error) };
  }
}

export function moveManagedBook(
  fileHash: string,
  targetFolderPath: string | null,
): FolderOperationResult {
  try {
    const doc = getDocumentByHash(fileHash);
    if (!doc || !doc.filePath) {
      return { success: false, error: "Livro nao encontrado" };
    }

    const currentDir = path.dirname(doc.filePath);
    const fileName = path.basename(doc.filePath);
    const target = resolveManagedFolderPath(targetFolderPath);
    if (path.resolve(currentDir) === path.resolve(target.targetDir)) {
      return { success: true };
    }
    if (!fs.existsSync(target.targetDir)) {
      return { success: false, error: "Pasta de destino nao existe" };
    }

    const newFilePath = getUniqueFilePath(target.targetDir, fileName);
    moveFileAcrossDevices(doc.filePath, newFilePath);
    updateDocumentPath(fileHash, newFilePath);
    updateDocumentSyncStatus(fileHash, true, target.category);

    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: bookMoveError("Erro ao mover livro", error) };
  }
}

export function moveMergedManagedBook(
  bookId: string,
  targetFolderPath: string | null,
): FolderOperationResult & { moved?: number } {
  const docs = getDocumentsByBookId(bookId).filter((doc) => doc.filePath);
  if (docs.length === 0) {
    return { success: false, error: "Livro mesclado nao encontrado" };
  }

  const moved: { fileHash: string; from: string; to: string }[] = [];

  try {
    const target = resolveManagedFolderPath(targetFolderPath);
    if (!fs.existsSync(target.targetDir)) {
      return { success: false, error: "Pasta de destino nao existe" };
    }

    for (const doc of docs) {
      const currentPath = doc.filePath;
      const currentDir = path.dirname(currentPath);
      if (path.resolve(currentDir) === path.resolve(target.targetDir)) continue;

      const newFilePath = getUniqueFilePath(target.targetDir, path.basename(currentPath));
      moveFileAcrossDevices(currentPath, newFilePath);
      moved.push({ fileHash: doc.fileHash, from: currentPath, to: newFilePath });
    }

    for (const item of moved) {
      updateDocumentPath(item.fileHash, item.to);
      updateDocumentSyncStatus(item.fileHash, true, target.category);
    }

    return { success: true, moved: moved.length };
  } catch (error: unknown) {
    for (const item of [...moved].reverse()) {
      try {
        if (fs.existsSync(item.to) && !fs.existsSync(item.from)) {
          moveFileAcrossDevices(item.to, item.from);
        }
      } catch (rollbackError) {
        console.error("[FolderService] Error rolling back merged move:", rollbackError);
      }
    }

    return { success: false, error: bookMoveError("Erro ao mover livro mesclado", error) };
  }
}

export function listManagedWatchFolders() {
  return getWatchFolders();
}

export function addManagedWatchFolder(folderPath: string, label?: string) {
  return addWatchFolder(folderPath, label);
}

export function removeManagedWatchFolder(id: number): FolderOperationResult {
  removeWatchFolder(id);
  return { success: true };
}

export function listManagedWatchFolderBooks(folderPath: string) {
  return getWatchFolderBooks(folderPath);
}

export function getManagedWatchFolderBookCount(folderPath: string) {
  return getUnsyncedBookCount(folderPath);
}

export async function addManagedSourceFolder(folderPath: string, label?: string) {
  const resolvedPath = path.resolve(folderPath);
  if (!fs.existsSync(resolvedPath)) {
    return { success: false, error: "Pasta fonte nao encontrada" };
  }

  const record = addSourceFolder(resolvedPath, label);
  const files = getAllBookFiles(resolvedPath);
  for (const filePath of files) {
    await processFile(filePath, { rootPath: resolvedPath, isSynced: true });
  }

  return { success: true, folder: record, scanned: files.length };
}

export function removeManagedSourceFolder(id: number) {
  const record = removeSourceFolder(id);
  if (!record) {
    return {
      success: false,
      error: "Pasta fonte nao encontrada",
      removedDocuments: 0,
    };
  }

  const removedDocuments = deleteDocumentsUnderPath(record.path);
  return { success: true, removedDocuments };
}

export async function resyncManagedSourceFolder(id: number) {
  const folder = getSourceFolders().find((candidate) => candidate.id === id);
  if (!folder) {
    return { success: false, error: "Pasta fonte nao encontrada" };
  }
  if (!fs.existsSync(folder.path)) {
    return { success: false, error: "Pasta fonte indisponivel" };
  }

  const files = getAllBookFiles(folder.path);
  for (const filePath of files) {
    await processFile(filePath, { rootPath: folder.path, isSynced: true });
  }
  return { success: true, scanned: files.length };
}
