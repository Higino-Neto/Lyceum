import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("../../lib/supabase", () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "test-user", email: "test@test.com" } },
        error: null,
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          user_id: "test-user",
          total_pages: 1000,
          total_minutes: 5000,
          month_pages: 150,
          month_minutes: 600,
        },
        error: null,
      }),
    }),
    rpc: vi.fn().mockResolvedValue({
      data: 5,
      error: null,
    }),
  },
  default: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "test-user", email: "test@test.com" } },
        error: null,
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          user_id: "test-user",
          total_pages: 1000,
          total_minutes: 5000,
          month_pages: 150,
          month_minutes: 600,
        },
        error: null,
      }),
    }),
    rpc: vi.fn().mockResolvedValue({
      data: 5,
      error: null,
    }),
  },
}));

import useReadingStats from "../../hooks/useReadingStats";

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

describe("useReadingStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns reading stats and streak data", async () => {
    const { result } = renderHook(() => useReadingStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeDefined();
    expect(result.current.data?.readingStats).toBeDefined();
    expect(result.current.data?.userStreak).toBeDefined();
  });

  it("returns correct stats values", async () => {
    const { result } = renderHook(() => useReadingStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.readingStats.total_pages).toBe(1000);
    expect(result.current.data?.readingStats.total_minutes).toBe(5000);
    expect(result.current.data?.readingStats.month_pages).toBe(150);
  });

  it("fetches stats from the correct table", async () => {
    const { result } = renderHook(() => useReadingStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const { supabase } = await import("../../lib/supabase");
    expect(supabase.from).toHaveBeenCalledWith("reading_stats");
  });

  it("calls get_current_streak RPC", async () => {
    const { result } = renderHook(() => useReadingStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const { supabase } = await import("../../lib/supabase");
    expect(supabase.rpc).toHaveBeenCalledWith("get_current_streak", {
      p_user_id: "test-user",
    });
  });
});
