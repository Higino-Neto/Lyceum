import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";

export interface RankingUser {
  user_id: string;
  username: string;
  nickname?: string | null;
  avatar_url: string;
  total_pages: number;
  today_pages?: number;
  this_week_pages?: number;
  month_pages?: number;
  is_current_user?: boolean;
}

interface RankingRow {
  user_id: string;
  username?: string | null;
  name?: string | null;
  nickname?: string | null;
  avatar_url?: string | null;
  total_pages?: number | string | null;
  today_pages?: number | string | null;
  this_week_pages?: number | string | null;
  month_pages?: number | string | null;
  is_current_user?: boolean | null;
}

function mapRankingRow(row: RankingRow): RankingUser {
  return {
    user_id: row.user_id,
    username: row.username || row.name || row.nickname || "Usuario",
    nickname: row.nickname || null,
    avatar_url: row.avatar_url || "",
    total_pages: Number(row.total_pages || 0),
    today_pages: Number(row.today_pages || 0),
    this_week_pages: Number(row.this_week_pages || 0),
    month_pages: Number(row.month_pages || 0),
    is_current_user: Boolean(row.is_current_user),
  };
}

async function fetchCategoryRanking(
  categoryId: string,
  period: string,
): Promise<RankingUser[]> {
  const { data, error } = await supabase.rpc("get_friend_category_ranking", {
    p_category_id: categoryId,
    p_period: period,
  });

  if (error) {
    console.error("Error fetching friend category ranking:", error);
    return [];
  }

  return ((data as RankingRow[] | null) || []).map(mapRankingRow);
}

async function fetchFullRanking(period: string): Promise<RankingUser[]> {
  const { data, error } = await supabase.rpc("get_friend_ranking", {
    p_period: period,
  });

  if (error) {
    console.error("Error fetching friend ranking:", error);
    return [];
  }

  return ((data as RankingRow[] | null) || []).map(mapRankingRow);
}

async function fetchRanking(
  categoryId?: string | null,
  period = "all_time",
): Promise<RankingUser[]> {
  if (categoryId) {
    return fetchCategoryRanking(categoryId, period);
  }

  return fetchFullRanking(period);
}

export default function useRanking(
  categoryId?: string | null,
  period?: string,
) {
  return useQuery<RankingUser[]>({
    queryKey: ["ranking", categoryId ?? "all", period ?? "all_time"],
    queryFn: () => fetchRanking(categoryId, period ?? "all_time"),
    staleTime: 1000 * 60 * 2,
    refetchOnMount: true,
  });
}
