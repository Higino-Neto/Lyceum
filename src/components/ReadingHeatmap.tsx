// src/components/HeatMapTemplate.jsx
import HeatMap from "@uiw/react-heat-map";

// Installation instructions:
// npm install @uiw/react-heat-map @uiw/react-tooltip --save
// Ensure Tailwind CSS is set up in your project with dark mode enabled (e.g., via class="dark").

export function HeatMapTemplate() {
  // value mock
  const value = [];
  const dataStartDate = new Date("2025/02/16");
  const currentDate = new Date(); // Assuming current date is Feb 16, 2026 for full year
  const numDays = Math.ceil(
    (currentDate.getTime() - dataStartDate.getTime()) / (1000 * 60 * 60 * 24),
  );
  for (let i = 0; i < numDays; i++) {
    const date = new Date(dataStartDate);
    date.setDate(date.getDate() + i);
    let count = Math.floor(Math.random() * 20); // Random count between 0 and 19
    if (count < 10) count = 0;
    value.push({
      date: `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`,
      count,
    });
  }

  const darkPanelColors = [
    "#18181B", // No activity (dark gray)
    "#4A5568", // Low
    "#4299E1", // Medium
    "#3182CE", // High
    "#2B6CB0", // Very high
  ];

  return (
    <div className="p-6 bg-slate-950 text-white dark:bg-[#18181B] rounded-lg shadow-lg max-w-full">
      <h2 className="text-xl font-bold mb-4">
        Streak
      </h2>
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
            <rect
              {...props}
              rx={4} // Rounded legend
              className="border border-gray-700"
            />
          )}
        />
      </div>
    </div>
  );
}

export default HeatMapTemplate;
