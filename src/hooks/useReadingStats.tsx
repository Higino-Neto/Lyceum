import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import getUser from "../utils/getUser";

interface Stats {
  readingStats: {
    user_id: string;
    total_pages: number;
    total_minutes: number;
    month_pages: number;
    month_minutes: number;
  };
  userStreak: number;
}

async function fetchStats(): Promise<Stats> {
  const user = await getUser();
  
  const { data: readingStats, error: readingStatsError } = await supabase
    .from("reading_stats")
    .select("user_id, total_pages, total_minutes, month_pages, month_minutes")
    .eq("user_id", user.id)
    .maybeSingle();
    
  if (readingStatsError) {
    console.error("Error fetching reading stats:", readingStatsError);
  }

  const { data: userStreak } = await supabase.rpc("get_current_streak", {
    p_user_id: user.id,
  });

  return { 
    readingStats: readingStats || {
      user_id: user.id,
      total_pages: 0,
      total_minutes: 0,
      month_pages: 0,
      month_minutes: 0,
    },
    userStreak 
  };
}

export default function useReadingStats() {
  return useQuery<Stats>({
    queryKey: ["readingStats"],
    queryFn: fetchStats,
  });
}

