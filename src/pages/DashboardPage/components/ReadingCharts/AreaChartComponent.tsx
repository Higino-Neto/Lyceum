import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ChartTooltip from "./ChartTooltip";
import formatDate from "./utils/formatDate";
import { CHART_COLORS, UserReadingData } from "../../../../types/ChartTypes";
import { buildAreaPagesData, hasPositiveChartData } from "./utils/chartData";

interface AreaChartProps {
  usersData: UserReadingData[];
}

export default function AreaChartComponent({ usersData }: AreaChartProps) {
  const chartData = useMemo(() => {
    return buildAreaPagesData(usersData);
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
      <AreaChart data={chartData} margin={{ top: 10, right: 20, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="1 1"
          stroke="var(--ui-zinc-800)"
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tickFormatter={formatDate}
          stroke="var(--ui-zinc-600)"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
          minTickGap={30}
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
