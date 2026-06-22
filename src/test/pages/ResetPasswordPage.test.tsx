import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import ResetPasswordPage from "../../pages/ResetPasswordPage";

const mockUpdateAccountPassword = vi.fn();
const mockValidatePasswordStrength = vi.fn<[string], string | null>(() => null);
const authState = vi.hoisted(() => ({
  session: { user: { id: "user-123" } } as unknown,
}));

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    isLoading: false,
    session: authState.session,
  }),
}));

vi.mock("../../utils/auth", () => ({
  updateAccountPassword: (password: string) => mockUpdateAccountPassword(password),
  validatePasswordStrength: (password: string) => mockValidatePasswordStrength(password),
  getPasswordRequirements: (password: string) => [
    { id: "length", label: "Pelo menos 8 caracteres", met: password.length >= 8 },
  ],
  MIN_PASSWORD_LENGTH: 8,
}));

vi.mock("react-hot-toast", () => ({
  __esModule: true,
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.session = { user: { id: "user-123" } };
    mockValidatePasswordStrength.mockReturnValue(null);
  });

  it("updates password when recovery session exists", async () => {
    mockUpdateAccountPassword.mockResolvedValue(undefined);
    render(
      <BrowserRouter>
        <ResetPasswordPage />
      </BrowserRouter>,
    );

    fireEvent.change(screen.getByLabelText("Nova senha"), {
      target: { value: "Password123" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar senha"), {
      target: { value: "Password123" },
    });
    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(mockUpdateAccountPassword).toHaveBeenCalledWith("Password123");
    });
  });

  it("shows expired link state without a recovery session", () => {
    authState.session = null;
    render(
      <BrowserRouter>
        <ResetPasswordPage />
      </BrowserRouter>,
    );

    expect(screen.getByText(/link de recuperação está ausente ou expirou/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /solicitar novo link/i })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
  });
});
