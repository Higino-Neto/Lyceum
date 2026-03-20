import { useState, useMemo, useEffect } from "react";
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
  Legend,
} from "recharts";
import getReadings from "../../../utils/getReadings";
import getUserReadings from "../../../utils/getUserReadings";
import getUser from "../../../utils/getUser";
import { supabase } from "../../../lib/supabase";
import { CATEGORY_LABELS } from "../../../types/ReadingTypes";
import { useSelectedUsers } from "../../../contexts/SelectedUsersContext";

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

interface UserData {
  userId: string;
  username: string;
  isCurrentUser: boolean;
}

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
  user_id?: string;
}

interface CategoryData {
  id: string;
  name: string;
}

interface UserReadingData {
  user: UserData;
  readings: ReadingData[];
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
    color?: string;
    payload: Record<string, unknown>;
  }>;
  label?: string;
}

function ChartTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded px-3 py-2 shadow-xl">
      <p className="text-zinc-400 text-xs">{label}</p>
      {payload.map((entry, index) => (
        <p key={index} className="text-zinc-100 text-sm font-medium" style={{ color: entry.color }}>
          {entry.name}: {entry.value?.toLocaleString("pt-BR")} páginas
        </p>
      ))}
    </div>
  );
}

function DailyPagesChart({ usersData }: { usersData: UserReadingData[] }) {
  const chartData = useMemo(() => {
    const allDates = new Set<string>();
    usersData.forEach((userData) => {
      userData.readings.forEach((item) => {
        allDates.add(item.reading_date);
      });
    });

    const sortedDates = Array.from(allDates).sort(
      (a, b) => new Date(a).getTime() - new Date(b).getTime()
    ).slice(-30);

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

  if (chartData.length === 0 || usersData.every((u) => u.readings.length === 0)) {
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

function CategoryDonutChart({
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
      totals[categoryId] = Object.values(userPages).reduce((sum, val) => sum + val, 0);
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
    const grouped = currentUserData.readings.reduce<Record<string, number>>((acc, item) => {
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
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [usersData, categories]);

  if (chartData.length === 0 || usersData.every((u) => u.readings.length === 0)) {
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

function WeeklyPagesChart({ usersData }: { usersData: UserReadingData[] }) {
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
      const dataPoint: Record<string, string | number> = { week: weekKeys.get(weekKey) || weekKey, key: weekKey };
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

  if (chartData.length === 0 || usersData.every((u) => u.readings.length === 0)) {
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

function WeekdayChart({ usersData }: { usersData: UserReadingData[] }) {
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
      const dataPoint: Record<string, string | number> = { day: WEEKDAY_NAMES[dayIndex] };
      usersData.forEach((userData) => {
        const userPages = userData.readings
          .filter((r) => {
            const readingDate = parseLocalDate(r.reading_date);
            return readingDate >= monday && readingDate <= sunday && readingDate.getDay() === dayIndex;
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

export default function ReadingCharts() {
  const [activeChart, setActiveChart] = useState<ChartType>("daily");
  const { selectedUsers, currentUserId } = useSelectedUsers();

  const { data: currentUserData, isLoading: isLoadingCurrentUser } = useQuery<ReadingData[]>({
    queryKey: ["readings"],
    queryFn: getReadings,
    staleTime: 0,
  });

  const { data: categories } = useQuery<CategoryData[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*");
      return data || [];
    },
  });

  const selectedUserIds = selectedUsers.map((u) => u.user_id).join(',');
  const selectedUsersInfo = selectedUsers.map((u) => ({ userId: u.user_id, username: u.username }));

  const { data: selectedUsersReadings, isLoading: isLoadingSelectedUsers, refetch: refetchSelected, error: selectedUsersError } = useQuery<UserReadingData[]>({
    queryKey: ["selectedUsersReadings", selectedUserIds],
    queryFn: async () => {
      if (selectedUsersInfo.length === 0) return [];
      const results = await Promise.all(
        selectedUsersInfo.map(async (user) => {
          const readings = await getUserReadings(user.userId);
          return {
            user: {
              userId: user.userId,
              username: user.username,
              isCurrentUser: false,
            },
            readings,
          };
        })
      );
      return results;
    },
    enabled: selectedUsers.length > 0,
    staleTime: 0,
  });

  useEffect(() => {
    if (selectedUsers.length > 0) {
      refetchSelected();
    }
  }, [selectedUsers, refetchSelected]);

  useEffect(() => {
    if (selectedUsersError) {
      console.error("Error fetching selected users readings:", selectedUsersError);
    }
  }, [selectedUsersError]);

  const usersData = useMemo(() => {
    const users: UserReadingData[] = [];
    
    if (currentUserId) {
      users.push({
        user: {
          userId: currentUserId,
          username: "Você",
          isCurrentUser: true,
        },
        readings: currentUserData || [],
      });
    }

    if (selectedUsersReadings) {
      users.push(...selectedUsersReadings);
    }

    return users;
  }, [currentUserId, currentUserData, selectedUsersReadings]);

  const isLoading = isLoadingCurrentUser || isLoadingSelectedUsers;

  const renderChart = () => {
    if (isLoading) {
      return (
        <div className="h-48 flex items-center justify-center">
          <div className="w-5 h-5 border border-zinc-700 border-t-green-600 rounded-full animate-spin" />
        </div>
      );
    }

    switch (activeChart) {
      case "daily":
        return <DailyPagesChart usersData={usersData} />;
      case "weekday":
        return <WeekdayChart usersData={usersData} />;
      case "weekly":
        return <WeeklyPagesChart usersData={usersData} />;
      case "category":
        return (
          <CategoryDonutChart usersData={usersData} categories={categories || []} />
        );
      default:
        return null;
    }
  };

  return (
    <div className="">
      <div className="flex border-b-2 border-zinc-800">
        {CHART_OPTIONS.map((option) => (
          <button
            key={option.key}
            onClick={() => setActiveChart(option.key)}
            className={`flex-1 py-3.5 cursor-pointer rounded-t-sm text-sm font-medium transition ${
              activeChart === option.key
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="p-2 pt-4 min-h-56" key={activeChart}>{renderChart()}</div>
      {usersData.length > 1 && (
        <div className="px-2 pb-2 flex gap-3 justify-center">
          {usersData.map((userData, index) => (
            <div key={userData.user.userId} className="flex items-center gap-1.5 text-xs">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
              />
              <span className={userData.user.isCurrentUser ? "text-zinc-200 font-medium" : "text-zinc-500"}>
                {userData.user.username}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
