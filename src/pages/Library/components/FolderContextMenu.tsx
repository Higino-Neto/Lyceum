import { FilePlus, FolderPlus, Pencil, Trash2, Unlink } from "lucide-react";
import { FolderInfo } from "../../../types/LibraryTypes";
import { classifyFolder } from "../utils";

interface FolderContextMenuProps {
  folder: FolderInfo;
  x: number;
  y: number;
  onCreateFolder: (folder: FolderInfo) => void;
  onRenameFolder: (folder: FolderInfo) => void;
  onDeleteFolder: (folder: FolderInfo) => void;
  onDissolveFolder?: (folder: FolderInfo) => void;
  onImportBook?: (folder: FolderInfo) => void;
}

export default function FolderContextMenu({
  folder,
  x,
  y,
  onCreateFolder,
  onImportBook,
  onRenameFolder,
  onDeleteFolder,
  onDissolveFolder,
}: FolderContextMenuProps) {
  const folderType = classifyFolder(folder.name);
  return (
    <div
      className="fixed z-50 min-w-[140px] rounded-sm border border-zinc-700 bg-zinc-800 py-1 shadow-lg"
      style={{ left: x, top: y }}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        onClick={() => onCreateFolder(folder)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-zinc-300 hover:bg-zinc-700"
      >
        <FolderPlus size={14} />
        Nova pasta
      </button>
      {onImportBook && (
        <button
          onClick={() => onImportBook(folder)}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-zinc-300 hover:bg-zinc-700"
        >
          <FilePlus size={14} />
          Adicionar livro
        </button>
      )}
      <button
        onClick={() => onRenameFolder(folder)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-zinc-300 hover:bg-zinc-700"
      >
        <Pencil size={14} />
        Renomear
      </button>
      <div className="my-1 border-t border-zinc-700" />
      {folderType !== "normal" && onDissolveFolder && (
        <button
          onClick={() => onDissolveFolder(folder)}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-amber-300 hover:bg-zinc-700"
        >
          <Unlink size={14} />
          {folderType === "collection" ? "Remover colecao" : "Desmesclar"}
        </button>
      )}
      <button
        onClick={() => onDeleteFolder(folder)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-red-400 hover:bg-zinc-700"
      >
        <Trash2 size={14} />
        Excluir
      </button>
    </div>
  );
}
