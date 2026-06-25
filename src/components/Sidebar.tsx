import {
  BookOpenText,
  BookPlus,
  CheckSquare,
  Home,
  LibraryBig,
  LogIn,
  LogOut,
  Map,
  Settings,
  UserCircle,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import SidebarItem from "./SidebarItem";
import { useRouteState } from "../hooks/useRouteState";

interface SidebarProps {
  collapsed: boolean;
  autoHideEnabled: boolean;
  autoHideOverlay: boolean;
  panelsVisible: boolean;
  onShowPanels: () => void;
  onHidePanels: () => void;
  settingsOpen?: boolean;
  onOpenSettings?: () => void;
  onOpenAccountSettings?: () => void;
  onSignOut?: () => void;
  isLoggedIn?: boolean;
  userEmail?: string | null;
  friendRequestCount?: number;
}

export default function Sidebar({
  collapsed,
  autoHideEnabled,
  autoHideOverlay,
  panelsVisible,
  onShowPanels,
  onHidePanels,
  settingsOpen = false,
  onOpenSettings,
  onOpenAccountSettings,
  onSignOut,
  isLoggedIn = true,
  userEmail,
  friendRequestCount = 0,
}: SidebarProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useRouteState();

  const isOverlayMode = autoHideEnabled && autoHideOverlay;
  const isHidden = autoHideEnabled && !panelsVisible;
  const sidebarWidth = isHidden && !autoHideOverlay
    ? "w-0 overflow-hidden"
    : (collapsed ? "w-13" : "w-42");
  const sidebarPosition = isOverlayMode
    ? "absolute bottom-0 left-0 top-10 z-40 border-r border-zinc-700/80 bg-zinc-900/95 shadow-2xl shadow-black/40 backdrop-blur"
    : "bg-zinc-900";
  const sidebarVisibility = isOverlayMode && isHidden
    ? "pointer-events-none -translate-x-full opacity-0"
    : "translate-x-0 opacity-100";
  const sidebarClasses = `lyceum-sidebar flex flex-col transition-[width,opacity,transform] duration-200 ease-out ${sidebarWidth} ${sidebarPosition} ${sidebarVisibility}`;

  return (
    <aside
      className={sidebarClasses}
      onMouseEnter={onShowPanels}
      onMouseLeave={onHidePanels}
    >
      <nav className="flex flex-col gap-2 mt-4">
        <SidebarItem
          Icon={Home}
          label="Dashboard"
          active={pathname === "/"}
          onClick={() => navigate("/")}
          collapsed={collapsed}
        />
        <SidebarItem
          Icon={BookPlus}
          label="Registrar"
          active={pathname === "/add_reading"}
          onClick={() => navigate("/add_reading")}
          collapsed={collapsed}
        />
        <SidebarItem
          Icon={LibraryBig}
          label="Biblioteca"
          active={pathname === "/library"}
          onClick={() => navigate("/library")}
          collapsed={collapsed}
        />
        <SidebarItem
          Icon={Map}
          label="Atlas"
          active={pathname === "/atlas"}
          onClick={() => navigate("/atlas")}
          collapsed={collapsed}
        />
        <SidebarItem
          Icon={BookOpenText}
          label="Ler"
          active={pathname === "/reading"}
          onClick={() => navigate("/reading")}
          collapsed={collapsed}
        />
        <SidebarItem
          Icon={CheckSquare}
          label="Hábitos"
          active={pathname === "/habit_tracker"}
          onClick={() => navigate("/habit_tracker")}
          collapsed={collapsed}
        />
      </nav>

      <div className="flex flex-col mt-auto mb-3 text-zinc-500 text-center">
        <SidebarItem
          Icon={Settings}
          label="Configurações"
          active={settingsOpen}
          onClick={() => onOpenSettings?.()}
          collapsed={collapsed}
          badgeCount={friendRequestCount}
        />
        {isLoggedIn ? (
          <>
            <SidebarItem
              Icon={UserCircle}
              label="Conta"
              active={false}
              onClick={() => onOpenAccountSettings?.()}
              collapsed={collapsed}
            />
            <SidebarItem
              Icon={LogOut}
              label="Sair"
              active={false}
              onClick={() => onSignOut?.()}
              collapsed={collapsed}
            />
            {!collapsed && userEmail && (
              <div className="mx-3 mt-1 truncate text-left text-[11px] text-zinc-600">
                {userEmail}
              </div>
            )}
          </>
        ) : (
          <SidebarItem
            Icon={LogIn}
            label="Login"
            active={pathname === "/signin"}
            onClick={() => navigate("/signin")}
            collapsed={collapsed}
          />
        )}
        <div className="mt-2 text-xs">
          <span>v{import.meta.env.VITE_APP_VERSION}</span>
        </div>
      </div>
    </aside>
  );
}
