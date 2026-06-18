import { useMemo } from "react";
import { CHART_COLORS, UserReadingData } from "../../../../types/ChartTypes";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ChartTooltip from "./ChartTooltip";
import { buildWeeklyPagesData, hasPositiveChartData } from "./utils/chartData";

export default function WeeklyPagesChart({
  usersData,
}: {
  usersData: UserReadingData[];
}) {
  const chartData = useMemo(() => {
    return buildWeeklyPagesData(usersData);
  }, [usersData]);

  if (!hasPositiveChartData(chartData, usersData)) {
    return (
      <div className="h-48 flex items-center justify-center text-zinc-500 text-sm">
        Nenhum dado disponível
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} margin={{ top: 10, right: 20, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="1 1"
          stroke="var(--ui-zinc-800)"
          vertical={false}
        />
        <XAxis
          dataKey="week"
          stroke="var(--ui-zinc-600)"
          fontSize={10}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="var(--ui-zinc-600)"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={40}
          tickCount={5}
          domain={[0, "dataMax"]}
          padding={{ top: 10, bottom: 0 }}
        />
        <Tooltip
          content={<ChartTooltip />}
          cursor={false}
          position={{ y: 100 }}
          wrapperStyle={{ pointerEvents: "none" }}
          animationDuration={150}
        />
        {usersData.map((userData, index) => (
          <Bar
            key={userData.user.userId}
            dataKey={userData.user.username}
            fill={CHART_COLORS[index % CHART_COLORS.length]}
            radius={[2, 2, 0, 0]}
            maxBarSize={32}
            background={{ fill: "transparent" }}
            opacity={userData.user.isCurrentUser ? 1 : 0.5}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
