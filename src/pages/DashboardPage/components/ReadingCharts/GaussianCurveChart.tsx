import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ChartTooltip from "./ChartTooltip";
import { CHART_COLORS, UserReadingData } from "../../../../types/ChartTypes";

interface GaussianCurveChartProps {
  usersData: UserReadingData[];
}

interface ChartData {
  data: { pages: number; count: number; normal: number; }[];
  mean: number;
  stdDev: number;
  min: number;
  max: number;
}

function calculateMean(data: number[]): number {
  if (data.length === 0) return 0;
  return data.reduce((a, b) => a + b, 0) / data.length;
}

function calculateStdDev(data: number[], mean: number): number {
  if (data.length === 0) return 0;
  const squaredDiffs = data.map((val) => Math.pow(val - mean, 2));
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / data.length);
}

function normalDistribution(x: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return 0;
  const coefficient = 1 / (stdDev * Math.sqrt(2 * Math.PI));
  const exponent = -Math.pow(x - mean, 2) / (2 * Math.pow(stdDev, 2));
  return coefficient * Math.exp(exponent);
}

export default function GaussianCurveChart({ usersData }: GaussianCurveChartProps) {
  const chartData = useMemo((): ChartData | null => {
    const pagesByDate: Record<string, number> = {};

    usersData.forEach((userData) => {
      userData.readings.forEach((item) => {
        const date = item.reading_date;
        pagesByDate[date] = (pagesByDate[date] || 0) + item.pages;
      });
    });

    const allPages = Object.values(pagesByDate);

    if (allPages.length === 0) return null;

    const mean = calculateMean(allPages);
    const stdDev = calculateStdDev(allPages, mean);

    const min = Math.min(...allPages);
    const max = Math.max(...allPages);
    const range = max - min || 10;
    const step = range / 20;

    const bins: Record<number, number> = {};
    const binCount = 20;

    for (let i = 0; i < binCount; i++) {
      const binStart = min + (i * range) / binCount;
      bins[binStart] = 0;
      allPages.forEach((pages) => {
        if (pages >= binStart && pages < binStart + range / binCount) {
          bins[binStart]++;
        }
      });
    }

    const data = Object.entries(bins).map(([binStart, count]) => {
      const center = parseFloat(binStart) + step / 2;
      return {
        pages: Math.round(center),
        count,
        normal: normalDistribution(center, mean, stdDev) * allPages.length * step,
      };
    });

    return { data, mean, stdDev, min, max };
  }, [usersData]);

  if (!chartData || chartData.data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-zinc-500 text-sm">
        Nenhum dado disponível
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-center gap-6 mb-2 text-xs text-zinc-400">
        <span>Média: <span className="text-zinc-200">{chartData.mean.toFixed(1)}</span> pág</span>
        <span>Desvio: <span className="text-zinc-200">{chartData.stdDev.toFixed(1)}</span></span>
        <span>Min: <span className="text-zinc-200">{chartData.min}</span></span>
        <span>Max: <span className="text-zinc-200">{chartData.max}</span></span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={chartData.data} margin={{ top: 10, right: 20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="1 1" stroke="#27272a" vertical={false} />
          <XAxis
            dataKey="pages"
            stroke="#52525b"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            label={{ value: "Páginas", position: "insideBottom", offset: -5, fill: "#52525b", fontSize: 10 }}
          />
          <YAxis
            stroke="#52525b"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={40}
            label={{ value: "Frequência", angle: -90, position: "insideLeft", fill: "#52525b", fontSize: 10 }}
          />
          <Tooltip content={<ChartTooltip />} cursor={false} />
          <Area
            type="monotone"
            dataKey="count"
            stroke={CHART_COLORS[0]}
            fill={CHART_COLORS[0]}
            fillOpacity={0.3}
            strokeWidth={2}
            name="Histograma"
          />
          <Area
            type="monotone"
            dataKey="normal"
            stroke={CHART_COLORS[1]}
            fill="transparent"
            strokeWidth={2}
            strokeDasharray="5 5"
            name="Curva Normal"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
