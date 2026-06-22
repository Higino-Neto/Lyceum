import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface AuthShellProps {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthShell({
  title,
  subtitle,
  icon: Icon,
  children,
  footer,
}: AuthShellProps) {
  return (
    <div className="min-h-full bg-zinc-950 text-zinc-100">
      <section className="flex min-h-[calc(100vh-54px)] items-center justify-center px-5 py-8 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-7 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-green-500/30 bg-green-500/10 text-green-400">
              <Icon size={20} />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-normal text-zinc-50">
                {title}
              </h1>
              <p className="mt-1 text-sm leading-6 text-zinc-400">{subtitle}</p>
            </div>
          </div>

          <div className="rounded border border-zinc-800 bg-zinc-900/80 p-5 shadow-2xl shadow-black/30 sm:p-6">
            {children}
          </div>

          {footer && (
            <div className="mt-5 text-center text-sm text-zinc-400">{footer}</div>
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
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </span>
      {children}
    </label>
  );
}

export const authInputClasses =
  "h-11 w-full rounded border border-zinc-700 bg-zinc-950/70 px-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-green-500 disabled:cursor-not-allowed disabled:opacity-60";

export const authButtonClasses =
  "inline-flex h-11 w-full items-center justify-center gap-2 rounded bg-green-600 px-4 text-sm font-semibold text-black transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50";
