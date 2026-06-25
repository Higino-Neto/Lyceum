import { LucideIcon } from "lucide-react";

export default function SidebarItem({
  Icon,
  active,
  label,
  collapsed,
  onClick,
  badgeCount = 0,
}: {
  Icon: LucideIcon;
  label: string;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
  badgeCount?: number;
}) {
  return (
    <button
      title={label}
      onClick={onClick}
      className={`
        group relative flex items-center px-4 w-full h-12 cursor-pointer
        ${active ? "bg-zinc-800" : ""}
        ${collapsed ? "" : "justify-start"}
      `}
    >
      <Icon 
        size={18} 
        className={`group-hover:text-zinc-100 ${active ? "text-zinc-100" : "text-zinc-400"}`} 
      />
      {!collapsed && (
        <span className={`ml-3 ${active ? "text-zinc-100" : "text-zinc-400"}`}>
          {label}
        </span>
      )}
      {badgeCount > 0 && (
        <span
          className={`absolute inline-flex min-w-5 items-center justify-center rounded-full bg-green-500 px-1.5 text-[11px] font-semibold text-black ${
            collapsed ? "right-2 top-2" : "right-3"
          }`}
        >
          {badgeCount}
        </span>
      )}
    </button>
  );
}
