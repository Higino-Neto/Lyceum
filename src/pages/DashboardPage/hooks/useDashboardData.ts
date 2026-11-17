import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCategories, getFriends, type Category } from "../../../api/database";
import { useAuth } from "../../../contexts/AuthContext";
import { LOCAL_USER_ID } from "../../../features/language-learning/learningClient";
import type { PersonReadings } from "../../../features/stats/friendsAnalytics";
import { DAILY_GOAL_STORAGE_KEY, normalizeGoals, READING_GOALS_STORAGE_KEY, STREAK_FREEZE_STORAGE_KEY, type ReadingGoals } from "../../../features/stats/goals";
import type { ReadingRecord } from "../../../features/stats/readingAnalytics";
import useGetReadings from "../../../hooks/useGetReadings";
import { useLocalStorage } from "../../../hooks/useLocalStorage";
import getUserReadings from "../../../utils/getUserReadings";

const EMPTY: ReadingRecord[] = [];

/** The signed-in user's reading log, typed for the analytics helpers. */
export function useReadingRecords() {
  const query = useGetReadings();
  const records = useMemo<ReadingRecord[]>(() => (query.data as ReadingRecord[] | undefined) ?? EMPTY, [query.data]);
  return { records, isLoading: query.isLoading };
}

/** Local-library statistics; only available in the desktop app. */
export function useLibrarySummary() {
  const available = typeof window !== "undefined" && Boolean(window.api?.statsLibrarySummary);
  const query = useQuery({
    queryKey: ["stats", "library"],
    queryFn: () => window.api!.statsLibrarySummary(),
    enabled: available,
    staleTime: 60_000,
  });
  return { ...query, available };
}

/** Vocabulary statistics for the language-learning reader (desktop only). */
export function useLanguageSummary() {
  const { user } = useAuth();
  const userId = user?.id ?? LOCAL_USER_ID;
  const available = typeof window !== "undefined" && Boolean(window.api?.statsLanguageSummary);
  const query = useQuery({
    queryKey: ["stats", "language", userId],
    queryFn: () => window.api!.statsLanguageSummary(userId),
    enabled: available,
    staleTime: 60_000,
  });
  return { ...query, available };
}

export function useCategories() {
  return useQuery<Category[]>({ queryKey: ["categories"], queryFn: getCategories, staleTime: 5 * 60_000 });
}

/** The user plus every friend with their reading logs (for the friends tab). */
export function useFriendsReadings(myName: string) {
  const { records, isLoading: loadingMine } = useReadingRecords();
  const { user } = useAuth();
  const friends = useQuery({
    queryKey: ["friendsReadings"],
    queryFn: async () => {
      const list = await getFriends();
      return Promise.all(list.map(async (friend) => {
        let readings: ReadingRecord[] = [];
        try {
          readings = (await getUserReadings(friend.user_id)) as ReadingRecord[];
        } catch {
          readings = [];
        }
        return {
          userId: friend.user_id,
          name: friend.nickname || friend.name || friend.user_id.slice(0, 6),
          isCurrentUser: false,
          readings,
        } satisfies PersonReadings;
      }));
    },
    staleTime: 2 * 60_000,
  });
  const people = useMemo<PersonReadings[]>(() => [
    { userId: user?.id ?? "me", name: myName, isCurrentUser: true, readings: records },
    ...(friends.data ?? []),
  ], [friends.data, myName, records, user?.id]);
  return { people, isLoading: loadingMine || friends.isLoading, hasFriends: (friends.data?.length ?? 0) > 0 };
}

export function useReadingGoals() {
  const [dailyGoal, setDailyGoal] = useLocalStorage<number>(DAILY_GOAL_STORAGE_KEY, 0);
  const [stored, setStored] = useLocalStorage<ReadingGoals>(READING_GOALS_STORAGE_KEY, normalizeGoals({}));
  const goals = useMemo(() => normalizeGoals(stored), [stored]);
  return { dailyGoal: Number(dailyGoal) || 0, setDailyGoal, goals, setGoals: setStored };
}

export function useStreakFreeze() {
  return useLocalStorage<boolean>(STREAK_FREEZE_STORAGE_KEY, false);
}

/** Data URLs for library thumbnails, keyed by thumbnail path. */
export function useThumbnails(paths: Array<string | null | undefined>) {
  const unique = useMemo(() => [...new Set(paths.filter((path): path is string => Boolean(path)))].sort(), [paths]);
  const query = useQuery({
    queryKey: ["stats", "thumbnails", unique],
    queryFn: async () => (await window.api!.getThumbnails(unique)) as Record<string, string | null>,
    enabled: unique.length > 0 && Boolean(window.api?.getThumbnails),
    staleTime: 10 * 60_000,
  });
  return query.data ?? {};
}
