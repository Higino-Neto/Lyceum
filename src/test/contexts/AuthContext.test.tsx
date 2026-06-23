import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AuthProvider, useAuth } from "../../contexts/AuthContext";

const { mockConsumeAuthRedirectSession, mockGetSession, mockOnAuthStateChange } = vi.hoisted(
  () => ({
    mockConsumeAuthRedirectSession: vi.fn(),
    mockGetSession: vi.fn(),
    mockOnAuthStateChange: vi.fn(),
  }),
);

vi.mock("../../utils/auth", async () => {
  const actual = await vi.importActual<typeof import("../../utils/auth")>("../../utils/auth");

  return {
    ...actual,
    consumeAuthRedirectSession: mockConsumeAuthRedirectSession,
  };
});

vi.mock("../../lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
      signOut: vi.fn(),
    },
  },
}));

function AuthStateProbe() {
  const { authErrorMessage, isLoading, session } = useAuth();

  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="session">{session ? "session" : "none"}</span>
      <span data-testid="error">{authErrorMessage ?? "no-error"}</span>
    </div>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockOnAuthStateChange.mockReturnValue({
      data: {
        subscription: {
          unsubscribe: vi.fn(),
        },
      },
    });
  });

  it("keeps bootstrap recovery errors when INITIAL_SESSION arrives after bootstrap", async () => {
    let authStateCallback: ((event: string, session: null) => void) | undefined;
    mockConsumeAuthRedirectSession.mockRejectedValue(new Error("bootstrap failed"));
    mockOnAuthStateChange.mockImplementation((callback) => {
      authStateCallback = callback;
      return {
        data: {
          subscription: {
            unsubscribe: vi.fn(),
          },
        },
      };
    });

    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("error")).toHaveTextContent("bootstrap failed");
    });

    await act(async () => {
      authStateCallback?.("INITIAL_SESSION", null);
    });

    expect(screen.getByTestId("error")).toHaveTextContent("bootstrap failed");
    expect(screen.getByTestId("session")).toHaveTextContent("none");
  });
});
