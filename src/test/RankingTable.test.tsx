import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import RankingTable from "../pages/DashboardPage/components/RankingTable/RankingTable";
import { createTestQueryClient } from "./helpers/renderWithProviders";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { SelectedUsersProvider } from "../contexts/SelectedUsersContext";

const mockRankingData = [
  {
    user_id: "user-1",
    username: "Alice",
    total_pages: 150,
    today_pages: 15,
    this_week_pages: 80,
    month_pages: 120,
    avatar_url: null,
  },
  {
    user_id: "user-2",
    username: "Bob",
    total_pages: 100,
    today_pages: 10,
    this_week_pages: 50,
    month_pages: 90,
    avatar_url: null,
  },
  {
    user_id: "user-3",
    username: "Charlie",
    total_pages: 80,
    today_pages: 5,
    this_week_pages: 30,
    month_pages: 60,
    avatar_url: null,
  },
];

vi.mock("../lib/supabase", () => ({
  supabase: {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "reading_stats") {
        return {
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: mockRankingData,
            error: null,
          }),
          eq: vi.fn().mockReturnThis(),
        };
      }
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: mockRankingData.map((u) => ({ id: u.user_id, name: u.username })),
            error: null,
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      };
    }),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "test-user", email: "test@test.com" } },
        error: null,
      }),
    },
  },
  default: {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "reading_stats") {
        return {
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: mockRankingData,
            error: null,
          }),
          eq: vi.fn().mockReturnThis(),
        };
      }
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: mockRankingData.map((u) => ({ id: u.user_id, name: u.username })),
            error: null,
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      };
    }),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "test-user", email: "test@test.com" } },
        error: null,
      }),
    },
  },
}));

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <SelectedUsersProvider>
        <BrowserRouter>{component}</BrowserRouter>
      </SelectedUsersProvider>
    </QueryClientProvider>
  );
};

describe("RankingTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders ranking table component", () => {
    const { container } = renderWithProviders(<RankingTable />);
    expect(container.querySelector("table")).toBeInTheDocument();
  });

  it("renders table headers", () => {
    renderWithProviders(<RankingTable />);
    const table = document.querySelector("table");
    expect(table).toBeInTheDocument();
  });

  it("renders period selector buttons", async () => {
    renderWithProviders(<RankingTable />);
    await waitFor(() => {
      expect(screen.getByText("Hoje")).toBeInTheDocument();
      expect(screen.getByText("Semanal")).toBeInTheDocument();
      expect(screen.getByText("Mensal")).toBeInTheDocument();
    });
  });

  it("displays usernames in the ranking", async () => {
    renderWithProviders(<RankingTable />);
    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
      expect(screen.getByText("Charlie")).toBeInTheDocument();
    });
  });

  it("displays page counts for users", async () => {
    renderWithProviders(<RankingTable />);
    await waitFor(() => {
      const pageElements = screen.getAllByText(/p$/);
      expect(pageElements.length).toBeGreaterThan(0);
    });
  });

  it("renders crown icon for first place", async () => {
    renderWithProviders(<RankingTable />);
    await waitFor(() => {
      const crownIcon = document.querySelector("svg");
      expect(crownIcon).toBeInTheDocument();
    });
  });
});
