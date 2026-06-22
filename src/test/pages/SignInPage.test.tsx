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
      </BrowserRouter>,
    );
  };

  it("renders login form heading", () => {
    renderSignIn();
    expect(screen.getByRole("heading", { name: /entrar/i })).toBeInTheDocument();
  });

  it("renders email, password and recovery controls", () => {
    renderSignIn();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /esqueci minha senha/i })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
  });

  it("renders link to signup page", () => {
    renderSignIn();
    expect(screen.getByRole("link", { name: /criar conta/i })).toHaveAttribute("href", "/signup");
  });

  it("updates email and password state on input change", () => {
    renderSignIn();
    const emailInput = screen.getByLabelText("Email");
    const passwordInput = screen.getByLabelText("Senha");

    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "Password123" } });

    expect(emailInput).toHaveValue("test@example.com");
    expect(passwordInput).toHaveValue("Password123");
  });

  it("calls signIn on form submit", async () => {
    mockSignIn.mockResolvedValue(undefined);
    renderSignIn();

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "test@example.com" } });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "Password123" } });
    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith("test@example.com", "Password123");
    });
  });
});
