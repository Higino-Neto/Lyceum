import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  FolderInfo,
  LibraryRootInfo,
  SourceFolderInfo,
  WatchFolderInfo,
} from "../types/LibraryTypes";
import { useFolderOperations } from "../hooks/useFolderOperations";
import { useFolderTreeQuery } from "../hooks/useFolderTreeQuery";
import { useLocalStorage } from "../hooks/useLocalStorage";

interface LibraryContextValue {
  folderStructure: FolderInfo[];
  selectedFolder: string | null;
  sourceFolders: SourceFolderInfo[];
  watchFolders: WatchFolderInfo[];
  watchFolderCounts: Record<number, number>;
  libraryRoots: LibraryRootInfo[];
  libraryFolders: string[];
  watchFolderPaths: Set<string>;
  isLoading: boolean;
  selectFolder: (path: string | null) => void;
  refreshFolders: () => Promise<void>;
  createFolder: (parentPath: string | null, name: string) => Promise<{ success: boolean; error?: string }>;
  renameFolder: (folderPath: string, newName: string) => Promise<{ success: boolean; error?: string }>;
  deleteFolder: (folderPath: string, force?: boolean) => Promise<{ success: boolean; error?: string }>;
  moveFolder: (folderPath: string, newParent: string | null) => Promise<{ success: boolean; error?: string }>;
  moveBook: (fileHash: string, targetFolder: string | null) => Promise<{ success: boolean; error?: string }>;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

function visibleFolders(folders: FolderInfo[]) {
  return folders.filter((folder) => !folder.name.startsWith("."));
}

function toSourceFolder(root: LibraryRootInfo): SourceFolderInfo {
  return {
    id: root.id ?? -1,
    path: root.path,
    label: root.label,
    type: "source",
    createdAt: "",
  };
}

export function LibraryProvider({ children }: { children: ReactNode }) {
  const electronApiAvailable = !!window.api?.getFolderStructure;
  const [selectedFolder, setSelectedFolder] = useLocalStorage<string | null>("library_selectedFolder", null);
  const queryClient = useQueryClient();

  const refreshFolders = useCallback(async () => {
    if (!electronApiAvailable) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["folder-structure"] }),
      queryClient.invalidateQueries({ queryKey: ["folder-children"] }),
      queryClient.invalidateQueries({ queryKey: ["library-roots"] }),
      queryClient.invalidateQueries({ queryKey: ["library-folders"] }),
      queryClient.invalidateQueries({ queryKey: ["watch-folders"] }),
      queryClient.invalidateQueries({ queryKey: ["watch-folder-counts"] }),
    ]);
  }, [electronApiAvailable, queryClient]);

  const operations = useFolderOperations({ onChanged: refreshFolders });

  const folderTreeQuery = useFolderTreeQuery({ enabled: electronApiAvailable });
  const libraryFoldersQuery = useQuery({
    queryKey: ["library-folders"],
    queryFn: () => window.api.getAllFolders ? window.api.getAllFolders() : Promise.resolve([]),
    enabled: electronApiAvailable,
    staleTime: 30_000,
  });
  const libraryRootsQuery = useQuery({
    queryKey: ["library-roots"],
    queryFn: () => window.api.getLibraryRoots ? window.api.getLibraryRoots() : Promise.resolve([]),
    enabled: electronApiAvailable,
    staleTime: 30_000,
  });
  const watchFoldersQuery = useQuery({
    queryKey: ["watch-folders"],
    queryFn: () => window.api.getWatchFolders ? window.api.getWatchFolders() : Promise.resolve([]),
    enabled: electronApiAvailable,
    staleTime: 30_000,
  });

  const libraryRoots = useMemo(
    () => (libraryRootsQuery.data ?? []) as LibraryRootInfo[],
    [libraryRootsQuery.data],
  );
  const sourceRoots = useMemo(
    () => libraryRoots.filter((root) => root.type === "source"),
    [libraryRoots],
  );
  const sourceStructureQueries = useQueries({
    queries: sourceRoots.map((root) => ({
      queryKey: ["folder-structure", root.path],
      queryFn: () =>
        window.api.getFolderStructureCached
          ? window.api.getFolderStructureCached(root.path)
          : window.api.getFolderStructure(root.path),
      enabled: electronApiAvailable,
      staleTime: 30_000,
    })),
  });
  const watchFolders = useMemo(
    () => (watchFoldersQuery.data ?? []) as WatchFolderInfo[],
    [watchFoldersQuery.data],
  );
  const watchFolderCountsQuery = useQuery({
    queryKey: ["watch-folder-counts", watchFolders.map((folder) => folder.id).join(",")],
    queryFn: async () => {
      const counts: Record<number, number> = {};
      if (!window.api.getWatchFolderBookCount) return counts;
      await Promise.all(
        watchFolders.map(async (folder) => {
          counts[folder.id] = await window.api.getWatchFolderBookCount(folder.path);
        }),
      );
      return counts;
    },
    enabled: electronApiAvailable && watchFolders.length > 0,
    staleTime: 30_000,
  });

  const sourceFolders = useMemo(
    () => sourceRoots.map(toSourceFolder),
    [sourceRoots],
  );
  const sourceRootFolders = useMemo<FolderInfo[]>(
    () =>
      sourceRoots.map((root, index) => ({
        name: root.label,
        path: root.path,
        fullPath: root.path,
        bookCount: 0,
        subfolders: visibleFolders((sourceStructureQueries[index]?.data ?? []) as FolderInfo[]),
        hasChildren: true,
        isLoaded: true,
      })),
    [sourceRoots, sourceStructureQueries],
  );
  const folderStructure = useMemo(
    () => [
      ...visibleFolders((folderTreeQuery.data ?? []) as FolderInfo[]),
      ...sourceRootFolders,
    ],
    [folderTreeQuery.data, sourceRootFolders],
  );
  const libraryFolders = useMemo(
    () => (libraryFoldersQuery.data ?? []) as string[],
    [libraryFoldersQuery.data],
  );
  const watchFolderCounts = watchFolderCountsQuery.data ?? {};
  const isLoading =
    folderTreeQuery.isLoading ||
    libraryFoldersQuery.isLoading ||
    libraryRootsQuery.isLoading ||
    watchFoldersQuery.isLoading ||
    sourceStructureQueries.some((query) => query.isLoading);

  const watchFolderPaths = useMemo(
    () => new Set(watchFolders.map((folder) => folder.path)),
    [watchFolders],
  );

  const value = useMemo<LibraryContextValue>(
    () => ({
      folderStructure,
      selectedFolder,
      sourceFolders,
      watchFolders,
      watchFolderCounts,
      libraryRoots,
      libraryFolders,
      watchFolderPaths,
      isLoading,
      selectFolder: setSelectedFolder,
      refreshFolders,
      ...operations,
    }),
    [
      folderStructure,
      isLoading,
      libraryFolders,
      libraryRoots,
      operations,
      refreshFolders,
      selectedFolder,
      sourceFolders,
      watchFolderPaths,
      watchFolders,
      watchFolderCounts,
    ],
  );

  return (
    <LibraryContext.Provider value={value}>
      {children}
    </LibraryContext.Provider>
  );
}

export function useLibraryContext() {
  const context = useContext(LibraryContext);
  if (!context) {
    throw new Error("useLibraryContext must be used inside LibraryProvider");
  }
  return context;
}

export function useOptionalLibraryContext() {
  return useContext(LibraryContext);
}
