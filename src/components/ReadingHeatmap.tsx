import HeatMap from "@uiw/react-heat-map";

export function HeatMapTemplate() {
  const value = [];
  const currentDate = new Date();
  const dataStartDate = new Date().setDate(currentDate.getDate() - 365);

  const numDays = 365;

  for (let i = 0; i < numDays; i++) {
    const date = new Date(dataStartDate);
    date.setDate(date.getDate() + i);
    let count = Math.floor(Math.random() * 20);
    value.push({
      date: `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`,
      count,
    });
  }

  const darkPanelColors = [
    "#18181B", // 0 contributions
    "#18181B", // 1-3 contributions
    "#006d32", // 4-6 contributions
    "#26a641", // 7-9 contributions
    "#39d353", // 10+ contributions
  ];

  return (
    <div className="p-6 bg-slate-950 text-white dark:bg-[#18181B] rounded-lg shadow-lg max-w-full">
      <h2 className="text-xl font-bold mb-4">Streak</h2>
      <div>
        <HeatMap
          value={value}
          startDate={new Date("2025/02/16")}
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
          style={{ color: "#E2E8F0", width: "100%", margin: "0 auto" }}
          legendRender={(props) => (
            <rect {...props} rx={4} className="border border-gray-700" />
          )}
        />
      </div>
    </div>
  );
}

export default HeatMapTemplate;
