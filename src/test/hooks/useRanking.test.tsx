import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockRankingData = vi.hoisted(() => [
  {
    user_id: "user-1",
    username: "Alice",
    nickname: "alice",
    avatar_url: null,
    total_pages: 150,
    today_pages: 15,
    this_week_pages: 80,
    month_pages: 120,
    is_current_user: false,
  },
  {
    user_id: "user-2",
    username: "Bob",
    nickname: "bob",
    avatar_url: null,
    total_pages: 100,
    today_pages: 10,
    this_week_pages: 50,
    month_pages: 90,
    is_current_user: false,
  },
]);

vi.mock("../../lib/supabase", () => ({
  supabase: {
    rpc: vi.fn().mockResolvedValue({
      data: mockRankingData,
      error: null,
    }),
  },
  default: {
    rpc: vi.fn().mockResolvedValue({
      data: mockRankingData,
      error: null,
    }),
  },
}));

import useRanking from "../../hooks/useRanking";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useRanking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches friend ranking data successfully", async () => {
    const { result } = renderHook(() => useRanking(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeDefined();
    expect(result.current.data?.length).toBeGreaterThan(0);
  });

  it("returns ranking sorted by total pages", async () => {
    const { result } = renderHook(() => useRanking(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data[0].total_pages).toBeGreaterThanOrEqual(data[1].total_pages);
  });

  it("includes username from the friend ranking rpc", async () => {
    const { result } = renderHook(() => useRanking(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const usernames = result.current.data?.map((user) => user.username) || [];
    expect(usernames).toContain("Alice");
    expect(usernames).toContain("Bob");
  });

  it("fetches from the friend ranking rpc", async () => {
    const { result } = renderHook(() => useRanking(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const { supabase } = await import("../../lib/supabase");
    expect(supabase.rpc).toHaveBeenCalledWith("get_friend_ranking", {
      p_period: "all_time",
    });
  });
});
