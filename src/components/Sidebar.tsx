import {
  BookMarkedIcon,
  BookOpenText,
  BookPlus,
  Home,
  LogIn,
  PanelRight,
  Wrench,
} from "lucide-react";
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import SidebarItem from "./SidebarItem";
// TODO Add option to hide this SideBar

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  return (
    <aside
      className={`bg-zinc-900 border-r text-zinc-100 border-zinc-800 flex flex-col ${collapsed ? "w-14" : "w-60"}`}
    >
      <header className={`flex px-4 py-4 text-zinc-300 ${!collapsed && "justify-end"}`}>
        <button className="cursor-pointer" onClick={() => setCollapsed(!collapsed)}>
          <PanelRight size={18} className="text-right" />
        </button>
      </header>
      <nav className="space-y-2 mt-2">

        <SidebarItem Icon={Home} label="Dashboard" active={pathname === "/"} onClick={() => navigate("/")} collapsed={collapsed} />
        <SidebarItem Icon={BookOpenText} label="Ler" active={pathname === "/reading"} onClick={() => navigate("reading")} collapsed={collapsed} />
        <SidebarItem Icon={BookPlus} label="Registrar Leituras" active={pathname === "/add_reading"} onClick={() => navigate("/add_reading")} collapsed={collapsed} />
        <SidebarItem Icon={LogIn} label="Login" active={pathname === "/signin"} onClick={() => navigate("/signin")} collapsed={collapsed} />
      </nav>

      <div className="mt-auto mb-2 text-xs text-center text-zinc-500">v1.0.5</div>
    </aside>
  );
}
