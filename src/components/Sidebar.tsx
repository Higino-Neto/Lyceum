import {
  BookOpenText,
  BookPlus,
  CheckSquare,
  Home,
  LibraryBig,
  LogIn,
  LogOut,
  Map,
  RefreshCw,
  Settings,
  UserCircle,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import SidebarItem from "./SidebarItem";
import { useRouteState } from "../hooks/useRouteState";
import { useAppSettings } from "../contexts/AppSettingsContext";
import { useTranslation } from "../i18n";
import { getRouteLabel } from "../navigation/routes";

interface SidebarProps {
  collapsed: boolean;
  autoHideEnabled: boolean;
  autoHideOverlay: boolean;
  panelsVisible: boolean;
  onShowPanels: () => void;
  onHidePanels: () => void;
  settingsOpen?: boolean;
  conversionOpen?: boolean;
  onOpenSettings?: () => void;
  onOpenConversion?: () => void;
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
  conversionOpen = false,
  onOpenSettings,
  onOpenConversion,
  onOpenAccountSettings,
  onSignOut,
  isLoggedIn = true,
  userEmail,
  friendRequestCount = 0,
}: SidebarProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { settings } = useAppSettings();
  const { t } = useTranslation();
  const routeLabel = (id: Parameters<typeof getRouteLabel>[0]) => getRouteLabel(id, t);

  useRouteState();

  const isOverlayMode = autoHideEnabled && autoHideOverlay;
  const isHidden = autoHideEnabled && !panelsVisible;
  const sidebarWidth =
    isHidden && !autoHideOverlay
      ? "w-0 overflow-hidden"
      : collapsed
        ? "w-13"
        : "w-42";
  const sidebarPosition = isOverlayMode
    ? "absolute bottom-0 left-0 top-10 z-40 border-r border-zinc-700/80 bg-zinc-900/95 shadow-2xl shadow-black/40 backdrop-blur"
    : "bg-zinc-900";
  const sidebarVisibility =
    isOverlayMode && isHidden
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
        {isLoggedIn && (
        <SidebarItem
          Icon={Home}
          label={routeLabel("dashboard")}
          active={pathname === "/"}
          onClick={() => navigate("/")}
          collapsed={collapsed}
          routeId="dashboard"
        />
        )}
        {isLoggedIn && (
        <SidebarItem
          Icon={BookPlus}
          label={routeLabel("register")}
          active={pathname === "/add_reading"}
          onClick={() => navigate("/add_reading")}
          collapsed={collapsed}
          routeId="register"
        />
        )}
        <SidebarItem
          Icon={LibraryBig}
          label={routeLabel("library")}
          active={pathname === "/library"}
          onClick={() => navigate("/library")}
          collapsed={collapsed}
          routeId="library"
        />
        <SidebarItem
          Icon={BookOpenText}
          label={routeLabel("reader")}
          active={pathname === "/reading"}
          onClick={() => navigate("/reading")}
          collapsed={collapsed}
          routeId="reader"
        />
        {settings.betaAtlasEnabled && (
          <SidebarItem
            Icon={Map}
            label={routeLabel("atlas")}
            active={pathname === "/atlas"}
            onClick={() => navigate("/atlas")}
            collapsed={collapsed}
            routeId="atlas"
          />
        )}
        {settings.betaConversionEnabled && (
          <SidebarItem
            Icon={RefreshCw}
            label={routeLabel("conversion")}
            active={conversionOpen}
            onClick={() => onOpenConversion?.()}
            collapsed={collapsed}
            routeId="conversion"
          />
        )}
        {settings.betaHabitsEnabled && (
          <SidebarItem
            Icon={CheckSquare}
            label={routeLabel("habits")}
            active={pathname === "/habit_tracker"}
            onClick={() => navigate("/habit_tracker")}
            collapsed={collapsed}
            routeId="habits"
          />
        )}
      </nav>

      <div className="flex flex-col mt-auto mb-3 text-zinc-500 text-center">
        <SidebarItem
          Icon={Settings}
          label={t("navigation:sidebar.settings")}
          active={settingsOpen}
          onClick={() => onOpenSettings?.()}
          collapsed={collapsed}
          badgeCount={friendRequestCount}
        />
        {isLoggedIn ? (
          <>
            <SidebarItem
              Icon={UserCircle}
              label={t("navigation:sidebar.account")}
              active={false}
              onClick={() => onOpenAccountSettings?.()}
              collapsed={collapsed}
            />
            <SidebarItem
              Icon={LogOut}
              label={t("navigation:sidebar.signOut")}
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
            label={t("navigation:sidebar.signIn")}
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
