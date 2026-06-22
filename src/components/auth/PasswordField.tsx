import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { AuthField, authInputClasses } from "./AuthShell";

interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  minLength?: number;
  required?: boolean;
}

export function PasswordField({
  label,
  value,
  onChange,
  placeholder = "Senha",
  autoComplete,
  minLength,
  required = true,
}: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);

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
          aria-label={isVisible ? "Ocultar senha" : "Mostrar senha"}
          title={isVisible ? "Ocultar senha" : "Mostrar senha"}
        >
          {isVisible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
    </AuthField>
  );
}
