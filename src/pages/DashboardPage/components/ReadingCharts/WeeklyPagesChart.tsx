import { useMemo } from "react";
import { CHART_COLORS, UserReadingData } from "../../../../types/ChartTypes";
import parseLocalDate from "./utils/parseLocalDate";
import { getWeekNumber, getWeekRange } from "./utils/getWeekInfo";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ChartTooltip from "./ChartTooltip";

export default function WeeklyPagesChart({
  usersData,
}: {
  usersData: UserReadingData[];
}) {
  const chartData = useMemo(() => {
    const allWeeks = new Set<string>();
    const weekKeys = new Map<string, string>();

    usersData.forEach((userData) => {
      userData.readings.forEach((item) => {
        const date = parseLocalDate(item.reading_date);
        const weekKey = `${date.getFullYear()}-W${getWeekNumber(date)}`;
        const weekRange = getWeekRange(date);
        allWeeks.add(weekKey);
        weekKeys.set(weekKey, weekRange);
      });
    });

    const sortedWeeks = Array.from(allWeeks).sort().slice(-10);

    return sortedWeeks.map((weekKey) => {
      const dataPoint: Record<string, string | number> = {
        week: weekKeys.get(weekKey) || weekKey,
        key: weekKey,
      };
      usersData.forEach((userData) => {
        const userPages = userData.readings
          .filter((r) => {
            const date = parseLocalDate(r.reading_date);
            const wK = `${date.getFullYear()}-W${getWeekNumber(date)}`;
            return wK === weekKey;
          })
          .reduce((sum, r) => sum + r.pages, 0);
        dataPoint[userData.user.username] = userPages;
      });
      return dataPoint;
    });
  }, [usersData]);

  if (
    chartData.length === 0 ||
    usersData.every((u) => u.readings.length === 0)
  ) {
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
          stroke="#27272a"
          vertical={false}
        />
        <XAxis
          dataKey="week"
          stroke="#52525b"
          fontSize={10}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="#52525b"
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
