import {
  ArrowUp,
  ChevronRight,
  FilePlus,
  Folder,
  FolderPlus,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { BookWithThumbnail, FolderInfo } from "../../../types/LibraryTypes";
import {
  folderPathsEqual,
  getFolderBookCount,
  getFolderBreadcrumbs,
  getParentFolderPath,
  normalizeFolderPath,
} from "../utils";
import FolderCard from "./FolderCard";
import FolderContextMenu from "./FolderContextMenu";

interface FolderPathBarProps {
  folders: FolderInfo[];
  selectedFolder: string | null;
  onFolderSelect: (folderPath: string | null) => void;
  onCreateFolder?: (parentPath: string | null) => void;
  onImportBook?: (targetFolder: string | null) => void;
}

interface FolderGridProps {
  folders: FolderInfo[];
  onFolderSelect: (folderPath: string | null) => void;
  books?: BookWithThumbnail[];
  selectedFolder?: string | null;
  draggingBookHashes?: string[];
  onCreateFolder?: (parentPath: string | null) => void;
  onImportBook?: (targetFolder: string | null) => void;
  onRenameFolder?: (folder: FolderInfo) => void;
  onDeleteFolder?: (folder: FolderInfo) => void;
  onMoveBook?: (
    fileHash: string,
    targetFolder: string | null,
  ) => Promise<boolean>;
  onMoveBooks?: (
    fileHashes: string[],
    targetFolder: string | null,
  ) => Promise<boolean>;
}

interface FolderGridContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  folder: FolderInfo | null;
}

function bookBelongsToFolder(book: BookWithThumbnail, folder: FolderInfo) {
  const normalizedBookFolder = normalizeFolderPath(book.folderPath);
  const normalizedFolder = normalizeFolderPath(folder.fullPath);
  if (!normalizedBookFolder || !normalizedFolder) return false;

  return (
    folderPathsEqual(normalizedBookFolder, normalizedFolder) ||
    normalizedBookFolder.startsWith(`${normalizedFolder}/`)
  );
}

function folderCoverPreviews(folder: FolderInfo, books: BookWithThumbnail[]) {
  const previewBooks = books
    .filter((book) => bookBelongsToFolder(book, folder))
    .filter((book) => book.thumbnail || book.thumbnailPath)
    .slice(0, 3);

  return {
    coverPreviews: previewBooks
      .map((book) => book.thumbnail)
      .filter((thumbnail): thumbnail is string => Boolean(thumbnail)),
    coverPreviewPaths: previewBooks
      .map((book) => book.thumbnailPath)
      .filter((thumbnailPath): thumbnailPath is string =>
        Boolean(thumbnailPath),
      ),
  };
}

function isAbsoluteFolderPath(folderPath: string) {
  return /^[a-zA-Z]:[\\/]/.test(folderPath) || folderPath.startsWith("/") || folderPath.startsWith("\\\\");
}

export function FolderPathBar({
  folders,
  selectedFolder,
  onFolderSelect,
  onCreateFolder,
  onImportBook,
}: FolderPathBarProps) {
  const breadcrumbs = useMemo(
    () => getFolderBreadcrumbs(folders, selectedFolder),
    [folders, selectedFolder],
  );
  const parentPath = useMemo(
    () => getParentFolderPath(folders, selectedFolder),
    [folders, selectedFolder],
  );

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-zinc-900 pb-3">
      <button
        type="button"
        onClick={() => onFolderSelect(parentPath)}
        disabled={!selectedFolder}
        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-sm border border-zinc-800 bg-zinc-900 text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
        title="Subir pasta"
      >
        <ArrowUp size={16} />
      </button>

      <nav className="flex min-w-0 flex-1 items-center overflow-hidden rounded-sm border border-zinc-800 bg-zinc-900 px-2">
        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1;

          return (
            <div
              key={`${crumb.path ?? "root"}-${index}`}
              className="flex min-w-0 items-center"
            >
              {index > 0 && (
                <ChevronRight
                  size={13}
                  className="mx-1 flex-shrink-0 text-zinc-600"
                />
              )}
              <button
                type="button"
                onClick={() => onFolderSelect(crumb.path)}
                disabled={isLast}
                className={`min-w-0 truncate rounded-sm px-2 py-2 text-left text-xs transition-colors ${
                  isLast
                    ? "cursor-default font-medium text-zinc-100"
                    : "cursor-pointer text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                }`}
                title={crumb.label}
              >
                {crumb.label}
              </button>
            </div>
          );
        })}
      </nav>

      {onCreateFolder && (
        <button
          type="button"
          onClick={() => onCreateFolder(selectedFolder)}
          className="flex h-9 cursor-pointer items-center gap-2 rounded-sm border border-zinc-800 bg-zinc-900 px-3 text-xs font-medium text-zinc-300 transition-colors hover:border-green-500/60 hover:bg-green-500/10 hover:text-green-200"
        >
          <FolderPlus size={15} />
          Nova pasta
        </button>
      )}

      {onImportBook && (
        <button
          type="button"
          onClick={() => onImportBook(selectedFolder)}
          className="flex h-9 cursor-pointer items-center gap-2 rounded-sm border border-zinc-800 bg-zinc-900 px-3 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:bg-zinc-800 hover:text-zinc-100"
        >
          <FilePlus size={15} />
          Adicionar livro
        </button>
      )}
    </div>
  );
}

export function FolderGrid({
  folders,
  onFolderSelect,
  books = [],
  selectedFolder = null,
  draggingBookHashes = [],
  onCreateFolder,
  onImportBook,
  onRenameFolder,
  onDeleteFolder,
  onMoveBook,
  onMoveBooks,
}: FolderGridProps) {
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<FolderGridContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    folder: null,
  });
  const draggingBooks = draggingBookHashes.length > 0;
  const folderCoverMap = useMemo(() => {
    const map = new Map<
      string,
      { coverPreviews: string[]; coverPreviewPaths: string[] }
    >();
    for (const folder of folders) {
      map.set(folder.path, folderCoverPreviews(folder, books));
    }
    return map;
  }, [folders, books]);

  const handleDrop = async (folderPath: string) => {
    if (!draggingBooks) return;

    try {
      const success =
        draggingBookHashes.length > 1 && onMoveBooks
          ? await onMoveBooks(draggingBookHashes, folderPath)
          : onMoveBook
            ? await onMoveBook(draggingBookHashes[0], folderPath)
            : false;

      if (success && draggingBookHashes.length === 1) {
        toast.success("Livro movido");
      }
    } catch (error) {
      toast.error("Erro ao mover livro");
    } finally {
      setDragOverPath(null);
    }
  };

  const closeContextMenu = () => {
    setContextMenu({ visible: false, x: 0, y: 0, folder: null });
  };

  const openContextMenu = (event: React.MouseEvent, folder: FolderInfo) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      folder,
    });
  };

  useEffect(() => {
    if (!contextMenu.visible) return;
    document.addEventListener("click", closeContextMenu);
    return () => document.removeEventListener("click", closeContextMenu);
  }, [contextMenu.visible]);

  return (
    <section className="mb-5">
      <div className="mb-2 flex items-center justify-between px-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Pastas
        </h2>
        <span className="text-[11px] text-zinc-600">
          {folders.length} pasta{folders.length !== 1 ? "s" : ""}
        </span>
      </div>

      {folders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-zinc-800 bg-zinc-950/30 py-10 text-zinc-500">
          <Folder size={32} strokeWidth={1.2} className="mb-3" />
          <p className="text-sm">Nenhuma subpasta</p>
        </div>
      ) : (
        <div
          className={`grid gap-3 pr-1 ${
            folders.length <= 4
              ? "justify-start grid-cols-[repeat(auto-fill,220px)]"
              : "grid-cols-[repeat(auto-fit,minmax(220px,1fr))]"
          }`}
        >
          {folders.map((folder) => {
            const bookCount = getFolderBookCount(folder);
            const isDropTarget = dragOverPath === folder.path;
            const folderCount = folder.subfolders.length;
            const previews = folderCoverMap.get(folder.path) ?? {
              coverPreviews: [],
              coverPreviewPaths: [],
            };

            return (
              <FolderCard
                key={folder.path}
                id={folder.path}
                name={folder.name}
                detail={isAbsoluteFolderPath(folder.path) ? folder.fullPath : undefined}
                bookCount={bookCount}
                folderCount={folderCount}
                coverPreviews={previews.coverPreviews}
                coverPreviewPaths={previews.coverPreviewPaths}
                isSelected={folderPathsEqual(folder.path, selectedFolder)}
                isEmpty={bookCount === 0 && folderCount === 0}
                isDropTarget={isDropTarget}
                onOpen={onFolderSelect}
                onContextMenu={(_, event) => {
                  if (event) openContextMenu(event, folder);
                }}
                onDragOver={(event) => {
                  if (!draggingBooks) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setDragOverPath(folder.path);
                }}
                onDragLeave={() => setDragOverPath(null)}
                onDrop={(event) => {
                  event.preventDefault();
                  handleDrop(folder.path);
                }}
              />
            );
          })}
        </div>
      )}

      {contextMenu.visible && contextMenu.folder && (
        <FolderContextMenu
          folder={contextMenu.folder}
          x={contextMenu.x}
          y={contextMenu.y}
          onCreateFolder={(folder) => {
            closeContextMenu();
            onCreateFolder?.(folder.path);
          }}
          onImportBook={
            onImportBook
              ? (folder) => {
                  closeContextMenu();
                  onImportBook(folder.path);
                }
              : undefined
          }
          onRenameFolder={(folder) => {
            closeContextMenu();
            onRenameFolder?.(folder);
          }}
          onDeleteFolder={(folder) => {
            closeContextMenu();
            onDeleteFolder?.(folder);
          }}
        />
      )}
    </section>
  );
}
