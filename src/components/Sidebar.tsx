import { BookMarkedIcon,  Wrench } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

export default function Sidebar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return (
    <aside className="w-64 bg-zinc-900 border-r text-zinc-100 border-zinc-800 p-6 flex flex-col">
      <div className="flex gap-2 items-center">
        <BookMarkedIcon className="text-green-500" size={24} />
        <h2 className="text-2xl font-semibold tracking-tight">Lyceum</h2>
      </div>

      <nav className="mt-10 space-y-2 text-sm">
        <button onClick={() => navigate("/")} className={`cursor-pointer w-full text-left px-4 py-2 rounded-lg bg-zinc-850 ${pathname === '/' && (`bg-zinc-800`)}`}>
          Dashboard
        </button>
        <button onClick={() => navigate("/add_reading")} className={`cursor-pointer w-full text-left px-4 py-2 rounded-lg bg-zinc-850 ${pathname === '/add_reading' && (`bg-zinc-800`)}`}>
          Registrar Leituras
        </button>
        <button onClick={() => navigate("/reading")} className={`cursor-pointer w-full text-left px-4 py-2 rounded-lg bg-zinc-850 ${pathname === '/reading' && (`bg-zinc-800`)}`}>
          Ler
        </button>
        <button onClick={() => navigate("/signin")} className={`cursor-pointer w-full text-left px-4 py-2 rounded-lg bg-zinc-850 ${pathname === '/signin' && (`bg-zinc-800`)}`}>
          SignIn
        </button>
        <button onClick={() => navigate("/signup")} className={`cursor-pointer w-full text-left px-4 py-2 rounded-lg bg-zinc-850 ${pathname === '/signup' && (`bg-zinc-800`)}`}>
          SignUp
        </button>
        <button className={`flex gap-2 items-center cursor-no-drop w-full text-left px-4 py-2 rounded-lg bg-zinc-850 ${pathname === '/pomodoro' && (`bg-zinc-800`)}`}>
          <Wrench size={14} />
          Pomodoro
        </button>
        <button className={`flex gap-2 items-center cursor-no-drop w-full text-left px-4 py-2 rounded-lg bg-zinc-850 ${pathname === '/pomodoro' && (`bg-zinc-800`)}`}>
          <Wrench size={14} />
          Ranking
        </button>
        <button className={`flex gap-2 items-center cursor-no-drop w-full text-left px-4 py-2 rounded-lg bg-zinc-850 ${pathname === '/pomodoro' && (`bg-zinc-800`)}`}>
          <Wrench size={14} />
          Perfil
        </button>
        
      </nav>

      <div className="mt-auto text-xs text-zinc-500">v1.0</div>
    </aside>
  );
}
