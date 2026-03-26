import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";
import { CHART_COLORS, UserReadingData } from "../../../../types/ChartTypes";

interface BoxPlotChartProps {
  usersData: UserReadingData[];
}

interface BoxPlotStats {
  name: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
}

function calculateQuartiles(data: number[]): BoxPlotStats {
  if (data.length === 0) {
    return { name: "", min: 0, q1: 0, median: 0, q3: 0, max: 0 };
  }

  const sorted = [...data].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  const q1Index = Math.floor(sorted.length * 0.25);
  const medianIndex = Math.floor(sorted.length * 0.5);
  const q3Index = Math.floor(sorted.length * 0.75);

  return {
    name: "",
    min,
    q1: sorted[q1Index],
    median: sorted[medianIndex],
    q3: sorted[q3Index],
    max,
  };
}

export default function BoxPlotChart({ usersData }: BoxPlotChartProps) {
  const chartData = useMemo(() => {
    const pagesByDate: Record<string, number> = {};

    usersData.forEach((userData) => {
      userData.readings.forEach((item) => {
        const date = item.reading_date;
        pagesByDate[date] = (pagesByDate[date] || 0) + item.pages;
      });
    });

    const allPages = Object.values(pagesByDate);

    if (allPages.length === 0) return [];

    const stats = calculateQuartiles(allPages);
    return [{ name: "Você", ...stats }];
  }, [usersData]);

  if (chartData.length === 0 || usersData.every((u) => u.readings.length === 0)) {
    return (
      <div className="h-48 flex items-center justify-center text-zinc-500 text-sm">
        Nenhum dado disponível
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={chartData} margin={{ top: 30, right: 20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="1 1" stroke="#27272a" vertical={false} />
        <XAxis
          dataKey="name"
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
          label={{ value: "Páginas/Dia", angle: -90, position: "insideLeft", fill: "#52525b", fontSize: 10 }}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const data = payload[0].payload;
            return (
              <div className="bg-zinc-900 border border-zinc-700 rounded p-2 text-xs">
                <div className="font-medium text-zinc-200 mb-1">{data.name}</div>
                <div className="text-zinc-400">Min: <span className="text-zinc-200">{data.min}</span></div>
                <div className="text-zinc-400">Q1: <span className="text-zinc-200">{data.q1}</span></div>
                <div className="text-zinc-400">Mediana: <span className="text-zinc-200">{data.median}</span></div>
                <div className="text-zinc-400">Q3: <span className="text-zinc-200">{data.q3}</span></div>
                <div className="text-zinc-400">Max: <span className="text-zinc-200">{data.max}</span></div>
              </div>
            );
          }}
          cursor={false}
        />
        <Bar dataKey="median" fill={CHART_COLORS[0]} radius={[2, 2, 0, 0]} maxBarSize={40}>
          {chartData.map((_, index) => (
            <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} fillOpacity={0.7} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
