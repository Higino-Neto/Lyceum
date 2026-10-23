import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { useTranslation } from "../../../../i18n";

export default function FolderTreeSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    const timer = setTimeout(() => onChange(draft), 180);
    return () => clearTimeout(timer);
  }, [draft, onChange]);

  return (
    <div className="relative">
      <Search
        size={14}
        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground-subtle"
      />
      <input
        type="text"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={t("library:folderTree.searchPlaceholder")}
        className="w-full rounded-sm border border-border-strong bg-surface-muted py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-input-placeholder focus:border-primary focus:outline-none"
      />
    </div>
  );
}
