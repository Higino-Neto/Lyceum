import { BookMarkedIcon } from "lucide-react";

export default function Sidebar() {
  return (
    <aside className="w-64 bg-zinc-900 border-r border-zinc-800 p-6 flex flex-col">
      <div className="flex gap-2 items-center">
        <BookMarkedIcon size={20} />
        <h2 className="text-xl font-semibold tracking-tight">Lyceum</h2>
      </div>

      <nav className="mt-10 space-y-2 text-sm">
        <button className="w-full text-left px-4 py-2 rounded-lg bg-zinc-800">
          Dashboard
        </button>
        <button className="w-full text-left px-4 py-2 rounded-lg hover:bg-zinc-800 transition">
          Ranking
        </button>
        <button className="w-full text-left px-4 py-2 rounded-lg hover:bg-zinc-800 transition">
          Perfil
        </button>
      </nav>

      <div className="mt-auto text-xs text-zinc-500">v1.0</div>
    </aside>
  );
}
