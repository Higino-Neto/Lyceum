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
      className={`
        group flex items-center px-4 w-full h-12 cursor-pointer
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
    </button>
  );
}
