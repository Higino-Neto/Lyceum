import { FolderPlus, HardDrive } from "lucide-react";
import { useTranslation } from "../../../../i18n";

export default function FolderTreeEmpty({
  canAddSource,
  onAddWatch,
  onAddSource,
}: {
  canAddSource: boolean;
  onAddWatch: () => void;
  onAddSource: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center gap-3 px-4 py-6">
      <p className="cursor-default text-xs text-zinc-500">
        {t("library:folderTree.empty")}
      </p>
      <button
        onClick={onAddWatch}
        className="flex cursor-pointer items-center gap-1.5 text-xs text-zinc-400 transition-colors hover:text-zinc-200"
      >
        <FolderPlus size={13} />
        {t("library:folderTree.addExternalFolder")}
      </button>
      {canAddSource && (
        <button
          onClick={onAddSource}
          className="flex cursor-pointer items-center gap-1.5 text-xs text-zinc-400 transition-colors hover:text-zinc-200"
        >
          <HardDrive size={13} />
          {t("library:folderTree.addSourceFolder")}
        </button>
      )}
    </div>
  );
}
