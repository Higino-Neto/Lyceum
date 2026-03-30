import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import SignIn from "../../pages/SignInPage";

const mockSignIn = vi.fn();

vi.mock("../../utils/auth", () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
}));

vi.mock("react-hot-toast", () => ({
  __esModule: true,
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("SignInPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderSignIn = () => {
    return render(
      <BrowserRouter>
        <SignIn />
      </BrowserRouter>
    );
  };

  it("renders login form heading", () => {
    renderSignIn();
    expect(screen.getByRole("heading", { name: /entrar/i })).toBeInTheDocument();
  });

  it("renders email and password inputs", () => {
    renderSignIn();
    expect(screen.getByPlaceholderText("Email")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Senha")).toBeInTheDocument();
  });

  it("renders submit button", () => {
    renderSignIn();
    const buttons = screen.getAllByRole("button", { name: /entrar/i });
    expect(buttons.length).toBeGreaterThan(0);
  });

  it("renders link to signup page", () => {
    renderSignIn();
    expect(screen.getByText("Criar conta")).toBeInTheDocument();
  });

  it("updates email state on input change", () => {
    renderSignIn();
    const emailInput = screen.getByPlaceholderText("Email");
    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    expect(emailInput).toHaveValue("test@example.com");
  });

  it("updates password state on input change", () => {
    renderSignIn();
    const passwordInput = screen.getByPlaceholderText("Senha");
    fireEvent.change(passwordInput, { target: { value: "password123" } });
    expect(passwordInput).toHaveValue("password123");
  });

  it("calls signIn on form submit", async () => {
    mockSignIn.mockResolvedValue(undefined);
    renderSignIn();

    fireEvent.change(screen.getByPlaceholderText("Email"), { target: { value: "test@example.com" } });
    fireEvent.change(screen.getByPlaceholderText("Senha"), { target: { value: "password123" } });
    const form = document.querySelector("form");
    fireEvent.submit(form!);
  });

  it("has correct styling for form inputs", () => {
    const { container } = renderSignIn();
    const inputs = container.querySelectorAll("input");
    inputs.forEach(input => {
      expect(input).toHaveClass("bg-zinc-800");
      expect(input).toHaveClass("border-zinc-700");
    });
  });
});
