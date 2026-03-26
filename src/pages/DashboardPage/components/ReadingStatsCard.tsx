import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import getReadings from "../../../utils/getReadings";
import { BarChart3 } from "lucide-react";

export default function ReadingStatsCard() {
  const { data: readings, isLoading } = useQuery({
    queryKey: ["readings"],
    queryFn: getReadings,
  });

  const stats = useMemo(() => {
    if (!readings || readings.length === 0) return null;

    const pagesByDate: Record<string, number> = {};
    const timeByDate: Record<string, number> = {};
    
    readings.forEach((item) => {
      const date = item.reading_date;
      pagesByDate[date] = (pagesByDate[date] || 0) + item.pages;
      timeByDate[date] = (timeByDate[date] || 0) + item.reading_time;
    });

    const dates = Object.keys(pagesByDate).slice(-30);
    if (dates.length === 0) return null;

    const pages = dates.map((d) => pagesByDate[d]);
    const total = pages.reduce((a, b) => a + b, 0);
    const avg = total / pages.length;
    const min = Math.min(...pages);
    const max = Math.max(...pages);
    const totalTime = dates.reduce((sum, d) => sum + timeByDate[d], 0);

    return { total, days: dates.length, avg, min, max, totalTime };
  }, [readings]);

  if (isLoading || !stats) {
    return (
      <div className="bg-zinc-900 rounded-sm border border-zinc-800 p-4 h-full">
        <div className="text-zinc-500 text-sm">—</div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 rounded-sm border border-zinc-800 p-4 h-full">
      <div className="flex items-center gap-2 mb-2">
        <BarChart3 size={16} className="text-zinc-500" />
      </div>
      <div className="space-y-1 text-sm">
        <div className="text-zinc-400">Total: <span className="text-zinc-200">{stats.total} pág</span></div>
        <div className="text-zinc-400">Dias: <span className="text-zinc-200">{stats.days}</span></div>
        <div className="text-zinc-400">Média: <span className="text-zinc-200">{stats.avg.toFixed(1)}</span></div>
        <div className="text-zinc-400">Mín: <span className="text-zinc-200">{stats.min}</span></div>
        <div className="text-zinc-400">Máx: <span className="text-zinc-200">{stats.max}</span></div>
        <div className="text-zinc-400">Tempo: <span className="text-zinc-200">{stats.totalTime} min</span></div>
      </div>
    </div>
  );
}
