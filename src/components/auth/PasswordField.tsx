import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { AuthField, authInputClasses } from "./AuthShell";
import { useTranslation, type TranslationKey } from "../../i18n";

interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  showLabelKey?: TranslationKey;
  hideLabelKey?: TranslationKey;
  autoComplete?: string;
  minLength?: number;
  required?: boolean;
}

export function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  showLabelKey = "auth:password.show",
  hideLabelKey = "auth:password.hide",
  autoComplete,
  minLength,
  required = true,
}: PasswordFieldProps) {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const toggleLabel = t(isVisible ? hideLabelKey : showLabelKey);

  return (
    <AuthField label={label}>
      <div className="relative">
        <input
          type={isVisible ? "text" : "password"}
          placeholder={placeholder}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`${authInputClasses} pr-11`}
        />
        <button
          type="button"
          className="absolute right-1 top-1 inline-flex h-9 w-9 items-center justify-center rounded text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-100"
          onClick={() => setIsVisible((current) => !current)}
          aria-label={toggleLabel}
          title={toggleLabel}
        >
          {isVisible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
    </AuthField>
  );
}
