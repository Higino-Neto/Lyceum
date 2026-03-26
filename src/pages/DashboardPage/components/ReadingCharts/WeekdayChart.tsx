import { useMemo } from "react";
import { CHART_COLORS, UserReadingData } from "../../../../types/ChartTypes";
import { WEEKDAY_NAMES, WEEKDAY_ORDER } from "./utils/getWeekInfo";
import parseLocalDate from "./utils/parseLocalDate";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ChartTooltip from "./ChartTooltip";

export default function WeekdayChart({ usersData }: { usersData: UserReadingData[] }) {
  const chartData = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return WEEKDAY_ORDER.map((dayIndex) => {
      const dataPoint: Record<string, string | number> = {
        day: WEEKDAY_NAMES[dayIndex],
      };
      usersData.forEach((userData) => {
        const userPages = userData.readings
          .filter((r) => {
            const readingDate = parseLocalDate(r.reading_date);
            return (
              readingDate >= monday &&
              readingDate <= sunday &&
              readingDate.getDay() === dayIndex
            );
          })
          .reduce((sum, r) => sum + r.pages, 0);
        dataPoint[userData.user.username] = userPages;
      });
      return dataPoint;
    });
  }, [usersData]);

  const hasData = usersData.some((u) => u.readings.length > 0);

  if (!hasData) {
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
          dataKey="day"
          stroke="#52525b"
          fontSize={11}
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
        />
        {usersData.map((userData, index) => (
          <Bar
            key={userData.user.userId}
            dataKey={userData.user.username}
            fill={CHART_COLORS[index % CHART_COLORS.length]}
            radius={[2, 2, 0, 0]}
            maxBarSize={40}
            background={{ fill: "transparent" }}
            opacity={userData.user.isCurrentUser ? 1 : 0.5}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}