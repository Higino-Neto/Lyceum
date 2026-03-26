import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ChartTooltip from "./ChartTooltip";
import formatDate from "./utils/formatDate";
import { CHART_COLORS, UserReadingData } from "../../../../types/ChartTypes";

export default function DailyPagesChart({
  usersData,
}: {
  usersData: UserReadingData[];
}) {
  const chartData = useMemo(() => {
    const allDates = new Set<string>();
    usersData.forEach((userData) => {
      userData.readings.forEach((item) => {
        allDates.add(item.reading_date);
      });
    });

    const sortedDates = Array.from(allDates)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
      .slice(-30);

    return sortedDates.map((date) => {
      const dataPoint: Record<string, string | number> = { date };
      usersData.forEach((userData) => {
        const userPages = userData.readings
          .filter((r) => r.reading_date === date)
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
      <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="1 1"
          stroke="#27272a"
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tickFormatter={formatDate}
          stroke="#52525b"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
          minTickGap={30}
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
          <Line
            key={userData.user.userId}
            type="monotone"
            dataKey={userData.user.username}
            stroke={CHART_COLORS[index % CHART_COLORS.length]}
            strokeWidth={userData.user.isCurrentUser ? 3 : 2}
            strokeDasharray={userData.user.isCurrentUser ? undefined : "5 5"}
            dot={false}
            activeDot={false}
            animationDuration={150}
            opacity={userData.user.isCurrentUser ? 1 : 0.5}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
