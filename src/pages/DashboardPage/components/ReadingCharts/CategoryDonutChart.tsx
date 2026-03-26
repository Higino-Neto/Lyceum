import { useMemo } from "react";
import {
    Bar,
    BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import ChartTooltip from "./ChartTooltip";
import { CategoryData, CHART_COLORS, UserReadingData } from "../../../../types/ChartTypes";
import { CATEGORY_LABELS } from "../../../../types/ReadingTypes";

export default function CategoryDonutChart({
  usersData,
  categories,
}: {
  usersData: UserReadingData[];
  categories: CategoryData[];
}) {
  const chartData = useMemo(() => {
    const grouped: Record<string, Record<string, number>> = {};

    usersData.forEach((userData) => {
      userData.readings.forEach((item) => {
        const categoryId = item.category_id || "other";
        if (!grouped[categoryId]) {
          grouped[categoryId] = {};
        }
        grouped[categoryId][userData.user.username] =
          (grouped[categoryId][userData.user.username] || 0) + item.pages;
      });
    });

    const totals: Record<string, number> = {};
    Object.entries(grouped).forEach(([categoryId, userPages]) => {
      totals[categoryId] = Object.values(userPages).reduce(
        (sum, val) => sum + val,
        0,
      );
    });

    return Object.entries(grouped)
      .map(([categoryId, userPages]) => {
        const category = categories.find((c) => c.id === categoryId);
        const label = category?.name || CATEGORY_LABELS[categoryId] || "Outro";
        const total = totals[categoryId];
        return {
          name: label,
          ...userPages,
          total,
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [usersData, categories]);

  const singleUserCategoryData = useMemo(() => {
    if (usersData.length !== 1) return null;
    const currentUserData = usersData[0];
    const grouped = currentUserData.readings.reduce<Record<string, number>>(
      (acc, item) => {
        const categoryId = item.category_id || "other";
        acc[categoryId] = (acc[categoryId] || 0) + item.pages;
        return acc;
      },
      {},
    );

    const total = Object.values(grouped).reduce((sum, val) => sum + val, 0);

    return Object.entries(grouped)
      .map(([categoryId, numPages]) => {
        const category = categories.find((c) => c.id === categoryId);
        const label = category?.name || CATEGORY_LABELS[categoryId] || "Outro";
        return {
          name: label,
          value: numPages,
          percentage: total > 0 ? Math.round((numPages / total) * 100) : 0,
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [usersData, categories]);

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

  if (singleUserCategoryData) {
    return (
      <div className="flex gap-8 items-center justify-center">
        <div className="shrink-0">
          <ResponsiveContainer width={160} height={160}>
            <PieChart>
              <Pie
                data={singleUserCategoryData}
                cx="50%"
                cy="50%"
                innerRadius={36}
                outerRadius={64}
                paddingAngle={2}
                dataKey="value"
                animationDuration={150}
              >
                {singleUserCategoryData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={CHART_COLORS[index % CHART_COLORS.length]}
                    stroke="transparent"
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-col gap-2 min-w-0 justify-center">
          {singleUserCategoryData.map((item, index) => (
            <div
              key={item.name}
              className="flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{
                    backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                  }}
                />
                <span className="text-zinc-400 text-xs truncate">
                  {item.name}
                </span>
              </div>
              <span className="text-zinc-300 text-xs font-medium shrink-0">
                {item.percentage}%
              </span>
            </div>
          ))}
        </div>
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
          dataKey="name"
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
