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

async function fetchRanking(
  categoryId?: string | null,
  period?: string,
): Promise<RankingUser[]> {
  if (categoryId) {
    const { data: rankingData, error } = await supabase
      .rpc("get_category_ranking", {
        p_category_id: categoryId,
        p_period: period ?? "all_time",
      });

    if (error) {
      console.error("Error fetching category ranking:", error);
      return [];
    }

    const userIds = (rankingData as { user_id: string; total_pages: bigint }[] | null)?.map((r) => r.user_id) || [];

    if (userIds.length === 0) return [];

    const { data: usersData, error: profilesError } = await supabase
      .from("profiles")
      .select("id, name, avatar_url")
      .in("id", userIds);

    if (profilesError) {
      console.warn("Profiles not available:", profilesError.message);
    }

    const usersMap = new Map<string, { name: string; avatar_url: string }>();
    if (usersData && usersData.length > 0) {
      for (const u of usersData) {
        usersMap.set(u.id, { name: u.name || "Usuário", avatar_url: u.avatar_url || "" });
      }
    }

    return (
      (rankingData as { user_id: string; total_pages: bigint }[])?.map((item) => ({
        user_id: item.user_id,
        username: usersMap.get(item.user_id)?.name || "Usuário",
        avatar_url: usersMap.get(item.user_id)?.avatar_url || "",
        total_pages: Number(item.total_pages),
      })) || []
    );
  }

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
