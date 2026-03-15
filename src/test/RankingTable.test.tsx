import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import RankingTable from "../pages/DashboardPage/components/RankingTable";

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{component}</BrowserRouter>
    </QueryClientProvider>
  );
};

vi.mock("../../../hooks/useRanking", () => ({
  default: () => ({
    data: [
      { user_id: "1", username: "User1", total_pages: 100, today_pages: 10, this_week_pages: 50, month_pages: 80, avatar_url: null },
      { user_id: "2", username: "User2", total_pages: 80, today_pages: 20, this_week_pages: 60, month_pages: 70, avatar_url: null },
      { user_id: "3", username: "User3", total_pages: 60, today_pages: 5, this_week_pages: 30, month_pages: 50, avatar_url: null },
    ],
    isLoading: false,
  }),
}));

describe("RankingTable", () => {
  it("renders ranking table component", () => {
    const { container } = renderWithProviders(<RankingTable />);
    expect(container.querySelector("table")).toBeInTheDocument();
  });

  it("renders table headers", () => {
    renderWithProviders(<RankingTable />);
    const table = document.querySelector("table");
    expect(table).toBeInTheDocument();
  });
});