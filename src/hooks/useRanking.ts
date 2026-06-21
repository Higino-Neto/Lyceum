import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";

export interface RankingUser {
  user_id: string;
  username: string;
  avatar_url: string;
  total_pages: number;
  today_pages?: number;
  this_week_pages?: number;
  month_pages?: number;
}

function getPeriodStartDate(period: string): Date | null {
  if (period === "all_time") return null;

  const now = new Date();
  const brazilOffset = -3 * 60;
  const localOffset = now.getTimezoneOffset();
  const diffMs = (brazilOffset - localOffset) * 60 * 1000;
  const brazilNow = new Date(now.getTime() + diffMs);

  const brazilDate = new Date(
    Date.UTC(brazilNow.getFullYear(), brazilNow.getMonth(), brazilNow.getDate()),
  );

  if (period === "today") return brazilDate;

  if (period === "this_week") {
    const dayOfWeek = brazilDate.getUTCDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(brazilDate);
    monday.setUTCDate(monday.getUTCDate() + diffToMonday);
    return monday;
  }

  if (period === "this_month") {
    return new Date(Date.UTC(brazilDate.getUTCFullYear(), brazilDate.getUTCMonth(), 1));
  }

  return null;
}

function toISODate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function fetchCategoryRanking(
  categoryId: string,
  period: string,
): Promise<RankingUser[]> {
  const startDate = getPeriodStartDate(period);

  let query = supabase
    .from("readings")
    .select("user_id, pages, reading_date")
    .eq("category_id", categoryId);

  if (startDate) {
    query = query.gte("reading_date", toISODate(startDate));
  }

  const { data: readingsData, error } = await query;

  if (error) {
    console.error("Error fetching category ranking:", error);
    return [];
  }

  if (!readingsData || readingsData.length === 0) return [];

  const pagesByUser = new Map<string, number>();
  for (const r of readingsData) {
    pagesByUser.set(r.user_id, (pagesByUser.get(r.user_id) || 0) + r.pages);
  }

  const sorted = [...pagesByUser.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const userIds = sorted.map(([id]) => id);

  const { data: usersData } = await supabase
    .from("profiles")
    .select("id, name, avatar_url")
    .in("id", userIds);

  const usersMap = new Map<string, { name: string; avatar_url: string }>();
  if (usersData) {
    for (const u of usersData) {
      usersMap.set(u.id, { name: u.name || "Usuário", avatar_url: u.avatar_url || "" });
    }
  }

  return sorted.map(([userId, totalPages]) => ({
    user_id: userId,
    username: usersMap.get(userId)?.name || "Usuário",
    avatar_url: usersMap.get(userId)?.avatar_url || "",
    total_pages: totalPages,
  }));
}

async function fetchFullRanking(): Promise<RankingUser[]> {
  const { data: statsData, error } = await supabase
    .from("reading_stats")
    .select("user_id, total_pages, today_pages, this_week_pages, month_pages, avatar_url")
    .order("total_pages", { ascending: false })
    .limit(10);

  if (error) {
    console.error("Error fetching ranking:", error);
    return [];
  }

  const userIds = statsData?.map((s) => s.user_id) || [];

  if (userIds.length === 0) return [];

  const { data: usersData, error: profilesError } = await supabase
    .from("profiles")
    .select("id, name")
    .in("id", userIds);

  if (profilesError) {
    console.warn("Profiles are not available for ranking names:", profilesError.message);
  }

  const usersMap = new Map<string, string>();
  if (usersData && usersData.length > 0) {
    for (const u of usersData) {
      usersMap.set(u.id, u.name || "Usuário");
    }
  }

  return (
    statsData?.map((item) => ({
      user_id: item.user_id,
      username: usersMap.get(item.user_id) || "Usuário",
      total_pages: item.total_pages,
      today_pages: item.today_pages,
      this_week_pages: item.this_week_pages,
      month_pages: item.month_pages,
      avatar_url: item.avatar_url,
    })) || []
  );
}

async function fetchRanking(
  categoryId?: string | null,
  period?: string,
): Promise<RankingUser[]> {
  if (categoryId) {
    return fetchCategoryRanking(categoryId, period ?? "all_time");
  }

  return fetchFullRanking();
}

export default function useRanking(
  categoryId?: string | null,
  period?: string,
) {
  return useQuery<RankingUser[]>({
    queryKey: ["ranking", categoryId ?? "all", period ?? "all_time"],
    queryFn: () => fetchRanking(categoryId, period),
    staleTime: 1000 * 60 * 2,
    refetchOnMount: true,
  });
}
