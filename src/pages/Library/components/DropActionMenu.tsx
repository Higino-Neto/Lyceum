import { GitMerge } from "lucide-react";
import { useTranslation } from "../../../i18n";

interface DropActionMenuProps {
  x: number;
  y: number;
  onMerge: () => void;
  onClose: () => void;
}

export default function DropActionMenu({
  x,
  y,
  onMerge,
  onClose,
}: DropActionMenuProps) {
  const { t } = useTranslation();

  return (
    <div
      className="fixed z-50 min-w-[220px] max-w-[280px] rounded-sm border border-border-strong bg-surface-muted py-1 shadow-lg"
      style={{ left: x, top: y }}
      onClick={(event) => event.stopPropagation()}
      onMouseLeave={onClose}
    >
      <button
        type="button"
        onClick={onMerge}
        className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-border-strong"
      >
        <GitMerge size={14} className="mt-0.5 shrink-0" />
        <span>
          <span className="block">{t("library:dropMenu.mergeBooks")}</span>
          <span className="block text-xs text-foreground-subtle">{t("library:dropMenu.mergeBooksHint")}</span>
        </span>
      </button>
    </div>
  );
}
