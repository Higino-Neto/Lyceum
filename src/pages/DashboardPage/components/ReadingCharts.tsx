import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import useGetAllReadings from "../../../hooks/useGetAllReadings";
import { supabase } from "../../../lib/supabase";
import { CATEGORY_LABELS } from "../../../types/ReadingTypes";

type ChartType = "daily" | "category" | "weekly" | "weekday";

interface ChartOption {
  key: ChartType;
  label: string;
}

const CHART_OPTIONS: ChartOption[] = [
  { key: "daily", label: "Diário (Line)" },
  { key: "weekday", label: "Diário (Bar)" },
  { key: "weekly", label: "Semanal" },
  { key: "category", label: "Categorias" },
];

const CHART_COLORS = [
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#f59e0b",
  "#06b6d4",
  "#ec4899",
];

interface ReadingData {
  id: string;
  source_name: string;
  pages: number;
  reading_date: string;
  reading_time: number;
  category_id: string;
}

interface CategoryData {
  id: string;
  name: string;
}

const formatDate = (dateStr: string | Date) => {
  if (dateStr instanceof Date) {
    const d = String(dateStr.getDate()).padStart(2, "0");
    const m = String(dateStr.getMonth() + 1).padStart(2, "0");
    return `${d}/${m}`;
  }
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${d}/${m}`;
};

function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getWeekNumber(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function getWeekRange(date: Date): string {
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay() + 1);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return `${formatDate(start)} - ${formatDate(end)}`;
}

const WEEKDAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    payload: Record<string, unknown>;
  }>;
  label?: string;
}

function ChartTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded px-3 py-2 shadow-xl">
      <p className="text-zinc-400 text-xs">{label}</p>
      <p className="text-zinc-100 text-sm font-medium">
        {payload[0]?.value?.toLocaleString("pt-BR")} páginas
      </p>
    </div>
  );
}

function DailyPagesChart({ data }: { data: ReadingData[] }) {
  const chartData = useMemo(() => {
    const grouped = data.reduce<Record<string, number>>((acc, item) => {
      acc[item.reading_date] = (acc[item.reading_date] || 0) + item.pages;
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([date, pages]) => ({ date, pages }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-30);
  }, [data]);

  if (chartData.length === 0) {
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
        <Line
          type="monotone"
          dataKey="pages"
          stroke="#16a34a"
          strokeWidth={3}
          dot={false}
          activeDot={false}
          animationDuration={150}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function CategoryDonutChart({
  data,
  categories,
}: {
  data: ReadingData[];
  categories: CategoryData[];
}) {
  const chartData = useMemo(() => {
    const grouped = data.reduce<Record<string, number>>((acc, item) => {
      const categoryId = item.category_id || "other";
      acc[categoryId] = (acc[categoryId] || 0) + item.pages;
      return acc;
    }, {});

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
      .sort((a, b) => b.value - a.value);
  }, [data, categories]);

  if (chartData.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-zinc-500 text-sm">
        Nenhum dado disponível
      </div>
    );
  }

  return (
    <div className="flex gap-8 items-center justify-center">
      <div className="shrink-0">
        <ResponsiveContainer width={160} height={160}>
          <PieChart>
            <Pie
              data={chartData.slice(0, 5)}
              cx="50%"
              cy="50%"
              innerRadius={36}
              outerRadius={64}
              paddingAngle={2}
              dataKey="value"
              animationDuration={150}
            >
              {chartData.slice(0, 5).map((_, index) => (
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
        {chartData.slice(0, 5).map((item, index) => (
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

function WeeklyPagesChart({ data }: { data: ReadingData[] }) {
  const chartData = useMemo(() => {
    const grouped = data.reduce<
      Record<string, { week: string; pages: number }>
    >((acc, item) => {
      const date = parseLocalDate(item.reading_date);
      const weekKey = `${date.getFullYear()}-W${getWeekNumber(date)}`;
      const weekRange = getWeekRange(date);

      if (!acc[weekKey]) {
        acc[weekKey] = { week: weekRange, pages: 0 };
      }
      acc[weekKey].pages += item.pages;
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([key, value]) => ({ key, ...value }))
      .sort((a, b) => a.key.localeCompare(b.key))
      .slice(-10);
  }, [data]);

  if (chartData.length === 0) {
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
        <Bar
          dataKey="pages"
          fill="#16a34a"
          radius={[2, 2, 0, 0]}
          maxBarSize={32}
          background={{ fill: "transparent" }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

function WeekdayChart({ data }: { data: ReadingData[] }) {
  const chartData = useMemo(() => {
    const grouped = data.reduce<Record<string, number>>((acc, item) => {
      const dayOfWeek = parseLocalDate(item.reading_date).getDay();
      acc[dayOfWeek] = (acc[dayOfWeek] || 0) + item.pages;
      return acc;
    }, {});

    return WEEKDAY_ORDER.map((dayIndex) => ({
      day: WEEKDAY_NAMES[dayIndex],
      pages: grouped[dayIndex] || 0,
    }));
  }, [data]);

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
        <Bar
          dataKey="pages"
          fill="#16a34a"
          radius={[2, 2, 0, 0]}
          maxBarSize={40}
          background={{ fill: "transparent" }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function ReadingCharts() {
  const [activeChart, setActiveChart] = useState<ChartType>("daily");

  const { data: readingsResult, isLoading } = useGetAllReadings();
  const readings = readingsResult?.data || [];

  const { data: categories } = useQuery<CategoryData[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*");
      return data || [];
    },
  });

  const renderChart = () => {
    if (isLoading || !readings) {
      return (
        <div className="h-48 flex items-center justify-center">
          <div className="w-5 h-5 border border-zinc-700 border-t-green-600 rounded-full animate-spin" />
        </div>
      );
    }

    switch (activeChart) {
      case "daily":
        return <DailyPagesChart data={readings} />;
      case "weekday":
        return <WeekdayChart data={readings} />;
      case "weekly":
        return <WeeklyPagesChart data={readings} />;
      case "category":
        return (
          <CategoryDonutChart data={readings} categories={categories || []} />
        );
      default:
        return null;
    }
  };

  return (
    <div className="">
      <div className="flex border-b border-zinc-800">
        {CHART_OPTIONS.map((option) => (
          <button
            key={option.key}
            onClick={() => setActiveChart(option.key)}
            className={`cursor-pointer flex-1 py-[14px] text-xs font-medium transition ${
              activeChart === option.key
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="p-2 pt-4 min-h-56">{renderChart()}</div>
    </div>
  );
}
