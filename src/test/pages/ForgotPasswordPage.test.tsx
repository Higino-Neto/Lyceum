import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import ForgotPasswordPage from "../../pages/ForgotPasswordPage";

const mockRequestPasswordReset = vi.fn();

vi.mock("../../utils/auth", () => ({
  requestPasswordReset: (...args: unknown[]) => mockRequestPasswordReset(...args),
}));

vi.mock("react-hot-toast", () => ({
  __esModule: true,
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends password recovery email", async () => {
    mockRequestPasswordReset.mockResolvedValue(undefined);
    render(
      <BrowserRouter>
        <ForgotPasswordPage />
      </BrowserRouter>,
    );

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "test@example.com" },
    });
    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(mockRequestPasswordReset).toHaveBeenCalledWith("test@example.com");
    });
    expect(await screen.findByText(/se uma conta existir/i)).toBeInTheDocument();
  });

  it("links back to signin", () => {
    render(
      <BrowserRouter>
        <ForgotPasswordPage />
      </BrowserRouter>,
    );

    expect(screen.getByRole("link", { name: /voltar para o login/i })).toHaveAttribute(
      "href",
      "/signin",
    );
  });
});
