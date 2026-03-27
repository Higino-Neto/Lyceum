import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ChartTooltip from "./ChartTooltip";
import formatDate from "./utils/formatDate";
import { CHART_COLORS, UserReadingData } from "../../../../types/ChartTypes";

interface AreaChartProps {
  usersData: UserReadingData[];
}

export default function AreaChartComponent({ usersData }: AreaChartProps) {
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

    let accumulators: Record<string, Record<string, number>> = {};
    sortedDates.forEach((date) => {
      accumulators[date] = {};
      usersData.forEach((userData) => {
        const prevDate = sortedDates[sortedDates.indexOf(date) - 1];
        const prevValue = prevDate ? (accumulators[prevDate]?.[userData.user.username] || 0) : 0;
        const dayValue = userData.readings
          .filter((r) => r.reading_date === date)
          .reduce((sum, r) => sum + r.pages, 0);
        accumulators[date][userData.user.username] = prevValue + dayValue;
      });
    });

    return sortedDates.map((date) => {
      const dataPoint: Record<string, string | number> = { date };
      usersData.forEach((userData) => {
        dataPoint[userData.user.username] = accumulators[date][userData.user.username] || 0;
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
      <AreaChart data={chartData} margin={{ top: 10, right: 20, bottom: 0 }}>
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
          <Area
            key={userData.user.userId}
            type="monotone"
            dataKey={userData.user.username}
            stroke={CHART_COLORS[index % CHART_COLORS.length]}
            fill={CHART_COLORS[index % CHART_COLORS.length]}
            fillOpacity={0.3}
            strokeWidth={userData.user.isCurrentUser ? 3 : 2}
            animationDuration={150}
            stackId={index}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
