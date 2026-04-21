import {
  BookOpenText,
  BookPlus,
  CheckSquare,
  Home,
  LibraryBig,
  LogIn,
  User,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import SidebarItem from "./SidebarItem";
import { useRouteState } from "../hooks/useRouteState";

interface SidebarProps {
  collapsed: boolean;
  autoHideEnabled: boolean;
  panelsVisible: boolean;
  onShowPanels: () => void;
  onHidePanels: () => void;
}

export default function Sidebar({
  collapsed,
  autoHideEnabled,
  panelsVisible,
  onShowPanels,
  onHidePanels,
}: SidebarProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useRouteState();

  const sidebarWidth = autoHideEnabled && !panelsVisible ? "w-0" : (collapsed ? "w-13" : "w-42");
  const sidebarClasses = `bg-zinc-900 flex flex-col transition-all duration-200 ${sidebarWidth}`;

  return (
    <aside className={sidebarClasses} onMouseEnter={onShowPanels}>
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
          Icon={User}
          label="Perfil"
          active={pathname === "/profile"}
          onClick={() => navigate("/profile")}
          collapsed={collapsed}
        />
        <SidebarItem
          Icon={LogIn}
          label="Login"
          active={pathname === "/signin"}
          onClick={() => navigate("/signin")}
          collapsed={collapsed}
        />
        <div className="mt-2 text-xs">
          <span>v{import.meta.env.VITE_APP_VERSION}</span>
        </div>
      </div>
    </aside>
  );
}
