import { afterEach, describe, expect, it, vi } from "vitest";

const { createClientMock, configuredClient } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  configuredClient: {
    auth: {
      getUser: vi.fn(),
    },
  },
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}));

describe("supabase configuration", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    createClientMock.mockReset();
  });

  it("does not crash during import when Supabase env vars are missing", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");

    const { getSupabaseConfig, isSupabaseConfigured, supabase } = await import("../lib/supabase");

    expect(isSupabaseConfigured).toBe(false);
    expect(getSupabaseConfig()).toBeNull();
    expect(createClientMock).not.toHaveBeenCalled();
    await expect(supabase.auth.getUser()).resolves.toMatchObject({
      data: null,
      error: expect.objectContaining({
        message: expect.stringContaining("Supabase is not configured"),
      }),
    });
  });

  it("creates the real client when Supabase env vars are present", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-key");
    createClientMock.mockReturnValue(configuredClient);

    const { getSupabaseConfig, isSupabaseConfigured, supabase } = await import("../lib/supabase");

    expect(isSupabaseConfigured).toBe(true);
    expect(getSupabaseConfig()).toEqual({
      url: "https://example.supabase.co",
      anonKey: "anon-key",
    });
    expect(createClientMock).toHaveBeenCalledWith("https://example.supabase.co", "anon-key", {
      auth: {
        detectSessionInUrl: false,
      },
    });
    expect(supabase).toBe(configuredClient);
  });
});
