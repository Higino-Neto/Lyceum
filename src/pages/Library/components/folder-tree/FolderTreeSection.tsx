import { FolderPlus } from "lucide-react";
import { useTranslation, type TranslationKey } from "../../../../i18n";

export default function FolderTreeSection({
  labelKey,
  onAdd,
}: {
  labelKey: TranslationKey;
  onAdd?: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="mt-3 border-t border-border pt-2">
      <div className="mb-1 flex items-center justify-between px-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-foreground-subtle">
          {t(labelKey)}
        </span>
        {onAdd && (
          <button
            onClick={onAdd}
            className="cursor-pointer rounded-sm p-1 text-foreground-subtle transition-colors hover:bg-surface-muted hover:text-foreground"
            title={t("library:sections.addTo", { label: t(labelKey) })}
          >
            <FolderPlus size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
