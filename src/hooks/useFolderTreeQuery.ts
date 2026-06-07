import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { FolderInfo, FolderStats } from "../types/LibraryTypes";

export const folderStructureQueryKey = ["folder-structure"] as const;
export const folderChildrenQueryKey = (parentPath: string | null) =>
  ["folder-children", parentPath ?? "root"] as const;
export const folderStatsQueryKey = (folderPath: string | null) =>
  ["folder-stats", folderPath ?? "root"] as const;

function hasFolderApi() {
  return Boolean(window.api?.getFolderStructure || window.api?.getFolderChildren);
}

export function useFolderQueryInvalidation() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!window.api?.onFolderChanged) return;
    return window.api.onFolderChanged(() => {
      void queryClient.invalidateQueries({ queryKey: folderStructureQueryKey });
      void queryClient.invalidateQueries({ queryKey: ["folder-children"] });
      void queryClient.invalidateQueries({ queryKey: ["folder-stats"] });
      void queryClient.invalidateQueries({ queryKey: ["library-roots"] });
      void queryClient.invalidateQueries({ queryKey: ["library-folders"] });
      void queryClient.invalidateQueries({ queryKey: ["watch-folders"] });
    });
  }, [queryClient]);
}

export function useFolderTreeQuery(options: {
  rootPath?: string | null;
  enabled?: boolean;
  initialData?: FolderInfo[];
} = {}) {
  useFolderQueryInvalidation();
  const rootPath = options.rootPath ?? null;

  return useQuery({
    queryKey: rootPath ? ["folder-structure", rootPath] : folderStructureQueryKey,
    queryFn: () =>
      window.api.getFolderStructureCached
        ? window.api.getFolderStructureCached(rootPath)
        : window.api.getFolderStructure(rootPath),
    initialData: options.initialData,
    enabled: hasFolderApi() && options.enabled !== false,
    staleTime: 30_000,
  });
}

export function useFolderChildrenQuery(
  parentPath: string | null,
  options: { enabled?: boolean; initialData?: FolderInfo[] } = {},
) {
  useFolderQueryInvalidation();

  return useQuery({
    queryKey: folderChildrenQueryKey(parentPath),
    queryFn: () =>
      window.api.getFolderChildren
        ? window.api.getFolderChildren(parentPath)
        : window.api.getFolderStructure(parentPath),
    initialData: options.initialData,
    enabled: hasFolderApi() && options.enabled !== false,
    staleTime: 30_000,
  });
}

export function useFolderStatsQuery(
  folderPath: string | null,
  options: { enabled?: boolean } = {},
) {
  return useQuery<FolderStats>({
    queryKey: folderStatsQueryKey(folderPath),
    queryFn: () => window.api.getFolderStats(folderPath),
    enabled: Boolean(window.api?.getFolderStats) && options.enabled !== false,
    staleTime: 60_000,
  });
}
