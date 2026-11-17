import {
  BookOpenText,
  FileStack,
  Home,
  LibraryBig,
  LogIn,
  LogOut,
  RefreshCw,
  Search,
  Settings,
  UserCircle,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { openWhatsNew } from "../features/whats-new/whatsNewEvents";
import { openCommandPalette } from "../features/search/commandPaletteEvents";
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
    ? "absolute bottom-0 left-0 top-10 z-40 border-r border-border-strong bg-overlay shadow-2xl shadow-shadow backdrop-blur"
    : "bg-surface";
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
        {settings.betaConversionEnabled && (
          <SidebarItem
            Icon={FileStack}
            label={routeLabel("pdfBuilder")}
            active={pathname === "/pdf-builder"}
            onClick={() => navigate("/pdf-builder")}
            collapsed={collapsed}
            routeId="pdfBuilder"
          />
        )}
      </nav>

      <div className="flex flex-col mt-auto mb-3 text-foreground-subtle text-center">
        <SidebarItem
          Icon={Search}
          label={t("common:palette.open")}
          active={false}
          onClick={openCommandPalette}
          collapsed={collapsed}
        />
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
              <div className="mx-3 mt-1 truncate text-left text-[11px] text-foreground-subtle">
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
          <button
            type="button"
            onClick={openWhatsNew}
            title={t("common:whatsNew.open")}
            className="rounded px-1.5 py-0.5 transition-colors hover:bg-surface-muted hover:text-foreground"
          >
            v{import.meta.env.VITE_APP_VERSION}
          </button>
        </div>
      </div>
    </aside>
  );
}
