import { describe, expect, it } from "vitest";
import { getMobileAuthErrorMessage } from "../mobile/supabaseMobile";

describe("mobile authentication errors", () => {
  it("turns Supabase and network failures into actionable messages", () => {
    expect(getMobileAuthErrorMessage(new Error("Invalid login credentials"))).toBe("Email ou senha incorretos.");
    expect(getMobileAuthErrorMessage(new Error("Email not confirmed"))).toBe("Confirme seu email antes de entrar.");
    expect(getMobileAuthErrorMessage(new TypeError("Failed to fetch"))).toContain("Verifique sua internet");
  });
});
