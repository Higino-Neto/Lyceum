import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockCreateUserProfile,
  mockExchangeCodeForSession,
  mockResend,
  mockResetPasswordForEmail,
  mockSetSession,
  mockSignInWithPassword,
  mockSignOut,
  mockSignUp,
  mockUpdateUser,
  mockVerifyOtp,
} = vi.hoisted(() => ({
  mockCreateUserProfile: vi.fn(),
  mockExchangeCodeForSession: vi.fn(),
  mockResend: vi.fn(),
  mockResetPasswordForEmail: vi.fn(),
  mockSetSession: vi.fn(),
  mockSignInWithPassword: vi.fn(),
  mockSignOut: vi.fn(),
  mockSignUp: vi.fn(),
  mockUpdateUser: vi.fn(),
  mockVerifyOtp: vi.fn(),
}));

vi.mock("../../lib/supabase", () => ({
  supabase: {
    auth: {
      exchangeCodeForSession: mockExchangeCodeForSession,
      resend: mockResend,
      resetPasswordForEmail: mockResetPasswordForEmail,
      setSession: mockSetSession,
      signInWithPassword: mockSignInWithPassword,
      signOut: mockSignOut,
      signUp: mockSignUp,
      updateUser: mockUpdateUser,
      verifyOtp: mockVerifyOtp,
    },
  },
}));

vi.mock("../../api/database", () => ({
  createUserProfile: mockCreateUserProfile,
}));

import {
  consumeAuthRedirectSession,
  parseAuthRedirectParams,
  requestPasswordReset,
  resendSignupConfirmation,
  signIn,
  signOut,
  signUp,
  updateAccountPassword,
  validatePasswordStrength,
} from "../../utils/auth";

describe("auth utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState(null, "", "/");
  });

  describe("validatePasswordStrength", () => {
    it("requires at least 8 characters", () => {
      expect(validatePasswordStrength("short")).toMatch(/pelo menos 8/i);
      expect(validatePasswordStrength("passwordonly")).toBeNull();
      expect(validatePasswordStrength("12345678")).toBeNull();
    });
  });

  describe("signUp", () => {
    it("calls supabase signUp with profile metadata and normalized email", async () => {
      mockSignUp.mockResolvedValue({
        data: { user: { id: "user-123" }, session: null },
        error: null,
      });

      const result = await signUp(" Test@Example.com ", "Password123", "Test User");

      expect(mockSignUp).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "Password123",
        options: {
          emailRedirectTo: expect.any(String),
          data: {
            name: "Test User",
            full_name: "Test User",
          },
        },
      });
      expect(result.needsEmailConfirmation).toBe(true);
    });

    it("creates user profile after successful signup with a session", async () => {
      mockSignUp.mockResolvedValue({
        data: {
          user: { id: "user-123", email: "test@example.com" },
          session: { user: { id: "user-123", email: "test@example.com" } },
        },
        error: null,
      });
      mockCreateUserProfile.mockResolvedValue(undefined);

      await signUp("test@example.com", "Password123");

      expect(mockCreateUserProfile).toHaveBeenCalledWith("user-123", "test@example.com");
    });
  });

  describe("signIn", () => {
    it("calls supabase signInWithPassword with normalized email", async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: { id: "user-123", email: "test@example.com" } },
        error: null,
      });

      await signIn(" Test@Example.com ", "Password123");

      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "Password123",
      });
      expect(mockCreateUserProfile).toHaveBeenCalledWith("user-123", "test@example.com");
    });

    it("throws error when signin fails", async () => {
      const mockError = new Error("Invalid credentials");
      mockSignInWithPassword.mockResolvedValue({
        data: { user: null },
        error: mockError,
      });

      await expect(signIn("test@example.com", "wrongpassword")).rejects.toThrow(
        "Invalid credentials",
      );
    });
  });

  it("requests password reset with redirect", async () => {
    mockResetPasswordForEmail.mockResolvedValue({ data: {}, error: null });

    await requestPasswordReset(" Test@Example.com ");

    expect(mockResetPasswordForEmail).toHaveBeenCalledWith("test@example.com", {
      redirectTo: expect.any(String),
    });
  });

  it("parses recovery params from a production hash route", () => {
    const params = parseAuthRedirectParams(
      "",
      "#/reset-password?code=recovery-code&type=recovery",
    );

    expect(params.get("code")).toBe("recovery-code");
    expect(params.get("type")).toBe("recovery");
  });

  it("exchanges a recovery code for a session and clears auth params", async () => {
    const session = { user: { id: "user-123" } };
    mockExchangeCodeForSession.mockResolvedValue({ data: { session }, error: null });
    window.history.replaceState(
      null,
      "",
      "/#/reset-password?code=recovery-code&type=recovery",
    );

    await expect(consumeAuthRedirectSession()).resolves.toBe(session);

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith("recovery-code");
    expect(window.location.hash).toBe("#/reset-password");
  });

  it("verifies a recovery token hash for a session and clears auth params", async () => {
    const session = { user: { id: "user-123" } };
    mockVerifyOtp.mockResolvedValue({ data: { session }, error: null });
    window.history.replaceState(
      null,
      "",
      "/#/reset-password?token_hash=recovery-token-hash&type=recovery",
    );

    await expect(consumeAuthRedirectSession()).resolves.toBe(session);

    expect(mockVerifyOtp).toHaveBeenCalledWith({
      token_hash: "recovery-token-hash",
      type: "recovery",
    });
    expect(window.location.hash).toBe("#/reset-password");
  });

  it("sets the session from legacy recovery tokens and clears auth params", async () => {
    const session = { user: { id: "user-123" } };
    mockSetSession.mockResolvedValue({ data: { session }, error: null });
    window.history.replaceState(
      null,
      "",
      "/#/reset-password?access_token=access-token&refresh_token=refresh-token&type=recovery",
    );

    await expect(consumeAuthRedirectSession()).resolves.toBe(session);

    expect(mockSetSession).toHaveBeenCalledWith({
      access_token: "access-token",
      refresh_token: "refresh-token",
    });
    expect(window.location.hash).toBe("#/reset-password");
  });

  it("resends signup confirmation", async () => {
    mockResend.mockResolvedValue({ data: {}, error: null });

    await resendSignupConfirmation("test@example.com");

    expect(mockResend).toHaveBeenCalledWith({
      type: "signup",
      email: "test@example.com",
      options: { emailRedirectTo: expect.any(String) },
    });
  });

  it("updates account password", async () => {
    mockUpdateUser.mockResolvedValue({ data: { user: {} }, error: null });

    await updateAccountPassword("Password123");

    expect(mockUpdateUser).toHaveBeenCalledWith({ password: "Password123" });
  });

  it("signs out", async () => {
    mockSignOut.mockResolvedValue({ error: null });

    await signOut();

    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});
