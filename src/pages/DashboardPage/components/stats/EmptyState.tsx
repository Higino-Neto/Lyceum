import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export default function EmptyState({ icon: Icon, message, action, compact = false }: { icon?: LucideIcon; message: string; action?: ReactNode; compact?: boolean }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 text-center text-sm text-foreground-subtle ${compact ? "py-4" : "py-10"}`}>
      {Icon && <Icon size={20} strokeWidth={1.5} />}
      <p className="max-w-sm">{message}</p>
      {action}
    </div>
  );
}
