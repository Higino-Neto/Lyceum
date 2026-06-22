import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockCreateUserProfile,
  mockResend,
  mockResetPasswordForEmail,
  mockSignInWithPassword,
  mockSignOut,
  mockSignUp,
  mockUpdateUser,
} = vi.hoisted(() => ({
  mockCreateUserProfile: vi.fn(),
  mockResend: vi.fn(),
  mockResetPasswordForEmail: vi.fn(),
  mockSignInWithPassword: vi.fn(),
  mockSignOut: vi.fn(),
  mockSignUp: vi.fn(),
  mockUpdateUser: vi.fn(),
}));

vi.mock("../../lib/supabase", () => ({
  supabase: {
    auth: {
      resend: mockResend,
      resetPasswordForEmail: mockResetPasswordForEmail,
      signInWithPassword: mockSignInWithPassword,
      signOut: mockSignOut,
      signUp: mockSignUp,
      updateUser: mockUpdateUser,
    },
  },
}));

vi.mock("../../api/database", () => ({
  createUserProfile: mockCreateUserProfile,
}));

import {
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
