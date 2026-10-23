import { Folder } from "lucide-react";
import { useTranslation } from "../../../../i18n";

export default function FolderInlineCreate({
  depth,
  value,
  onChange,
  onSubmit,
  onCancel,
}: {
  depth: number;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1"
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
    >
      <Folder size={15} className="text-foreground-subtle" />
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => {
          if (value.trim()) onSubmit();
          else onCancel();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") onSubmit();
          if (event.key === "Escape") onCancel();
        }}
        className="flex-1 rounded-sm border border-border-strong bg-border-strong px-1.5 py-0.5 text-sm text-foreground focus:outline-none"
        autoFocus
        onClick={(event) => event.stopPropagation()}
        placeholder={t("library:folderTree.newFolderName")}
      />
    </div>
  );
}
