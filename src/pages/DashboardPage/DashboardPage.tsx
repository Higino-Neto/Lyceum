import { Home, LayoutDashboard, PencilLine } from "lucide-react";
import RankingTable from "./components/RankingTable";
import ReadingHeatMap from "./components/ReadingHeatmap";
import StatCard from "../../components/StatCard";
import { useNavigate } from "react-router-dom";
import ReadingTable from "./components/ReadingTable/ReadingTable";
import useReadingStats from "../../hooks/useReadingStats";
import { StatCardSkeleton } from "../../components/skeletons";

const formatTotalHours = (total_minutes: string) => {
  if (!total_minutes) return;
  const hours = Math.floor(Number(total_minutes) / 60);
  const minutes = Math.floor(Number(total_minutes) % 60);

  return `${hours}h ${minutes}min`;
};

export default function Dashboard() {
  const navigate = useNavigate();

  const { data: stats, isLoading } = useReadingStats();

  const { readingStats, userStreak } = stats ?? {};

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <main className="flex-1 p-4 overflow-auto">
        <div className=" mx-auto space-y-4">
          <header className="flex justify-between items-center">
            <div>
              <div className="flex gap-2 items-center pl-6">
                <Home size={32} className="text-zinc-300" />
              </div>
            </div>

            <button
              onClick={() => navigate("/add_reading")}
              className="flex items-center gap-2 cursor-pointer text-black bg-green-600 hover:bg-green-500 transition px-4 py-2 rounded-sm text-lg font-medium shadow-lg"
            >
              <PencilLine size={16} />
              Registrar Leitura
            </button>
          </header>

          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {isLoading ? (
              <>
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
              </>
            ) : (
              <>
                <StatCard
                  title="Total de Páginas"
                  value={
                    <div>{readingStats && `${readingStats?.total_pages} Págs`}</div>
                  }
                  extraInfo={<div>+{readingStats?.month_pages} este mês</div>}
                  subtitle="Desde o início"
                />
                <StatCard
                  title="Horas de Leitura"
                  value={
                    <div>
                      {formatTotalHours(readingStats?.total_minutes.toString())}
                    </div>
                  }
                  extraInfo={
                    <div>
                      <span>+</span>
                      {formatTotalHours(readingStats?.month_minutes.toString())}
                    </div>
                  }
                  subtitle="Tempo total"
                />
                <StatCard
                  title="Dias Consecutivos"
                  value={
                    <div className="flex gap-1">
                      {userStreak?.toString()}
                      <span>dias</span>
                    </div>
                  }
                  subtitle="Melhor streak: ##"
                />
              </>
            )}
          </section>

          <section className="grid grid-cols-2 lg:grid-cols-3 gap-4 h-60 mb-6">
            <div className="col-span-2 rounded-md border border-zinc-800 w-full">
              <ReadingHeatMap />
            </div>
            <div className="bg-zinc-900 rounded-md border border-zinc-800 p-5 overflow-y-auto h-full">
              <h2 className="text-sm text-zinc-400 mb-4">Ranking Geral</h2>
              <RankingTable />
            </div>
          </section>
          <section>
            <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6 shadow-xl">
              <h2 className="text-lg font-semibold mb-4">
                Registro de Leituras
              </h2>
              <ReadingTable />
            </div>
          </section>

          {/* <section>
            <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6 shadow-xl">
              <h2 className="text-lg font-semibold mb-4">Ranking Geral</h2>
              <RankingTable />
            </div>
          </section> */}
        </div>
      </main>
    </div>
  );
}
