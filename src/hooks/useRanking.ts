import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";

interface RankingUser {
  user_id: string;
  username: string;
  total_pages: number;
  avatar_url: string;
}

async function fetchRanking(): Promise<RankingUser[]> {
  const { data: statsData, error } = await supabase
    .from("reading_stats")
    .select("user_id, total_pages, avatar_url")
    .order("total_pages", { ascending: false })
    .limit(10);

  if (error) {
    console.error("Error fetching ranking:", error);
    return [];
  }

  if (error) {
    console.error("Error fetching ranking:", error);
    return [];
  }

  const userIds = statsData?.map((s) => s.user_id) || [];

  if (userIds.length === 0) return [];

  const { data: usersData } = await supabase
    .from("profiles")
    .select("id, name")
    .in("id", userIds);

  console.log(usersData);

  const usersMap = new Map<string, string>();
  if (usersData && usersData.length > 0) {
    for (const u of usersData) {
      usersMap.set(u.id, u.name || "Usuário");
    }
  } else {
    const { data: authData, error: authError } =
      await supabase.auth.admin.listUsers();
    for (const u of authData.users) {
      const metadata = u.user_metadata || {};
      const name =
        metadata.name ||
        metadata.full_name ||
        metadata.display_name ||
        u.email?.split("@")[0] ||
        "Usuário";
      usersMap.set(u.id, name);
    }
  }

  return (
    statsData?.map((item) => ({
      user_id: item.user_id,
      username: usersMap.get(item.user_id) || "Usuário",
      total_pages: item.total_pages,
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
