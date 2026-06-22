import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import SignUp from "../../pages/SignUpPage";

const mockSignUp = vi.fn();
const mockResendSignupConfirmation = vi.fn();
const mockValidatePasswordStrength = vi.fn<[string], string | null>(() => null);

vi.mock("../../utils/auth", () => ({
  signUp: (email: string, password: string, name?: string) => mockSignUp(email, password, name),
  resendSignupConfirmation: (email: string) => mockResendSignupConfirmation(email),
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

describe("SignUpPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidatePasswordStrength.mockReturnValue(null);
  });

  const renderSignUp = () => {
    return render(
      <BrowserRouter>
        <SignUp />
      </BrowserRouter>,
    );
  };

  it("renders signup form heading", () => {
    renderSignUp();
    expect(screen.getByRole("heading", { name: /criar conta/i })).toBeInTheDocument();
  });

  it("renders name, email, password and confirm password inputs", () => {
    renderSignUp();
    expect(screen.getByLabelText("Nome")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirmar senha")).toBeInTheDocument();
  });

  it("renders link to signin page", () => {
    renderSignUp();
    expect(screen.getByRole("link", { name: /entrar/i })).toHaveAttribute("href", "/signin");
  });

  it("shows error message when passwords do not match", async () => {
    const toast = await import("react-hot-toast");
    renderSignUp();

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "test@example.com" } });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "Password123" } });
    fireEvent.change(screen.getByLabelText("Confirmar senha"), { target: { value: "Different123" } });
    fireEvent.submit(document.querySelector("form")!);

    expect(toast.default.error).toHaveBeenCalledWith("As senhas não coincidem");
  });

  it("calls signUp with name, email and password", async () => {
    mockSignUp.mockResolvedValue({ error: null, needsEmailConfirmation: false });
    renderSignUp();

    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Ada" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "Password123" } });
    fireEvent.change(screen.getByLabelText("Confirmar senha"), { target: { value: "Password123" } });
    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith("ada@example.com", "Password123", "Ada");
    });
  });

  it("shows confirmation state when email confirmation is required", async () => {
    mockSignUp.mockResolvedValue({ error: null, needsEmailConfirmation: true });
    renderSignUp();

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "Password123" } });
    fireEvent.change(screen.getByLabelText("Confirmar senha"), { target: { value: "Password123" } });
    fireEvent.submit(document.querySelector("form")!);

    expect(await screen.findByRole("heading", { name: /confirme seu email/i })).toBeInTheDocument();
    expect(screen.getByText(/ada@example.com/i)).toBeInTheDocument();
  });
});
