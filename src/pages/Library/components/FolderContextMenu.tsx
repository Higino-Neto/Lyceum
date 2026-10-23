import { FilePlus, FolderPlus, Pencil, Trash2, Unlink } from "lucide-react";
import { FolderInfo } from "../../../types/LibraryTypes";
import { classifyFolder } from "../utils";
import { useTranslation } from "../../../i18n";

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
  const { t } = useTranslation();
  const folderType = classifyFolder(folder.name);
  return (
    <div
      className="fixed z-50 min-w-[140px] rounded-sm border border-border-strong bg-surface-muted py-1 shadow-lg"
      style={{ left: x, top: y }}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        onClick={() => onCreateFolder(folder)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-foreground hover:bg-border-strong"
      >
        <FolderPlus size={14} />
        {t("library:folders.newFolder")}
      </button>
      {onImportBook && (
        <button
          onClick={() => onImportBook(folder)}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-foreground hover:bg-border-strong"
        >
          <FilePlus size={14} />
          {t("library:folders.addBook")}
        </button>
      )}
      <button
        onClick={() => onRenameFolder(folder)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-foreground hover:bg-border-strong"
      >
        <Pencil size={14} />
        {t("library:folders.rename")}
      </button>
      <div className="my-1 border-t border-border-strong" />
      {folderType !== "normal" && onDissolveFolder && (
        <button
          onClick={() => onDissolveFolder(folder)}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-destructive hover:bg-destructive-muted"
        >
          <Unlink size={14} />
          {folderType === "collection"
            ? t("library:folders.removeCollection")
            : t("library:folders.ungroup")}
        </button>
      )}
      <button
        onClick={() => onDeleteFolder(folder)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-destructive hover:bg-border-strong"
      >
        <Trash2 size={14} />
        {t("library:folders.delete")}
      </button>
    </div>
  );
}
