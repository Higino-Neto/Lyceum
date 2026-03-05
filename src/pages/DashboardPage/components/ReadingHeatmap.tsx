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
  const heatmapData: HeatmapData[] = Object.values(
    readings.reduce(
      (acc, { reading_date, pages }) => {
        const date = new Date(reading_date)
          .toISOString()
          .slice(0, 10)
          .replace(/-/g, "/");

        acc[date] = {
          date,
          count: (acc[date]?.count || 0) + pages,
        };

        return acc;
      },
      {} as Record<string, HeatmapData>,
    ),
  );
  return heatmapData;
}

export function ReadingHeatMap() {
  const { data: value, isLoading } = useQuery<HeatmapData[]>({
    queryKey: ["heatmap"],
    queryFn: fetchHeatmapData,
  });

  const darkPanelColors = {
    0: "#27272A",
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

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-slate-950 text-white dark:bg-[#18181B] rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4">Streak</h2>
      <div className="items-center justify-center w-full">
        <HeatMap
          value={value || []}
          startDate={new Date(new Date().setDate(new Date().getDate() - 365))}
          endDate={new Date()}
          rectSize={12}
          space={2}
          weekLabels={["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]}
          monthLabels={[
            "Jan",
            "Feb",
            "Mar",
            "Apr",
            "May",
            "Jun",
            "Jul",
            "Aug",
            "Sep",
            "Oct",
            "Nov",
            "Dec",
          ]}
          monthPlacement="top"
          panelColors={darkPanelColors}
          rectProps={{ rx: 4 }}
          style={{ color: "#E2E8F0", width: "100%" }}
          legendRender={() => <div key={crypto.randomUUID()}>{}</div>}
        />
      </div>
    </div>
  );
}

export default ReadingHeatMap;
