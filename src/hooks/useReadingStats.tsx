import { useEffect, useState } from "react";
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

export default function useReadingStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => {
    const load = async () => {
      const user = await getUser();
      const { data: readingStats, error: readingStatsError } = await supabase
        .from("reading_stats")
        .select("user_id, total_pages, total_minutes, month_pages, month_minutes")
        .eq("user_id", user.id)
        .single();
        if (readingStatsError) throw readingStatsError;

        console.log(readingStats)
      const { data: userStreak } = await supabase.rpc("get_current_streak", {
        p_user_id: user.id,
      });

      setStats({ readingStats, userStreak });
    };
    load();
  }, []);

  return stats;
}
