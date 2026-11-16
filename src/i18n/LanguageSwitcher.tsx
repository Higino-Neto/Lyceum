import { Languages } from "lucide-react";

import { useTranslation } from "./useTranslation";
import { useLanguage } from "./useLanguage";
import Select, { SelectItem } from "../components/ui/Select";

interface LanguageSwitcherProps {
  className?: string;
  label?: string;
  withIcon?: boolean;
}

/**
 * Language picker used by the settings panel. The option list is derived from
 * `SUPPORTED_LANGUAGES`, so a new language shows up here automatically.
 */
export default function LanguageSwitcher({
  className = "",
  label,
  withIcon = true,
}: LanguageSwitcherProps) {
  const { t } = useTranslation("settings");
  const { language, options, changeLanguage } = useLanguage();

  const itemOptions: SelectItem[] = options.map(book => ({
    value: book.code,
    label: book.label
  }));

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {withIcon && <Languages size={16} className="shrink-0 text-foreground-subtle" />}
      <Select
        value={language}
        onChange={(event) => void changeLanguage(event)}
        items={itemOptions}
        ariaLabel={label ?? t("settings:language.label")}
      />
    </div>
  );
}
