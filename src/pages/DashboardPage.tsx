import { LayoutDashboard } from "lucide-react";
import RankingTable from "../components/RankingTable";
import { HeatMapTemplate } from "../components/ReadingHeatmap";
import Sidebar from "../components/Sidebar";
import StatCard from "../components/StatCard";

export default function Dashboard() {
  return (
    <div className="h-screen bg-zinc-950 text-zinc-100 flex">
      <Sidebar />

      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-8">
          <header className="flex justify-between items-center">
            <div>
              <div className="flex gap-2 items-center">
                <LayoutDashboard size={24} />
                <h1 className="text-3xl font-semibold tracking-tight">
                  Dashboard
                </h1>
              </div>
            </div>

            <button className="bg-indigo-600 hover:bg-indigo-500 transition px-5 py-2.5 rounded-lg font-medium shadow-lg">
              Registrar Leitura
            </button>
          </header>

          <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard
              title="Total de Páginas"
              value="12.480"
              extraInfo="+276 essa semana"
              subtitle="Este mês"
            />
            <StatCard
              title="Horas de Leitura"
              value="128h"
              extraInfo="+5 essa semana"
              subtitle="Tempo total"
            />
            <StatCard
              title="Dias Consecutivos"
              value="15"
              subtitle="Melhor streak: 65 dias"
            />
          </section>

          <section className="flex">
            <div className="rounded-2xl border border-zinc-800 w-full">
              <HeatMapTemplate />
            </div>
          </section>

          <section>
            <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6 shadow-xl">
              <h2 className="text-lg font-semibold mb-4">Ranking Geral</h2>

              <RankingTable />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
