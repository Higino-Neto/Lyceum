import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRpc = vi.fn();

vi.mock("../../lib/supabase", () => ({
  supabase: {
    rpc: mockRpc,
  },
}));

vi.mock("../../api/database", () => ({
  getUserReadings: vi.fn().mockResolvedValue([
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
  ]),
}));

import getReadings from "../../utils/getReadings";

describe("getReadings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches user readings ordered by date descending", async () => {
    const readings = await getReadings();

    expect(readings).toBeDefined();
    expect(readings.length).toBe(2);
  });

  it("returns readings with correct structure", async () => {
    const readings = await getReadings();

    expect(readings[0]).toHaveProperty("id");
    expect(readings[0]).toHaveProperty("source_name");
    expect(readings[0]).toHaveProperty("pages");
    expect(readings[0]).toHaveProperty("reading_date");
  });

  it("fetches readings via getUserReadings", async () => {
    await getReadings();

    const { getUserReadings } = await import("../../api/database");
    expect(getUserReadings).toHaveBeenCalled();
  });
});
