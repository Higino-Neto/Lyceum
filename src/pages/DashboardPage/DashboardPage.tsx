import { Plus, BookOpen, Copy } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
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
import { panelStagger, softFadeUp, springFast } from "../../utils/motionPresets";

const ICON_SIZE = 16;
const STROKE_WIDTH = 1.5;

export default function Dashboard() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

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

  const panelTransition = reduceMotion ? { duration: 0 } : springFast;
  const hoverMotion = reduceMotion ? undefined : { y: -2 };

  return (
    <SelectedUsersProvider>
      <motion.div
        className="min-h-screen bg-zinc-950 text-zinc-100"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.18 }}
      >
        <main className="flex-1 overflow-auto p-4">
          <motion.div
            className=" mx-auto space-y-4"
            variants={reduceMotion ? undefined : panelStagger}
            initial={reduceMotion ? false : "hidden"}
            animate="visible"
          >
            <motion.section
              className="grid grid-cols-1 gap-4 md:grid-cols-3"
              variants={reduceMotion ? undefined : panelStagger}
            >
              {isLoading ? (
                <>
                  <motion.div
                    className="rounded-sm border border-zinc-800 bg-zinc-900 md:col-span-2"
                    variants={reduceMotion ? undefined : softFadeUp}
                    transition={panelTransition}
                  >
                    <div className="m-8 h-6 w-6 animate-spin rounded-full border-2 border-green-500 border-t-transparent" />
                  </motion.div>
                  <motion.div
                    className="overflow-y-auto rounded-sm border border-zinc-800 bg-zinc-900"
                    variants={reduceMotion ? undefined : softFadeUp}
                    transition={panelTransition}
                  >
                    <RankingTable />
                  </motion.div>
                </>
              ) : (
                <>
                  <motion.div
                    className="rounded-sm border border-zinc-800 bg-zinc-900 md:col-span-2"
                    variants={reduceMotion ? undefined : softFadeUp}
                    transition={panelTransition}
                    whileHover={hoverMotion}
                  >
                    <ReadingCharts />
                  </motion.div>
                  <motion.div
                    className="overflow-y-auto rounded-sm border border-zinc-800 bg-zinc-900"
                    variants={reduceMotion ? undefined : softFadeUp}
                    transition={panelTransition}
                    whileHover={hoverMotion}
                  >
                    <RankingTable />
                  </motion.div>
                </>
              )}
              <motion.div
                className="rounded-sm border border-zinc-800 bg-zinc-900"
                variants={reduceMotion ? undefined : softFadeUp}
                transition={panelTransition}
                whileHover={hoverMotion}
              >
                <ReadingHeatMap />
              </motion.div>
              <motion.div
                className="rounded-sm bg-zinc-900"
                variants={reduceMotion ? undefined : softFadeUp}
                transition={panelTransition}
                whileHover={hoverMotion}
              >
                <WeeklyStreak />
              </motion.div>
              <motion.div
                className="rounded-sm bg-zinc-900"
                variants={reduceMotion ? undefined : softFadeUp}
                transition={panelTransition}
                whileHover={hoverMotion}
              >
                <ReadingStatsCard />
              </motion.div>
            </motion.section>

            <motion.section
              variants={reduceMotion ? undefined : softFadeUp}
              transition={panelTransition}
            >
              <motion.div
                className="rounded-sm border border-zinc-800 bg-zinc-900 p-4"
                whileHover={hoverMotion}
              >
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <BookOpen
                      size={ICON_SIZE}
                      className="text-zinc-500"
                      strokeWidth={STROKE_WIDTH}
                    />
                    {/* <h2 className="text-zinc-500">Registros de Leitura</h2> */}
                  </div>
                  <div className="flex items-center gap-2">
                    <motion.button
                      onClick={handleCopyDailyReadings}
                      className="flex cursor-pointer items-center gap-1.5 rounded-sm border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-md text-zinc-300 transition hover:bg-zinc-700 hover:text-zinc-100"
                      title="Copiar leituras do dia"
                    >
                      <Copy size={16} />
                      Leituras diárias
                    </motion.button>
                    <motion.button
                      onClick={() => navigate("/add_reading")}
                      className="flex cursor-pointer items-center gap-1.5 rounded-sm bg-green-600 px-3 py-1.5 text-md font-medium text-black transition hover:bg-green-500"
                    >
                      <Plus size={16} />
                      Registrar
                    </motion.button>
                  </div>
                </div>
                <ReadingTable />
              </motion.div>
            </motion.section>
          </motion.div>
        </main>
      </motion.div>
    </SelectedUsersProvider>
  );
}
