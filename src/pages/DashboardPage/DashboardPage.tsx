import { Plus, BookOpen } from "lucide-react";
import RankingTable from "./components/RankingTable";
import ReadingHeatMap from "./components/ReadingHeatmap";
import WeeklyStreak from "./components/WeeklyStreak";
import ReadingCharts from "./components/ReadingCharts";
import { useNavigate } from "react-router-dom";
import ReadingTable from "./components/ReadingTable/ReadingTable";
import useReadingStats from "../../hooks/useReadingStats";

const ICON_SIZE = 16;
const STROKE_WIDTH = 1.5;

export default function Dashboard() {
  const navigate = useNavigate();

  const { isLoading } = useReadingStats();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <main className="flex-1 p-4 overflow-auto">
        <div className=" mx-auto space-y-4">
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {isLoading ? (
              <>
                <div className="bg-zinc-900 rounded-sm border border-zinc-800 md:col-span-2">
                  <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin m-8" />
                </div>
                <div className="bg-zinc-900 rounded-sm border border-zinc-800 md:row-span-2 overflow-y-auto">
                  <RankingTable />
                </div>
              </>
            ) : (
              <>
                <div className="bg-zinc-900 rounded-sm border border-zinc-800 md:col-span-2">
                  <ReadingCharts />
                </div>
                <div className="bg-zinc-900 rounded-sm border border-zinc-800 md:row-span-2 overflow-y-auto">
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
          </section>

          <section>
            <div className="bg-zinc-900 rounded-sm border border-zinc-800 p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <BookOpen size={ICON_SIZE} className="text-zinc-500" strokeWidth={STROKE_WIDTH} />
                  <h2 className="text-zinc-100 font-medium">Registros de Leitura</h2>
                </div>
                <button
                  onClick={() => navigate("/add_reading")}
                  className="flex items-center gap-1.5 px-3 py-1.5 cursor-pointer text-md font-medium text-black bg-green-600 hover:bg-green-500 transition rounded-sm"
                >
                  <Plus size={16} />
                  Registrar
                </button>
              </div>
              <ReadingTable />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
