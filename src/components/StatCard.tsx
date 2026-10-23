import { LucideIcon } from "lucide-react";

type Props = {
  icon?: LucideIcon;
  value?: JSX.Element;
  extraInfo?: JSX.Element;
};

const ICON_SIZE = 16;
const STROKE_WIDTH = 1.5;

export default function StatCard({ icon: Icon, value, extraInfo }: Props) {
  return (
    <div className="lyceum-interactive-card bg-surface border border-border rounded-sm p-4 hover:border-border-strong transition group">
      <div className="flex items-center gap-3">
        {Icon && (
          <Icon 
            size={ICON_SIZE} 
            className="text-foreground-subtle group-hover:text-foreground-muted transition-colors"
            strokeWidth={STROKE_WIDTH}
          />
        )}
        <div className="flex flex-col gap-0.5">
          <h3 className="text-2xl font-semibold tracking-tight">
            {value}
          </h3>
          <a className="text-primary text-sm">{extraInfo}</a>
        </div>
      </div>
    </div>
  );
}
