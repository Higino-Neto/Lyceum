import { Plus, BookOpen, Copy } from "lucide-react";
import RankingTable from "./components/RankingTable/RankingTable";
import ReadingHeatMap from "./components/ReadingHeatmap";
import WeeklyStreak from "./components/WeeklyStreak";
import ReadingStatsCard from "./components/ReadingStatsCard";
import ReadingCharts from "./components/ReadingCharts/ReadingCharts";
import { useNavigate } from "react-router-dom";
import ReadingTable from "./components/ReadingTable/ReadingTable";
import useReadingStats from "../../hooks/useReadingStats";
import { SelectedUsersProvider } from "../../contexts/SelectedUsersContext";
import toast from "react-hot-toast";
import useGetReadings from "../../hooks/useGetReadings";
import { useMemo } from "react";

const ICON_SIZE = 16;
const STROKE_WIDTH = 1.5;

export default function Dashboard() {
  const navigate = useNavigate();

  const { isLoading } = useReadingStats();

  const { data: readings } = useGetReadings();

  const todayReadingsString = useMemo(() => {
    if (!readings) return "";

    const today = new Date().toISOString().split("T")[0];

    const todayReadings = readings.filter((r) => r.reading_date === today);

    if (todayReadings.length === 0) return "";

    const lines = todayReadings.map((r) => `${r.source_name}: ${r.pages}`);
    const total = todayReadings.reduce((acc, r) => acc + r.pages, 0);

    return `${lines.join("\n")}\n\nTotal: ${total}`;
  }, [readings]);

  const handleCopyDailyReadings = async () => {
    if (!todayReadingsString) {
      toast.error("Nenhuma leitura registrada hoje");
      return;
    }

    try {
      await navigator.clipboard.writeText(todayReadingsString);
      toast.success("Leituras copiadas!");
    } catch {
      toast.error("Falha ao copiar");
    }
  };

  return (
    <SelectedUsersProvider>
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <main className="flex-1 p-4 overflow-auto">
          <div className=" mx-auto space-y-4">
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {isLoading ? (
                <>
                  <div className="bg-zinc-900 rounded-sm border border-zinc-800 md:col-span-2">
                    <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin m-8" />
                  </div>
                  <div className="bg-zinc-900 rounded-sm border border-zinc-800 overflow-y-auto">
                    <RankingTable />
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-zinc-900 rounded-sm border border-zinc-800 md:col-span-2">
                    <ReadingCharts />
                  </div>
                  <div className="bg-zinc-900 rounded-sm border border-zinc-800 overflow-y-auto">
                    <RankingTable />
                  </div>
                </>
              )}
              <div className="bg-zinc-900 rounded-sm border border-zinc-800">
                <ReadingHeatMap />
              </div>
              <div className="bg-zinc-900 rounded-sm">
                <WeeklyStreak />
              </div>
              <div className="bg-zinc-900 rounded-sm">
                <ReadingStatsCard />
              </div>
            </section>

            <section>
              <div className="bg-zinc-900 rounded-sm border border-zinc-800 p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <BookOpen size={ICON_SIZE} className="text-zinc-500" strokeWidth={STROKE_WIDTH} />
                    {/* <h2 className="text-zinc-500">Registros de Leitura</h2> */}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyDailyReadings}
                      className="flex items-center gap-1.5 px-3 py-1.5 cursor-pointer text-md text-zinc-300 bg-zinc-800 hover:bg-zinc-700 hover:text-zinc-100 transition rounded-sm border border-zinc-700"
                      title="Copiar leituras do dia"
                    >
                      <Copy size={16} />
                      Leituras diárias
                    </button>
                    <button
                      onClick={() => navigate("/add_reading")}
                      className="flex items-center gap-1.5 px-3 py-1.5 cursor-pointer text-md font-medium text-black bg-green-600 hover:bg-green-500 transition rounded-sm"
                    >
                      <Plus size={16} />
                      Registrar
                    </button>
                  </div>
                </div>
                <ReadingTable />
              </div>
            </section>
          </div>
        </main>
      </div>
    </SelectedUsersProvider>
  );
}