import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import SignUp from "../../pages/SignUpPage";

const mockSignUp = vi.fn();

vi.mock("../../utils/auth", () => ({
  signUp: (...args: unknown[]) => mockSignUp(...args),
  validatePasswordStrength: vi.fn(() => null),
  MIN_PASSWORD_LENGTH: 10,
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
  });

  const renderSignUp = () => {
    return render(
      <BrowserRouter>
        <SignUp />
      </BrowserRouter>
    );
  };

  it("renders signup form heading", () => {
    renderSignUp();
    expect(screen.getByRole("heading", { name: /criar conta/i })).toBeInTheDocument();
  });

  it("renders email, password and confirm password inputs", () => {
    renderSignUp();
    expect(screen.getByPlaceholderText("Email")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Senha")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Confirmar senha")).toBeInTheDocument();
  });

  it("renders submit button", () => {
    renderSignUp();
    const buttons = screen.getAllByRole("button", { name: /criar conta/i });
    expect(buttons.length).toBeGreaterThan(0);
  });

  it("renders link to signin page", () => {
    renderSignUp();
    expect(screen.getByText("Já tem conta?")).toBeInTheDocument();
  });

  it("updates email state on input change", () => {
    renderSignUp();
    const emailInput = screen.getByPlaceholderText("Email");
    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    expect(emailInput).toHaveValue("test@example.com");
  });

  it("updates password state on input change", () => {
    renderSignUp();
    const passwordInput = screen.getByPlaceholderText("Senha");
    fireEvent.change(passwordInput, { target: { value: "password123" } });
    expect(passwordInput).toHaveValue("password123");
  });

  it("updates confirm password state on input change", () => {
    renderSignUp();
    const confirmPasswordInput = screen.getByPlaceholderText("Confirmar senha");
    fireEvent.change(confirmPasswordInput, { target: { value: "password123" } });
    expect(confirmPasswordInput).toHaveValue("password123");
  });

  it("shows error message when passwords don't match", async () => {
    const toast = await import("react-hot-toast");
    renderSignUp();

    fireEvent.change(screen.getByPlaceholderText("Email"), { target: { value: "test@example.com" } });
    fireEvent.change(screen.getByPlaceholderText("Senha"), { target: { value: "password123" } });
    fireEvent.change(screen.getByPlaceholderText("Confirmar senha"), { target: { value: "differentpassword" } });
    
    const form = document.querySelector("form");
    fireEvent.submit(form!);
    
    expect(toast.default.error).toHaveBeenCalledWith("As senhas não coincidem");
  });

  it("has correct styling classes", () => {
    const { container } = renderSignUp();
    const form = container.querySelector("form");
    expect(form).toHaveClass("space-y-4");
  });
});
