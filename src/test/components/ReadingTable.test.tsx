import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "../helpers/renderWithProviders";
import ReadingTable from "../../pages/DashboardPage/components/ReadingTable/ReadingTable";

const mockDelete = vi.fn();
const mockInvalidate = vi.fn();
const mockGetCategories = vi.fn().mockResolvedValue([]);

vi.mock("../../hooks/useGetReadings", () => ({
  __esModule: true,
  default: () => ({
    data: [
      {
        id: "1",
        source_name: "Test Book",
        pages: 50,
        reading_date: "2024-01-15",
        reading_time: 120,
        category_id: "cat-1",
      },
      {
        id: "2",
        source_name: "Another Book",
        pages: 30,
        reading_date: "2024-01-16",
        reading_time: 60,
        category_id: "cat-2",
      },
    ],
    isLoading: false,
  }),
}));

vi.mock("../../api/database", () => ({
  deleteReadingEntry: vi.fn(() => Promise.resolve()),
  getCategories: vi.fn(() => Promise.resolve([])),
  updateReadingEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: mockInvalidate,
    }),
    useMutation: () => ({
      mutate: mockDelete,
      isPending: false,
    }),
  };
});

vi.mock("react-hot-toast", () => ({
  __esModule: true,
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("ReadingTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders table with readings", () => {
    renderWithProviders(<ReadingTable />);
    expect(screen.getByText("Test Book")).toBeInTheDocument();
    expect(screen.getByText("Another Book")).toBeInTheDocument();
  });

  it("renders table headers", () => {
    renderWithProviders(<ReadingTable />);
    expect(screen.getByText("Obra")).toBeInTheDocument();
    expect(screen.getByText("Págs")).toBeInTheDocument();
    expect(screen.getByText("Tempo")).toBeInTheDocument();
    expect(screen.getByText("Data")).toBeInTheDocument();
  });

  it("renders edit and delete buttons for each row", () => {
    renderWithProviders(<ReadingTable />);
    const editButtons = document.querySelectorAll("button[title='Editar leitura']");
    const deleteButtons = document.querySelectorAll("button[title='Remover leitura']");
    expect(editButtons.length).toBe(2);
    expect(deleteButtons.length).toBe(2);
  });

  it("displays correct page counts", () => {
    renderWithProviders(<ReadingTable />);
    expect(screen.getByText("50")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
  });

  it("displays correct reading times", () => {
    renderWithProviders(<ReadingTable />);
    expect(screen.getByText("120 min")).toBeInTheDocument();
    expect(screen.getByText("60 min")).toBeInTheDocument();
  });

  it("formats date correctly", () => {
    renderWithProviders(<ReadingTable />);
    expect(screen.getByText("15/01/2024")).toBeInTheDocument();
    expect(screen.getByText("16/01/2024")).toBeInTheDocument();
  });

  it("opens delete confirmation dialog when delete button is clicked", () => {
    renderWithProviders(<ReadingTable />);
    const deleteButtons = document.querySelectorAll("button[title='Remover leitura']");
    fireEvent.click(deleteButtons[0]);
    expect(screen.getByText("Excluir Leitura")).toBeInTheDocument();
  });

  it("opens edit dialog when edit button is clicked", () => {
    renderWithProviders(<ReadingTable />);
    const editButtons = document.querySelectorAll("button[title='Editar leitura']");
    fireEvent.click(editButtons[0]);
    expect(screen.getByText("Editar Leitura")).toBeInTheDocument();
  });

  it("shows confirm button in delete dialog", () => {
    renderWithProviders(<ReadingTable />);
    const deleteButtons = document.querySelectorAll("button[title='Remover leitura']");
    fireEvent.click(deleteButtons[0]);
    expect(screen.getByText("Excluir")).toBeInTheDocument();
  });

  it("shows cancel button in delete dialog", () => {
    renderWithProviders(<ReadingTable />);
    const deleteButtons = document.querySelectorAll("button[title='Remover leitura']");
    fireEvent.click(deleteButtons[0]);
    expect(screen.getByText("Cancelar")).toBeInTheDocument();
  });
});
