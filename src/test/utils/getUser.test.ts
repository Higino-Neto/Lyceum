import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import getUser from "../../utils/getUser";

const mockUser = {
  id: "test-user-id",
  email: "test@example.com",
  user_metadata: {
    name: "Test User",
  },
  app_metadata: {},
  aud: "authenticated",
  created_at: "2024-01-01T00:00:00.000Z",
} as any;

vi.mock("../../lib/supabase", () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
  },
  default: {
    auth: {
      getUser: vi.fn(),
    },
  },
}));

import { supabase } from "../../lib/supabase";

describe("getUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns user data when authentication succeeds", async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
      data: { user: mockUser },
      error: null,
    });

    const user = await getUser();

    expect(user).toEqual(mockUser);
    expect(supabase.auth.getUser).toHaveBeenCalledTimes(1);
  });

  it("throws error when user is not found", async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    await expect(getUser()).rejects.toThrow("User not found");
  });

  it("throws error when authentication fails", async () => {
    const authError = new Error("Invalid token");
    vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
      data: { user: null },
      error: authError,
    });

    await expect(getUser()).rejects.toThrow(authError);
  });
});
