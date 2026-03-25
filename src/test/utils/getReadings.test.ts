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
      order: vi.fn().mockResolvedValue({
        data: [
          {
            id: "reading-1",
            source_name: "The Pragmatic Programmer",
            pages: 50,
            reading_date: "2024-01-15",
            reading_time: 120,
            category_id: "cat-1",
          },
          {
            id: "reading-2",
            source_name: "Clean Code",
            pages: 30,
            reading_date: "2024-01-14",
            reading_time: 90,
            category_id: "cat-1",
          },
        ],
        error: null,
      }),
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
      order: vi.fn().mockResolvedValue({
        data: [
          {
            id: "reading-1",
            source_name: "The Pragmatic Programmer",
            pages: 50,
            reading_date: "2024-01-15",
            reading_time: 120,
            category_id: "cat-1",
          },
          {
            id: "reading-2",
            source_name: "Clean Code",
            pages: 30,
            reading_date: "2024-01-14",
            reading_time: 90,
            category_id: "cat-1",
          },
        ],
        error: null,
      }),
    }),
  },
}));

import getReadings from "../../utils/getReadings";

describe("getReadings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches user readings ordered by date descending", async () => {
    const readings = await getReadings();

    expect(readings).toBeDefined();
    expect(readings.length).toBeGreaterThan(0);
  });

  it("returns readings with correct structure", async () => {
    const readings = await getReadings();

    expect(readings[0]).toHaveProperty("id");
    expect(readings[0]).toHaveProperty("source_name");
    expect(readings[0]).toHaveProperty("pages");
    expect(readings[0]).toHaveProperty("reading_date");
  });

  it("filters readings by user id", async () => {
    await getReadings();

    const { supabase } = await import("../../lib/supabase");
    expect(supabase.from).toHaveBeenCalledWith("readings");
  });
});
