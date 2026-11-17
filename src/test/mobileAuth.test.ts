import { describe, expect, it } from "vitest";
import { getAuthErrorMessage } from "../lib/supabaseAuth";

describe("mobile authentication errors", () => {
  it("turns Supabase and network failures into actionable messages", () => {
    expect(getAuthErrorMessage(new Error("Invalid login credentials"))).toBe("Email ou senha incorretos.");
    expect(getAuthErrorMessage(new Error("Email not confirmed"))).toBe("Confirme seu email antes de entrar.");
    expect(getAuthErrorMessage(new TypeError("Failed to fetch"))).toContain("Verifique sua internet");
  });
});
