import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import HeatMap from "@uiw/react-heat-map";
import getReadings from "../../../utils/getReadings";
import { HeatmapSkeleton } from "../../../components/skeletons";
import { CalendarDays } from "lucide-react";

const ICON_SIZE = 16;
const STROKE_WIDTH = 1.5;

interface HeatmapData {
  date: string;
  count: number;
}

async function fetchHeatmapData(): Promise<HeatmapData[]> {
  const readings = await getReadings();

  const heatmapData = Object.values(
    readings.reduce<Record<string, HeatmapData>>(
      (acc, { reading_date, pages }) => {
        const [year, month, day] = reading_date.split("-").map(Number);
        const dateObj = new Date(year, month - 1, day);
        const yearStr = String(dateObj.getFullYear());
        const monthStr = String(dateObj.getMonth() + 1).padStart(2, "0");
        const dayStr = String(dateObj.getDate()).padStart(2, "0");
        const date = `${yearStr}/${monthStr}/${dayStr}`;

        acc[date] = {
          date,
          count: (acc[date]?.count || 0) + pages,
        };

        return acc;
      },
      {}
    )
  );

  return heatmapData;
}

export function ReadingHeatMap() {
  const { data: value, isLoading, isError, error } = useQuery<HeatmapData[]>({
    queryKey: ["heatmap"],
    queryFn: fetchHeatmapData,
  });

  const { startDate, endDate } = useMemo(() => {
    let start = new Date();
    let end = new Date();
    
    if (value && value.length > 0) {
      const dates = value.map(d => d.date).sort();
      const firstDate = dates[0];
      const [year, month, day] = firstDate.split("/").map(Number);
      start = new Date(year, month - 1, day);
      end = new Date(start);
      end.setMonth(end.getMonth() + 7);
    } else {
      start.setDate(start.getDate() - 60);
      end.setDate(end.getDate() + 60);
      end.setMonth(end.getMonth() + 7);
    }
    
    return { startDate: start, endDate: end };
  }, [value]);

  const darkPanelColors = useMemo(() => {
    if (!value || value.length === 0) {
      return {
        0: "#27272a",
        1: "#16a34a",
        2: "#16a34a",
        3: "#16a34a",
        4: "#22c55e",
        5: "#22c55e",
        6: "#22c55e",
        7: "#22c55e",
        8: "#22c55e",
        9: "#22c55e",
      };
    }

    const counts = value.map(d => d.count);
    const min = Math.min(...counts);
    const max = Math.max(...counts);
    const range = max - min || 1;

    const colors = [
      "#27272a",
      "#14532d",
      "#166534",
      "#15803d",
      "#16a34a",
      "#22c55e",
      "#4ade80",
      "#86efac",
      "#bbf7d0",
      "#dcfce7",
    ];

    return colors;
  }, [value]);

  const getColorIndex = (count: number) => {
    if (!value || value.length === 0 || count === 0) return 0;
    
    const counts = value.map(d => d.count);
    const min = Math.min(...counts);
    const max = Math.max(...counts);
    const range = max - min || 1;
    
    const normalized = (count - min) / range;
    return Math.min(9, Math.floor(normalized * 9) + 1);
  };

  if (isLoading) {
    return <HeatmapSkeleton />;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center bg-zinc-900 text-white rounded-sm h-full p-4">
        <div className="flex-1 flex items-center justify-center text-red-400 text-sm">
          Erro: {error?.message}
        </div>
      </div>
    );
  }

  const rectRender = (
    props: React.SVGProps<SVGRectElement>,
    data: HeatmapData & { date: string; column: number; row: number; index: number }
  ) => {
    const tooltipContent = data.count
      ? `${data.count} p`
      : "Sem dados";
    
    const colorIndex = getColorIndex(data.count || 0);
    const fillColor = darkPanelColors[colorIndex];

    return (
      <rect {...props} fill={fillColor}>
        <title>{`${data.date}: ${tooltipContent}`}</title>
      </rect>
    );
  };

  return (
    <div className="flex flex-col bg-zinc-900 text-white rounded-sm h-full p-4">
      <div className="flex items-center justify-start gap-2 mb-2">
        <CalendarDays size={ICON_SIZE} className="text-zinc-500" strokeWidth={STROKE_WIDTH} />
      </div>
      <div className="w-full">
        <HeatMap
          value={value || []}
          startDate={startDate}
          endDate={endDate}
          rectSize={11}
          space={3}
          weekLabels={["", "", "", "", "", "", ""]}
          monthLabels={[
            "Jan",
            "Fev",
            "Mar",
            "Abr",
            "Mai",
            "Jun",
            "Jul",
            "Ago",
            "Set",
            "Out",
            "Nov",
            "Dez",
          ]}
          monthPlacement="top"
          panelColors={darkPanelColors}
          rectProps={{ rx: 2 }}
          legendCellSize={0}
          style={{ color: "#E2E8F0", width: "100%" }}
          rectRender={rectRender}
        />
      </div>
    </div>
  );
}

export default ReadingHeatMap;
