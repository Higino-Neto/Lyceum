import { describe, it, expect, vi, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import WeeklyStreak from "../pages/DashboardPage/components/WeeklyStreak";

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

vi.mock("../../../utils/getReadings", () => ({
  default: vi.fn().mockResolvedValue([]),
}));

describe("WeeklyStreak", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders weekly streak component without crashing", () => {
    const { container } = renderWithProviders(<WeeklyStreak />);
    expect(container.firstChild).toHaveClass("bg-zinc-900");
  });

  it("renders skeleton in loading state", () => {
    const { container } = renderWithProviders(<WeeklyStreak />);
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });
});