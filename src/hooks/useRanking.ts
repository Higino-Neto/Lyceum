import { useQuery } from "@tanstack/react-query";
import { getRanking, type RankingUser } from "../api/database";


export type { RankingUser };

/** The dashboard table shows an empty ranking rather than an error state. */
async function fetchRanking(categoryId?: string | null, period = "all_time"): Promise<RankingUser[]> {
  try {
    return await getRanking(categoryId, period);
  } catch (error) {
    console.error("Error fetching friend ranking:", error);
    return [];
  }
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
