import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSignUp, mockSignInWithPassword, mockCreateUserProfile } = vi.hoisted(() => ({
  mockSignUp: vi.fn(),
  mockSignInWithPassword: vi.fn(),
  mockCreateUserProfile: vi.fn(),
}));

vi.mock("../../lib/supabase", () => ({
  supabase: {
    auth: {
      signUp: mockSignUp,
      signInWithPassword: mockSignInWithPassword,
    },
  },
}));

vi.mock("../../api/database", () => ({
  createUserProfile: mockCreateUserProfile,
}));

import { signUp, signIn } from "../../utils/auth";

describe("auth utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("signUp", () => {
    it("calls supabase signUp with correct parameters", async () => {
      mockSignUp.mockResolvedValue({
        data: { user: { id: "user-123" } },
        error: null,
      });

      await signUp("test@example.com", "password123");

      expect(mockSignUp).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "password123",
        options: {
          data: {
            name: "test",
          },
        },
      });
    });

    it("creates user profile after successful signup", async () => {
      mockSignUp.mockResolvedValue({
        data: { user: { id: "user-123" } },
        error: null,
      });
      mockCreateUserProfile.mockResolvedValue(undefined);

      await signUp("test@example.com", "password123");

      expect(mockCreateUserProfile).toHaveBeenCalledWith("user-123", "test@example.com");
    });
  });

  describe("signIn", () => {
    it("calls supabase signInWithPassword with correct parameters", async () => {
      mockSignInWithPassword.mockResolvedValue({
        error: null,
      });

      await signIn("test@example.com", "password123");

      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "password123",
      });
    });

    it("throws error when signin fails", async () => {
      const mockError = { message: "Invalid credentials" };
      mockSignInWithPassword.mockResolvedValue({
        error: mockError,
      });

      await expect(signIn("test@example.com", "wrongpassword")).rejects.toThrow(
        "Invalid credentials"
      );
    });
  });
});
