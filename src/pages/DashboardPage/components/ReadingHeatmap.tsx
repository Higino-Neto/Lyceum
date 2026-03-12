import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import HeatMap from "@uiw/react-heat-map";
import getReadings from "../../../utils/getReadings";
import { HeatmapSkeleton } from "../../../components/skeletons";

interface HeatmapData {
  date: string;
  count: number;
}

async function fetchHeatmapData(): Promise<HeatmapData[]> {
  const readings = await getReadings();

  const heatmapData = Object.values(
    readings.reduce<Record<string, HeatmapData>>(
      (acc, { reading_date, pages }) => {
        const dateObj = new Date(reading_date);
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, "0");
        const day = String(dateObj.getDate()).padStart(2, "0");
        const date = `${year}/${month}/${day}`;

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
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 150);
    return { startDate: start, endDate: end };
  }, []);

  const darkPanelColors: Record<number, string> = {
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

  if (isLoading) {
    return <HeatmapSkeleton />;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center bg-slate-950 text-white dark:bg-[#18181B] rounded-lg shadow-lg h-full p-4">
        <h2 className="text-lg font-bold mb-2">Streak Mensal</h2>
        <div className="flex-1 flex items-center justify-center text-red-400 text-sm">
          Erro ao carregar dados: {error?.message}
        </div>
      </div>
    );
  }

  const rectRender = (
    props: React.SVGProps<SVGRectElement>,
    data: HeatmapData & { date: string; column: number; row: number; index: number }
  ) => {
    const tooltipContent = data.count
      ? `${data.count} página${data.count > 1 ? "s" : ""}`
      : "Sem leitura";

    return (
      <rect {...props}>
        <title>{`${data.date}: ${tooltipContent}`}</title>
      </rect>
    );
  };

  return (
    <div className="flex flex-col items-center justify-center bg-slate-950 text-white dark:bg-[#18181B] rounded-lg shadow-lg h-full p-4">
      <h2 className="text-lg font-bold mb-2">Streak Mensal</h2>
      <div className="items-center justify-center w-full overflow-x-auto">
        <HeatMap
          value={value || []}
          startDate={startDate}
          endDate={endDate}
          rectSize={12}
          space={3}
          weekLabels={["D", "S", "T", "Q", "Q", "S", "S"]}
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
          rectProps={{ rx: 3 }}
          legendCellSize={0}
          style={{ color: "#E2E8F0", width: "100%" }}
          rectRender={rectRender}
        />
      </div>
    </div>
  );
}

export default ReadingHeatMap;
