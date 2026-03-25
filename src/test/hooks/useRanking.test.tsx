import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockRankingData = [
  {
    user_id: "user-1",
    username: "Alice",
    avatar_url: null,
    total_pages: 150,
    today_pages: 15,
    this_week_pages: 80,
    month_pages: 120,
  },
  {
    user_id: "user-2",
    username: "Bob",
    avatar_url: null,
    total_pages: 100,
    today_pages: 10,
    this_week_pages: 50,
    month_pages: 90,
  },
];

vi.mock("../../lib/supabase", () => ({
  supabase: {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "reading_stats") {
        return {
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: mockRankingData,
            error: null,
          }),
        };
      }
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: mockRankingData.map((u) => ({ id: u.user_id, name: u.username })),
            error: null,
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
      };
    }),
    auth: {
      admin: {
        listUsers: vi.fn().mockResolvedValue({
          data: { users: [] },
          error: null,
        }),
      },
    },
  },
  default: {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "reading_stats") {
        return {
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: mockRankingData,
            error: null,
          }),
        };
      }
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: mockRankingData.map((u) => ({ id: u.user_id, name: u.username })),
            error: null,
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
      };
    }),
    auth: {
      admin: {
        listUsers: vi.fn().mockResolvedValue({
          data: { users: [] },
          error: null,
        }),
      },
    },
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

  it("fetches ranking data successfully", async () => {
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

  it("includes username from profiles", async () => {
    const { result } = renderHook(() => useRanking(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const usernames = result.current.data?.map((u) => u.username) || [];
    expect(usernames).toContain("Alice");
    expect(usernames).toContain("Bob");
  });

  it("fetches from correct tables", async () => {
    const { result } = renderHook(() => useRanking(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const { supabase } = await import("../../lib/supabase");
    expect(supabase.from).toHaveBeenCalledWith("reading_stats");
  });
});
