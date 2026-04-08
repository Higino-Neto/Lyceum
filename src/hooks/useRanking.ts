import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";

interface RankingUser {
  user_id: string;
  username: string;
  avatar_url: string;
  total_pages: number;
  today_pages: number;
  this_week_pages: number;
  month_pages: number;
}

async function fetchRanking(): Promise<RankingUser[]> {
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

export default function useRanking() {
  return useQuery<RankingUser[]>({
    queryKey: ["ranking"],
    queryFn: fetchRanking,
    staleTime: 1000 * 60 * 2,
    refetchOnMount: true,
  });
}
