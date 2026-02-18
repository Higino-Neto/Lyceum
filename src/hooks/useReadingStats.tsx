import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import getUser from "../utils/getUser";

interface Stats {
  id: string;
  total_pages: number;
  total_minutes: number;
}

export default function useReadingStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => {
    const load = async () => {
      const user = await getUser();
      const { data } = await supabase
        .from("reading_stats")
        .select("*")
        .eq("user_id", user.id)
        .single();
      setStats(data);
    };
    load();
  }, []);
  console.log(stats);

  return stats;
}
