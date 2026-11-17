import fs from "node:fs";
import path from "node:path";
import {
  addSourceFolder,
  addWatchFolder,
  deleteDocumentsUnderPath,
  getAllDocuments,
  getDocumentByHash,
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
import { randomUUID } from "node:crypto";
import { isSameOrNestedPath, relocatePathWithinFolder } from "./managed-folder-paths";

interface FolderOperationResult {
  success: boolean;
  error?: string;
  /** Where the folder lives after a rename or move. */
  newPath?: string;
  /** A source root itself was renamed or moved: file watchers must follow it. */
  sourceRootChanged?: boolean;
}

export interface CopyBooksResult extends FolderOperationResult {
  copied: number;
  failed: number;
  errors: string[];
}

function stampSafeLibraryCopy(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();
  const copyId = `lyceum-copy:${randomUUID()}`;
  if (extension === ".pdf") {
    fs.appendFileSync(filePath, `\n% ${copyId}\n`);
    return;
  }
  if (extension === ".epub" || extension === ".cbz") {
    const archive = fs.readFileSync(filePath);
    const minimumOffset = Math.max(0, archive.length - 65_557);
    let eocdOffset = -1;
    for (let index = archive.length - 22; index >= minimumOffset; index -= 1) {
      if (archive.readUInt32LE(index) === 0x06054b50) {
        eocdOffset = index;
        break;
      }
    }
    if (eocdOffset < 0) throw new Error("Arquivo ZIP sem diretorio central valido");
    const existingLength = archive.readUInt16LE(eocdOffset + 20);
    const existingComment = archive.subarray(eocdOffset + 22, eocdOffset + 22 + existingLength);
    const marker = Buffer.from(`${existingLength ? "\n" : ""}${copyId}`, "utf8");
    const comment = Buffer.concat([existingComment, marker]);
    if (comment.length > 65_535) throw new Error("Comentario ZIP excede o limite");
    const output = Buffer.concat([archive.subarray(0, eocdOffset + 22), comment]);
    output.writeUInt16LE(comment.length, eocdOffset + 20);
    fs.writeFileSync(filePath, output);
    return;
  }
  throw new Error(`Copiar dentro da biblioteca ainda nao e seguro para ${extension || "este formato"}`);
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

    if (path.resolve(safeOldPath) === path.resolve(newPath)) {
      return { success: true };
    }
    if (fs.existsSync(newPath)) {
      return { success: false, error: "Ja existe uma pasta com este nome" };
    }

    const docsInFolder = getAllDocuments().filter((doc) =>
      doc.filePath && isSameOrNestedPath(safeOldPath, doc.filePath),
    );
    fs.renameSync(safeOldPath, newPath);
    if (sourceRoot) {
      removeSourceFolder(sourceRoot.id);
      addSourceFolder(newPath, path.basename(newPath));
    }

    for (const doc of docsInFolder) {
      if (doc.filePath) {
        const nextPath = relocatePathWithinFolder(safeOldPath, newPath, doc.filePath);
        if (nextPath) updateDocumentPath(doc.fileHash, nextPath);
      }
    }

    return { success: true, newPath, sourceRootChanged: Boolean(sourceRoot) };
  } catch (error: unknown) {
    return { success: false, error: folderOperationError("Erro ao renomear pasta", error) };
  }
}

export interface DeleteFolderOptions {
  /** Moves the folder to the system trash; falls back to a permanent delete. */
  trash?: (folderPath: string) => Promise<void>;
}

/**
 * Deletes a managed folder without blocking the main process: large or deeply
 * nested folders used to freeze the app (and keep the confirm dialog on
 * screen) while `rmSync` walked the tree.
 */
export async function deleteManagedFolder(
  folderPath: string,
  force = false,
  options: DeleteFolderOptions = {},
): Promise<FolderOperationResult> {
  try {
    const target = resolveManagedFolderPath(folderPath);
    const safeFolderPath = target.targetDir;
    if (safeFolderPath === LIBRARY_PATH()) {
      return { success: false, error: "A pasta raiz nao pode ser excluida" };
    }
    const sourceRoot = findExactSourceFolder(safeFolderPath);
    if (!fs.existsSync(safeFolderPath)) {
      // Already gone (e.g. a parent in the same batch was deleted first):
      // make sure no stale records survive and report success.
      deleteDocumentsUnderPath(safeFolderPath);
      if (sourceRoot) removeSourceFolder(sourceRoot.id);
      return { success: true };
    }

    if (!force) {
      const entries = await fs.promises.readdir(safeFolderPath, { withFileTypes: true });
      if (entries.some((item) => !item.name.startsWith("."))) {
        return { success: false, error: "Pasta nao esta vazia" };
      }
    }

    let trashed = false;
    if (options.trash) {
      try {
        await options.trash(safeFolderPath);
        trashed = true;
      } catch (error) {
        console.warn("[FolderService] Trash unavailable, deleting permanently:", error);
      }
    }
    if (!trashed) {
      await fs.promises.rm(safeFolderPath, { recursive: true, force: true });
    }
    deleteDocumentsUnderPath(safeFolderPath);
    if (sourceRoot) {
      removeSourceFolder(sourceRoot.id);
    }
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: folderOperationError("Erro ao excluir pasta", error) };
  }
}

/** Deletes several folders, parents first so nested selections are no-ops. */
export async function deleteManagedFolders(
  folderPaths: string[],
  options: DeleteFolderOptions = {},
): Promise<FolderOperationResult & { deleted: number; failed: number; errors: string[] }> {
  const unique = [...new Set(folderPaths)].sort((left, right) => left.length - right.length);
  let deleted = 0;
  const errors: string[] = [];
  for (const folderPath of unique) {
    const result = await deleteManagedFolder(folderPath, true, options);
    if (result.success) deleted += 1;
    else errors.push(`${path.basename(folderPath)}: ${result.error ?? "unknown error"}`);
  }
  return {
    success: errors.length === 0,
    error: errors[0],
    deleted,
    failed: errors.length,
    errors,
  };
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
    if (path.resolve(safeSourcePath) === path.resolve(destinationPath)) {
      return { success: true };
    }
    if (fs.existsSync(destinationPath)) {
      destinationPath = getUniqueDirPath(targetDir, folderName);
    }
    if (isPathWithin(safeSourcePath, destinationPath)) {
      return { success: false, error: "Nao pode mover uma pasta para dentro de si mesma" };
    }

    const docsInFolder = getAllDocuments().filter((doc) =>
      doc.filePath && isSameOrNestedPath(safeSourcePath, doc.filePath),
    );
    fs.renameSync(safeSourcePath, destinationPath);
    if (sourceRoot) {
      removeSourceFolder(sourceRoot.id);
      addSourceFolder(destinationPath, path.basename(destinationPath));
    }

    for (const doc of docsInFolder) {
      if (doc.filePath) {
        const nextPath = relocatePathWithinFolder(safeSourcePath, destinationPath, doc.filePath);
        if (nextPath) updateDocumentPath(doc.fileHash, nextPath);
      }
    }

    return { success: true, newPath: destinationPath, sourceRootChanged: Boolean(sourceRoot) };
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

export async function copyManagedBooks(
  fileHashes: string[],
  targetFolderPath: string | null,
): Promise<CopyBooksResult> {
  const target = resolveManagedFolderPath(targetFolderPath);
  const errors: string[] = [];
  let copied = 0;
  let failed = 0;

  for (const fileHash of Array.from(new Set(fileHashes.filter(Boolean)))) {
    const doc = getDocumentByHash(fileHash);
    if (!doc?.filePath || !fs.existsSync(doc.filePath)) {
      failed += 1;
      errors.push("Livro nao encontrado");
      continue;
    }
    const destinationPath = getUniqueFilePath(target.targetDir, path.basename(doc.filePath));
    try {
      fs.copyFileSync(doc.filePath, destinationPath);
      try {
        stampSafeLibraryCopy(destinationPath);
        await processFile(destinationPath, {
          rootPath: target.rootPath,
          isSynced: true,
          generateThumbnail: false,
        });
        copied += 1;
      } catch (error) {
        if (fs.existsSync(destinationPath)) fs.unlinkSync(destinationPath);
        throw error;
      }
    } catch (error) {
      failed += 1;
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  return {
    success: failed === 0,
    copied,
    failed,
    errors,
    error: failed > 0 ? errors.join("; ") : undefined,
  };
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
