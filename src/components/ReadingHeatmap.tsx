import HeatMap from "@uiw/react-heat-map";
import getReadings from "../utils/getReadings";
import { useEffect, useState } from "react";

interface HeatmapData {
  date: string;
  count: number;
}

export function ReadingHeatMap() {
  const [value, setValue] = useState<HeatmapData[]>([]);

  const darkPanelColors = {
    0: "#27272A", // 0 pages
    1: "#16a34a", // 1-3 pages
    2: "#16a34a", // 4-6 pages
    3: "#16a34a", // 7-10 pages
    4: "#22c55e", // 11-15 pages
    5: "#22c55e", // 16-20 pages
    6: "#22c55e", // 21-25 pages
    7: "#22c55e", // 26-30 pages
    8: "#22c55e", // 31-35 pages
    9: "#22c55e", // 36-40 pages
  };

  useEffect(() => {
    const load = async () => {
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
      setValue(heatmapData);
    };

    load();
  }, []);
  return (
    <div className="flex flex-col items-center justify-center p-6 bg-slate-950 text-white dark:bg-[#18181B] rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4">Streak</h2>
      <div className="items-center justify-center w-full max-w-3xl">
        <HeatMap
          value={value}
          startDate={new Date("2024/01/01")}
          endDate={new Date("2024/12/12")}
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
          style={{ color: "#E2E8F0", width: "100%"}}
          legendRender={(props) => <></>}
        />
      </div>
    </div>
  );
}

export default ReadingHeatMap;
