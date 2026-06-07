import { useCallback } from "react";

interface FolderOperationResult {
  success: boolean;
  error?: string;
  moved?: number;
}

interface UseFolderOperationsOptions {
  onChanged?: () => Promise<void> | void;
}

async function runWithRefresh<T extends FolderOperationResult>(
  operation: () => Promise<T>,
  onChanged?: () => Promise<void> | void,
): Promise<T> {
  const result = await operation();
  if (result.success) {
    await onChanged?.();
  }
  return result;
}

export function useFolderOperations(options: UseFolderOperationsOptions = {}) {
  const { onChanged } = options;

  const createFolder = useCallback(
    (parentPath: string | null, name: string) =>
      runWithRefresh(
        () => window.api.createFolder(name, parentPath),
        onChanged,
      ),
    [onChanged],
  );

  const renameFolder = useCallback(
    (folderPath: string, newName: string) =>
      runWithRefresh(
        () => window.api.renameFolder(folderPath, newName),
        onChanged,
      ),
    [onChanged],
  );

  const deleteFolder = useCallback(
    (folderPath: string, force = true) =>
      runWithRefresh(
        () => window.api.deleteFolder(folderPath, force),
        onChanged,
      ),
    [onChanged],
  );

  const moveFolder = useCallback(
    (folderPath: string, newParent: string | null) =>
      runWithRefresh(
        () => window.api.moveFolder(folderPath, newParent),
        onChanged,
      ),
    [onChanged],
  );

  const moveBook = useCallback(
    (fileHash: string, targetFolder: string | null) =>
      runWithRefresh(
        () => window.api.moveBook(fileHash, targetFolder),
        onChanged,
      ),
    [onChanged],
  );

  return {
    createFolder,
    renameFolder,
    deleteFolder,
    moveFolder,
    moveBook,
  };
}
