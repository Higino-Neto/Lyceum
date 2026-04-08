import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import Dashboard from "../pages/DashboardPage/DashboardPage";
import { createTestQueryClient } from "./helpers/renderWithProviders";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";

vi.mock("../lib/supabase", () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          user_id: "test-user",
          total_pages: 1000,
          total_minutes: 5000,
          month_pages: 150,
          month_minutes: 600,
        },
        error: null,
      }),
    }),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "test-user", email: "test@test.com" } },
        error: null,
      }),
    },
    rpc: vi.fn().mockResolvedValue({
      data: 5,
      error: null,
    }),
  },
  default: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          user_id: "test-user",
          total_pages: 1000,
          total_minutes: 5000,
          month_pages: 150,
          month_minutes: 600,
        },
        error: null,
      }),
    }),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "test-user", email: "test@test.com" } },
        error: null,
      }),
    },
    rpc: vi.fn().mockResolvedValue({
      data: 5,
      error: null,
    }),
  },
}));

vi.mock("../api/database", () => ({
  getUserReadings: vi.fn().mockResolvedValue([]),
}));

vi.mock("../pages/DashboardPage/components/RankingTable/RankingTable", () => ({
  default: () => <div data-testid="ranking-table">Ranking Table</div>,
}));

vi.mock("../pages/DashboardPage/components/ReadingHeatmap", () => ({
  default: () => <div data-testid="reading-heatmap">Reading Heatmap</div>,
}));

vi.mock("../pages/DashboardPage/components/WeeklyStreak", () => ({
  default: () => <div data-testid="weekly-streak">Weekly Streak</div>,
}));

vi.mock("../pages/DashboardPage/components/ReadingCharts/ReadingCharts", () => ({
  default: () => <div data-testid="reading-charts">Reading Charts</div>,
}));

vi.mock("../pages/DashboardPage/components/ReadingTable/ReadingTable", () => ({
  default: () => <div data-testid="reading-table">Reading Table</div>,
}));

vi.mock("../pages/DashboardPage/components/ReadingStatsCard", () => ({
  default: () => <div data-testid="reading-stats">Reading Stats</div>,
}));

vi.mock("../contexts/SelectedUsersContext", () => ({
  SelectedUsersProvider: ({ children }: { children: React.ReactNode }) => children,
  useSelectedUsers: () => ({
    selectedUsers: [],
    currentUserId: "test-user",
    toggleUser: vi.fn(),
    isUserSelected: () => false,
  }),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
};

const renderWithProviders = (component: React.ReactElement) => {
  return render(component, { wrapper: createWrapper() });
};

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the dashboard page", async () => {
    const { container } = renderWithProviders(<Dashboard />);
    await waitFor(() => {
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  it("renders the register reading button", async () => {
    renderWithProviders(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByText(/Registrar/i)).toBeInTheDocument();
    });
  });

  it("renders ranking table component", async () => {
    renderWithProviders(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByTestId("ranking-table")).toBeInTheDocument();
    });
  });

  it("renders reading heatmap component", async () => {
    renderWithProviders(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByTestId("reading-heatmap")).toBeInTheDocument();
    });
  });

  it("renders weekly streak component", async () => {
    renderWithProviders(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByTestId("weekly-streak")).toBeInTheDocument();
    });
  });

  it("renders reading charts component", async () => {
    renderWithProviders(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByTestId("reading-charts")).toBeInTheDocument();
    });
  });

  it("renders reading table component", async () => {
    renderWithProviders(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByTestId("reading-table")).toBeInTheDocument();
    });
  });

  it("renders the daily readings copy button", async () => {
    renderWithProviders(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByText("Leituras diárias")).toBeInTheDocument();
    });
  });

  it("copies today's readings to clipboard", async () => {
    const today = new Date().toISOString().split("T")[0];
    const mockReadings = [
      { id: "1", source_name: "Book A", pages: 50, reading_date: today, reading_time: 60, category_id: "cat1", book_id: undefined },
      { id: "2", source_name: "Book B", pages: 30, reading_date: today, reading_time: 45, category_id: "cat1", book_id: undefined },
    ];

    const writeText = vi.fn().mockResolvedValueOnce(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      writable: true,
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    queryClient.setQueryData(["readings"], mockReadings);

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Dashboard />
        </BrowserRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Leituras diárias")).toBeInTheDocument();
    });

    const button = screen.getByText("Leituras diárias");
    button.click();

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("Book A: 50\nBook B: 30\n\nTotal: 80");
    });
  });

  it("shows error when no readings today", async () => {
    const { getUserReadings } = await import("../api/database");
    vi.mocked(getUserReadings).mockResolvedValueOnce([]);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Dashboard />
        </BrowserRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Leituras diárias")).toBeInTheDocument();
    });

    const button = screen.getByText("Leituras diárias");
    button.click();
  });
});
