import { useId } from "react";
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
  const selectId = useId();

  const itemOptions: SelectItem[] = options.map(book => ({
    value: book.code,
    label: book.label
  }));

  return (
    <div className="flex items-center gap-2">
      {withIcon && <Languages size={16} className="shrink-0 text-zinc-500" />}
      {/* <select
        id={selectId}
        value={language}
        onChange={(event) => void changeLanguage(event.target.value)}
        aria-label={label ?? t("settings:language.label")}
        className={`w-full cursor-pointer rounded border border-zinc-700 bg-zinc-800/50 px-2 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-green-500 ${className}`}
      >
        {options.map((option) => (
          <option key={option.code} value={option.code}>
            {option.label}
          </option>
        ))}
      </select> */}
      <Select 
        value={language}
        onChange={(event) => void changeLanguage(event)}
        items={itemOptions}
        />
    </div>
  );
}
