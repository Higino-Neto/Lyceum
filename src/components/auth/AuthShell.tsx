import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { useTranslation, type TranslationKey } from "../../i18n";

interface AuthShellProps {
  titleKey: TranslationKey;
  subtitleKey: TranslationKey;
  icon: LucideIcon;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthShell({
  titleKey,
  subtitleKey,
  icon: Icon,
  children,
  footer,
}: AuthShellProps) {
  const { t } = useTranslation();

  return (
    <div className="min-h-full bg-background text-foreground">
      <section className="flex min-h-[calc(100vh-54px)] items-center justify-center px-5 py-8 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-7 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-primary-border bg-primary-muted text-primary">
              <Icon size={20} />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-normal text-foreground">
                {t(titleKey)}
              </h1>
              <p className="mt-1 text-sm leading-6 text-foreground-muted">
                {t(subtitleKey)}
              </p>
            </div>
          </div>

          <div className="rounded border border-border bg-surface/80 p-5 shadow-2xl shadow-shadow sm:p-6">
            {children}
          </div>

          {footer && (
            <div className="mt-5 text-center text-sm text-foreground-muted">{footer}</div>
          )}
        </div>
      </section>
    </div>
  );
}

export function AuthField({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-foreground-subtle">
        {label}
      </span>
      {children}
    </label>
  );
}

export const authInputClasses =
  "h-11 w-full rounded border border-border-strong bg-input px-3 text-sm text-foreground outline-none transition placeholder:text-input-placeholder focus:border-focus-ring disabled:cursor-not-allowed disabled:opacity-60";

export const authButtonClasses =
  "inline-flex h-11 w-full items-center justify-center gap-2 rounded bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50";
