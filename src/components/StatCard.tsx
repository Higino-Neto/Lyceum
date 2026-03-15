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
    <div className="bg-zinc-900 border border-zinc-800 rounded-md p-4 hover:border-zinc-700 transition group">
      <div className="flex items-center gap-3">
        {Icon && (
          <Icon 
            size={ICON_SIZE} 
            className="text-zinc-500 group-hover:text-zinc-400 transition-colors" 
            strokeWidth={STROKE_WIDTH}
          />
        )}
        <div className="flex flex-col gap-0.5">
          <h3 className="text-2xl font-semibold tracking-tight">
            {value}
          </h3>
          <a className="text-green-500 text-sm">{extraInfo}</a>
        </div>
      </div>
    </div>
  );
}
