import { Check, X } from "lucide-react";
import { getPasswordRequirements } from "../../utils/auth";
import { useTranslation } from "../../i18n";

export function PasswordRequirements({ password }: { password: string }) {
  const { t } = useTranslation();
  const requirements = getPasswordRequirements(password);

  return (
    <ul className="grid gap-2 text-xs text-foreground-subtle sm:grid-cols-2">
      {requirements.map((requirement) => {
        const Icon = requirement.met ? Check : X;
        return (
          <li
            key={requirement.id}
            className={requirement.met ? "flex items-center gap-2 text-success" : "flex items-center gap-2"}
          >
            <Icon size={14} />
            <span>{t(requirement.labelKey, requirement.values)}</span>
          </li>
        );
      })}
    </ul>
  );
}
