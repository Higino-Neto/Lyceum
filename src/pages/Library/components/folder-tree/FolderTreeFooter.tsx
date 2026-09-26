import { useTranslation } from "../../../../i18n";

export default function FolderTreeFooter({
  folderCount,
  totalBooks,
}: {
  folderCount: number;
  totalBooks: number;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex-shrink-0 border-t border-zinc-800 px-3 py-2 text-xs text-zinc-500">
      <span>
        {t("library:counts.folder", { count: folderCount })} -{" "}
        {t("library:counts.book", { count: totalBooks })}
      </span>
    </div>
  );
}
