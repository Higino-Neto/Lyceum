import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ReadingStatsCard, {
  getFrequentRecentBooks,
} from "../pages/DashboardPage/components/ReadingStatsCard";
import { createReadingEntry, getAllBooks } from "../api/database";
import getReadings from "../utils/getReadings";
import type TableReading from "../types/TableReading";

vi.mock("../utils/getReadings", () => ({
  default: vi.fn(),
}));

vi.mock("../api/database", () => ({
  createReadingEntry: vi.fn(),
  getAllBooks: vi.fn(),
}));

vi.mock("../contexts/SelectedUsersContext", () => ({
  useSelectedUsers: () => ({
    selectedUsers: [],
    currentUserId: "user-id",
    toggleUser: vi.fn(),
    isUserSelected: vi.fn(() => false),
  }),
}));

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function toLocalIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return toLocalIsoDate(date);
}

describe("ReadingStatsCard quick readings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(createReadingEntry).mockResolvedValue("reading-id");
    vi.mocked(getAllBooks).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns recent books ordered by recent reading volume", () => {
    const now = new Date(2026, 5, 17, 12);
    const readings: TableReading[] = [
      {
        id: "1",
        source_name: "Book A",
        pages: 20,
        reading_date: "2026-06-17",
        reading_time: 20,
        category_id: "cat-a",
        book_id: "book-a",
      },
      {
        id: "2",
        source_name: "Book B",
        pages: 50,
        reading_date: "2026-06-16",
        reading_time: 30,
        category_id: "cat-b",
        book_id: "book-b",
      },
      {
        id: "3",
        source_name: "Book C",
        pages: 40,
        reading_date: "2026-06-15",
        reading_time: 30,
        category_id: "cat-c",
        book_id: "book-c",
      },
      {
        id: "4",
        source_name: "Book D",
        pages: 30,
        reading_date: "2026-06-14",
        reading_time: 25,
        category_id: "cat-d",
        book_id: "book-d",
      },
      {
        id: "5",
        source_name: "Book A",
        pages: 100,
        reading_date: "2026-05-01",
        reading_time: 80,
        category_id: "cat-a",
        book_id: "book-a",
      },
    ];

    const books = getFrequentRecentBooks(readings, now);

    expect(books.map((book) => book.title)).toEqual(["Book B", "Book C", "Book D", "Book A"]);
    expect(books.find((book) => book.title === "Book A")?.totalPages).toBe(120);
  });

  it("saves a quick reading with the existing category and book id", async () => {
    const today = daysAgo(0);
    vi.mocked(getReadings).mockResolvedValue([
      {
        id: "1",
        source_name: "Book A",
        pages: 20,
        reading_date: today,
        reading_time: 25,
        category_id: "cat-a",
        book_id: "book-a",
      },
    ]);

    render(<ReadingStatsCard />, { wrapper: createWrapper() });

    const pagesInput = await screen.findByLabelText("Paginas de Book A");
    const minutesInput = screen.getByLabelText("Minutos de Book A");

    fireEvent.change(pagesInput, { target: { value: "12" } });
    fireEvent.change(minutesInput, { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: /Enviar/i }));

    await waitFor(() => {
      expect(createReadingEntry).toHaveBeenCalledWith(
        "Book A",
        12,
        today,
        30,
        "cat-a",
        "book-a",
      );
    });
  });

  it("moves focus to the next quick control with Enter or Space", async () => {
    vi.mocked(getReadings).mockResolvedValue([
      {
        id: "1",
        source_name: "Book A",
        pages: 20,
        reading_date: daysAgo(0),
        reading_time: 25,
        category_id: "cat-a",
        book_id: "book-a",
      },
    ]);

    render(<ReadingStatsCard />, { wrapper: createWrapper() });

    const pagesInput = await screen.findByLabelText("Paginas de Book A");
    const minutesInput = screen.getByLabelText("Minutos de Book A");

    pagesInput.focus();
    fireEvent.keyDown(pagesInput, { key: "Enter" });

    await waitFor(() => {
      expect(minutesInput).toHaveFocus();
    });
  });

  it("adds a registered book to the quick reading list", async () => {
    vi.mocked(getReadings).mockResolvedValue([]);
    vi.mocked(getAllBooks).mockResolvedValue([
      {
        id: "book-a",
        title: "Book A",
        author: null,
        thumbnail_url: null,
        total_pages: null,
        isbn: null,
        description: null,
        published_date: null,
        external_id: null,
        category_id: "cat-a",
      },
    ]);

    render(<ReadingStatsCard />, { wrapper: createWrapper() });

    fireEvent.click(await screen.findByLabelText("Adicionar livro cadastrado"));
    fireEvent.change(screen.getByLabelText("Buscar livro cadastrado"), {
      target: { value: "Book" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar Book A a leitura rapida" }));

    expect(await screen.findByText("Book A")).toBeInTheDocument();
  });

  it("removes a book from the quick reading list without deleting readings", async () => {
    vi.mocked(getReadings).mockResolvedValue([
      {
        id: "1",
        source_name: "Book A",
        pages: 20,
        reading_date: daysAgo(0),
        reading_time: 25,
        category_id: "cat-a",
        book_id: "book-a",
      },
    ]);

    render(<ReadingStatsCard />, { wrapper: createWrapper() });

    expect(await screen.findByText("Book A")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Acoes de Book A"));
    fireEvent.click(screen.getByLabelText("Remover Book A da leitura rapida"));

    await waitFor(() => {
      expect(screen.queryByText("Book A")).not.toBeInTheDocument();
    });
  });
});
