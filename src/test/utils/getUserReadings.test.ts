import { describe, it, expect, vi } from "vitest";

vi.mock("../../lib/supabase", () => ({
  supabase: {
    rpc: vi.fn(),
  },
  default: {
    rpc: vi.fn(),
  },
}));

import { supabase } from "../../lib/supabase";
import getUserReadings from "../../utils/getUserReadings";

describe("getUserReadings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch user readings from supabase", async () => {
    const mockReadings = [
      { id: "1", source_name: "Book 1", pages: 50, reading_date: "2024-01-15", reading_time: 120, category_id: "cat-1" },
      { id: "2", source_name: "Book 2", pages: 30, reading_date: "2024-01-16", reading_time: 60, category_id: "cat-2" },
    ];

    (supabase.rpc as any).mockResolvedValue({
      data: mockReadings,
      error: null,
      count: 2,
      status: 200,
      statusText: "OK",
    });

    const result = await getUserReadings("user-123");

    expect(supabase.rpc).toHaveBeenCalledWith("get_user_readings", {
      p_user_id: "user-123",
    });
    expect(result).toEqual(mockReadings);
  });

  it("should return empty array when no readings", async () => {
    (supabase.rpc as any).mockResolvedValue({
      data: null,
      error: null,
      count: 0,
      status: 200,
      statusText: "OK",
    });

    const result = await getUserReadings("user-123");

    expect(result).toEqual([]);
  });

  it("should throw error when RPC fails", async () => {
    (supabase.rpc as any).mockResolvedValue({
      data: null,
      error: { message: "Database error", details: "", hint: "", code: "500" },
      count: null,
      status: 500,
      statusText: "Internal Server Error",
    });

    await expect(getUserReadings("user-123")).rejects.toThrow("Database error");
  });
});
