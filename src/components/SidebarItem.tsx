import { LucideIcon } from "lucide-react";

export default function SidebarItem({
  Icon,
  active,
  label,
  collapsed,
  onClick,
}: {
  Icon: LucideIcon;
  label: string;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      title={label}
      onClick={onClick}
      className={`flex items-center gap-2 cursor-pointer w-full text-left px-4 py-2 rounded-sm bg-zinc-850 text-zinc-200 text-sm ${active && `bg-zinc-800 font-semibold text-zinc-200`}`}
    >
      <Icon size={active ? 17 : 16} />
      {!collapsed && label}
    </button>
  );
}
