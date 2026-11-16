import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ChartTooltip from "./ChartTooltip";
import { CHART_COLORS, UserReadingData } from "../../../../types/ChartTypes";
import { useTranslation, type TranslationKey } from "../../../../i18n";

type CategoryChartType = "bar" | "treemap";

interface CategoryChartProps {
  usersData: UserReadingData[];
  categories: { id: string; name: string }[];
}

interface CategoryDataItem {
  id: string;
  name: string;
  total: number;
  [key: string]: string | number;
}

const CHART_TYPE_OPTIONS: { key: CategoryChartType; labelKey: TranslationKey }[] = [
  { key: "bar", labelKey: "dashboard:charts.categoryBar" },
  { key: "treemap", labelKey: "dashboard:charts.categoryTreemap" },
];

export default function CategoryChart({ usersData, categories }: CategoryChartProps) {
  const { t } = useTranslation();
  const [chartType, setChartType] = useState<CategoryChartType>("bar");

  const categoryData = useMemo((): CategoryDataItem[] => {
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
      totals[categoryId] = Object.values(userPages).reduce((sum, val) => sum + val, 0);
    });

    return Object.entries(grouped)
      .map(([categoryId, userPages]) => {
        const category = categories.find((c) => c.id === categoryId);
        return {
          id: categoryId,
          name: category?.name || categoryId,
          ...userPages,
          total: totals[categoryId],
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [usersData, categories]);


  if (categoryData.length === 0 || usersData.every((u) => u.readings.length === 0)) {
    return (
      <div className="h-48 flex items-center justify-center text-foreground-subtle text-sm">
        {t("dashboard:charts.noData")}
      </div>
    );
  }

  const renderChartTypeSelector = () => (
    <div className="flex justify-center gap-2 mb-3">
      {CHART_TYPE_OPTIONS.map((opt) => (
        <button
          key={opt.key}
          onClick={() => setChartType(opt.key as CategoryChartType)}
          className={`px-3 py-1 text-xs rounded-xs transition cursor-pointer ${
            chartType === opt.key
              ? "bg-border-strong text-foreground"
              : "text-foreground-muted hover:text-foreground"
          }`}
        >
          {t(opt.labelKey)}
        </button>
      ))}
    </div>
  );

  if (chartType === "treemap") {
    const treemapData = categoryData.map((cat, index) => ({
      name: cat.name,
      value: cat.total,
      fill: CHART_COLORS[index % CHART_COLORS.length],
    }));

    const totalPages = treemapData.reduce((sum, item) => sum + item.value, 0);

    return (
      <div className="flex flex-col">
        {renderChartTypeSelector()}
        <div className="flex flex-wrap justify-center gap-3 mb-2 text-xs">
          {treemapData.map((item, index) => (
            <div key={item.name} className="flex items-center gap-1">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
              />
              <span className="text-foreground-muted">
                {item.name}: <span className="text-foreground">{item.value}</span> pág
                ({Math.round((item.value / totalPages) * 100)}%)
              </span>
            </div>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie
              data={treemapData}
              cx="50%"
              cy="50%"
              dataKey="value"
              innerRadius={0}
              outerRadius={80}
            >
              {treemapData.map((entry, index) => (
                <Cell key={index} fill={entry.fill} stroke="var(--background)" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {renderChartTypeSelector()}
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={categoryData} margin={{ top: 10, right: 20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="1 1" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="name"
            stroke="var(--foreground-subtle)"
            fontSize={10}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="var(--foreground-subtle)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={40}
            tickCount={5}
            domain={[0, "dataMax"]}
          />
          <Tooltip content={<ChartTooltip />} cursor={false} />
          {usersData.length === 1 ? (
            <Bar
              dataKey="total"
              fill={CHART_COLORS[0]}
              radius={[2, 2, 0, 0]}
              maxBarSize={32}
            />
          ) : (
            usersData.map((userData, index) => (
              <Bar
                key={userData.user.userId}
                dataKey={userData.user.username}
                fill={CHART_COLORS[index % CHART_COLORS.length]}
                radius={[2, 2, 0, 0]}
                maxBarSize={32}
                opacity={userData.user.isCurrentUser ? 1 : 0.5}
              />
            ))
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
