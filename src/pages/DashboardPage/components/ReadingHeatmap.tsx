import { useMemo } from "react";
import HeatMap from "@uiw/react-heat-map";
import useGetAllReadings from "../../../hooks/useGetAllReadings";
import { HeatmapSkeleton } from "../../../components/skeletons";
import { CalendarDays } from "lucide-react";

const ICON_SIZE = 16;
const STROKE_WIDTH = 1.5;

interface HeatmapData {
  date: string;
  count: number;
}

function useHeatmapData() {
  const { data: readingsResult, isLoading } = useGetAllReadings();
  const readings = readingsResult?.data || [];

  const heatmapData = useMemo(() => {
    return Object.values(
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
        {},
      ),
    );
  }, [readings]);

  return { heatmapData, isLoading };
}

export function ReadingHeatMap() {
  const { heatmapData, isLoading } = useHeatmapData();

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

  const rectRender = (
    props: React.SVGProps<SVGRectElement>,
    data: HeatmapData & { date: string; column: number; row: number; index: number }
  ) => {
    const tooltipContent = data.count
      ? `${data.count} p`
      : "Sem dados";

    return (
      <rect {...props}>
        <title>{`${data.date}: ${tooltipContent}`}</title>
      </rect>
    );
  };

  return (
    <div className="flex flex-col bg-zinc-900 text-white rounded-sm h-full p-4">
      <div className="flex items-center justify-start gap-2 mb-2">
        <CalendarDays size={ICON_SIZE} className="text-zinc-500" strokeWidth={STROKE_WIDTH} />
      </div>
      <div className="items-center justify-center w-full overflow-x-auto">
        <HeatMap
          value={heatmapData || []}
          startDate={startDate}
          endDate={endDate}
          rectSize={12}
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
