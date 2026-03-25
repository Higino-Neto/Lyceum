import { vi } from "vitest";

export const mockSupabaseUser = {
  id: "test-user-id",
  email: "test@example.com",
  user_metadata: {
    name: "Test User",
    full_name: "Test User",
  },
};

export const mockSupabaseProfile = {
  id: "test-user-id",
  name: "Test User",
  avatar_url: null,
  created_at: "2024-01-01T00:00:00.000Z",
};

export const mockRankingUser = {
  user_id: "test-user-id",
  username: "Test User",
  avatar_url: null,
  total_pages: 100,
  today_pages: 10,
  this_week_pages: 50,
  month_pages: 80,
};

export const mockReadingStats = {
  user_id: "test-user-id",
  total_pages: 1000,
  total_minutes: 5000,
  month_pages: 150,
  month_minutes: 600,
};

export const mockReading = {
  id: "reading-1",
  source_name: "The Pragmatic Programmer",
  pages: 50,
  reading_date: "2024-01-15",
  reading_time: 120,
  category_id: null,
};

export function createMockSupabaseClient(overrides = {}) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: mockSupabaseUser },
        error: null,
      }),
      admin: {
        listUsers: vi.fn().mockResolvedValue({
          data: { users: [mockSupabaseUser] },
          error: null,
        }),
      },
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: mockReadingStats,
        error: null,
      }),
      then: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    }),
    rpc: vi.fn().mockResolvedValue({
      data: 5,
      error: null,
    }),
    ...overrides,
  };
}

export function setupSupabaseMock() {
  const mockClient = createMockSupabaseClient();

  vi.mock("../../lib/supabase", () => ({
    supabase: mockClient,
    default: mockClient,
  }));

  return mockClient;
}
