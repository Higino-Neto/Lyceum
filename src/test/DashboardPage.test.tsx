import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Dashboard from "../pages/DashboardPage/DashboardPage";

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

vi.mock("../hooks/useReadingStats", () => ({
  default: () => ({
    data: {
      readingStats: {
        total_pages: 1000,
        total_minutes: 5000,
        month_pages: 150,
        month_minutes: 600,
      },
      userStreak: 5,
    },
    isLoading: false,
  }),
}));

describe("DashboardPage", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the dashboard page title", () => {
    renderWithProviders(<Dashboard />);
    expect(screen.getByText(/Registro de Leituras/i)).toBeInTheDocument();
  });

  it("renders the add reading button", () => {
    renderWithProviders(<Dashboard />);
    expect(screen.getByText(/Registrar Leitura/i)).toBeInTheDocument();
  });

  it("renders stat cards with data", () => {
    renderWithProviders(<Dashboard />);
    const content = document.body.textContent || "";
    expect(content).toContain("Págs");
    expect(content).toContain("este mês");
  });

  it("renders streak days count", () => {
    renderWithProviders(<Dashboard />);
    const content = document.body.textContent || "";
    expect(content).toContain("dias");
  });
});