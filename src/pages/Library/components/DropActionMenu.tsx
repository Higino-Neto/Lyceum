import { GitMerge, Layers } from "lucide-react";
import { useTranslation } from "../../../i18n";

interface DropActionMenuProps {
  x: number;
  y: number;
  onMerge: () => void;
  onCreateCollection: () => void;
  onClose: () => void;
}

export default function DropActionMenu({
  x,
  y,
  onMerge,
  onCreateCollection,
  onClose,
}: DropActionMenuProps) {
  const { t } = useTranslation();

  return (
    <div
      className="fixed z-50 min-w-[180px] rounded-sm border border-border-strong bg-surface-muted py-1 shadow-lg"
      style={{ left: x, top: y }}
      onClick={(event) => event.stopPropagation()}
      onMouseLeave={onClose}
    >
      <button
        type="button"
        onClick={onCreateCollection}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-border-strong"
      >
        <Layers size={14} />
        {t("library:dropMenu.createCollection")}
      </button>
      <button
        type="button"
        onClick={onMerge}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-border-strong"
      >
        <GitMerge size={14} />
        {t("library:dropMenu.mergeBooks")}
      </button>
    </div>
  );
}
