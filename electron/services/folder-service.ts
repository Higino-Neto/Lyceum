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
  mergeDocuments,
  removeSourceFolder,
  removeWatchFolder,
  updateDocumentBookId,
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

interface MoveDocumentsToFolderResult extends FolderOperationResult {
  moved?: number;
}

interface FolderBooksResult extends FolderOperationResult {
  folderPath?: string;
  fullPath?: string;
  moved?: number;
  mergedCount?: number;
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

function collectDocumentsForHashes(fileHashes: string[]) {
  const docsByHash = new Map<string, ReturnType<typeof getDocumentByHash>>();
  const uniqueHashes = Array.from(new Set(fileHashes.filter(Boolean)));

  for (const fileHash of uniqueHashes) {
    const doc = getDocumentByHash(fileHash);
    if (!doc) continue;
    docsByHash.set(doc.fileHash, doc);

    if (doc.bookId) {
      for (const groupedDoc of getDocumentsByBookId(doc.bookId)) {
        docsByHash.set(groupedDoc.fileHash, groupedDoc);
      }
    }
  }

  return Array.from(docsByHash.values()).filter(
    (doc): doc is NonNullable<ReturnType<typeof getDocumentByHash>> => Boolean(doc),
  );
}

function getCanonicalFolderTitle(docs: Array<NonNullable<ReturnType<typeof getDocumentByHash>>>) {
  const doc = docs.find((candidate) => candidate.title?.trim()) || docs[0];
  const title = doc?.title?.trim() || doc?.fileName || "Livro";
  return title.replace(/\.[a-z0-9]+$/i, "").trim() || "Livro";
}

function createPrefixedFolder(
  prefix: "_" | "__",
  title: string,
  parentPath: string | null = null,
) {
  const cleanTitle = title
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim() || "Livro";
  const safeFolderName = sanitizeFolderName(`${prefix}${cleanTitle}`);
  const target = resolveManagedFolderPath(parentPath);
  const targetDir = getUniqueDirPath(target.targetDir, safeFolderName);
  fs.mkdirSync(targetDir, { recursive: true });
  return targetDir;
}

function moveDocumentsToFolder(
  docs: Array<NonNullable<ReturnType<typeof getDocumentByHash>>>,
  targetDir: string,
): MoveDocumentsToFolderResult {
  const moved: { fileHash: string; from: string; to: string }[] = [];

  try {
    for (const doc of docs) {
      if (!doc.filePath || !fs.existsSync(doc.filePath)) {
        throw new Error("Arquivo nao encontrado");
      }

      const currentDir = path.dirname(doc.filePath);
      if (path.resolve(currentDir) === path.resolve(targetDir)) continue;

      const newFilePath = getUniqueFilePath(targetDir, path.basename(doc.filePath));
      moveFileAcrossDevices(doc.filePath, newFilePath);
      moved.push({ fileHash: doc.fileHash, from: doc.filePath, to: newFilePath });
    }

    for (const item of moved) {
      updateDocumentPath(item.fileHash, item.to);
      updateDocumentSyncStatus(item.fileHash, true);
      updateDocumentBookId(item.fileHash, null);
    }

    return { success: true, moved: moved.length };
  } catch (error: unknown) {
    for (const item of [...moved].reverse()) {
      try {
        if (fs.existsSync(item.to) && !fs.existsSync(item.from)) {
          moveFileAcrossDevices(item.to, item.from);
        }
      } catch (rollbackError) {
        console.error("[FolderService] Error rolling back folder book move:", rollbackError);
      }
    }

    return { success: false, error: bookMoveError("Erro ao mover livros", error) };
  }
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

export function mergeBooksIntoManagedFolder(
  fileHashes: string[],
  parentPath: string | null = null,
): FolderBooksResult {
  const docs = collectDocumentsForHashes(fileHashes);
  if (docs.length < 2) {
    return { success: false, error: "Selecione pelo menos dois livros" };
  }

  let targetDir: string | null = null;

  try {
    targetDir = createPrefixedFolder("_", getCanonicalFolderTitle(docs), parentPath);
    const moveResult = moveDocumentsToFolder(docs, targetDir);
    if (!moveResult.success) {
      fs.rmSync(targetDir, { recursive: true, force: true });
      return moveResult;
    }

    const movedHashes = docs.map((doc) => doc.fileHash);
    const mergeResult = mergeDocuments(movedHashes, `folder-${Date.now()}`);
    if (mergeResult.success) {
      for (const doc of mergeResult.documents) {
        updateDocumentBookId(doc.fileHash, null);
      }
    } else {
      for (const doc of docs) {
        updateDocumentBookId(doc.fileHash, null);
      }
    }

    return {
      success: true,
      folderPath: path.relative(LIBRARY_PATH(), targetDir),
      fullPath: targetDir,
      moved: moveResult.moved,
      mergedCount: docs.length,
    };
  } catch (error: unknown) {
    if (targetDir && fs.existsSync(targetDir) && fs.readdirSync(targetDir).length === 0) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
    return { success: false, error: bookMoveError("Erro ao mesclar livros", error) };
  }
}

export function createManagedCollection(
  name: string,
  fileHashes: string[],
  parentPath: string | null = null,
): FolderBooksResult {
  const docs = collectDocumentsForHashes(fileHashes);
  let targetDir: string | null = null;

  try {
    targetDir = createPrefixedFolder("__", name, parentPath);

    if (docs.length > 0) {
      const moveResult = moveDocumentsToFolder(docs, targetDir);
      if (!moveResult.success) {
        fs.rmSync(targetDir, { recursive: true, force: true });
        return moveResult;
      }
    }

    return {
      success: true,
      folderPath: path.relative(LIBRARY_PATH(), targetDir),
      fullPath: targetDir,
      moved: docs.length,
    };
  } catch (error: unknown) {
    if (targetDir && fs.existsSync(targetDir) && fs.readdirSync(targetDir).length === 0) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
    return { success: false, error: folderOperationError("Erro ao criar colecao", error) };
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
