import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ReadingStatsCard, {
  getFrequentRecentBooks,
} from "../pages/DashboardPage/components/ReadingStatsCard";
import { createReadingEntry } from "../api/database";
import getReadings from "../utils/getReadings";
import type TableReading from "../types/TableReading";

vi.mock("../utils/getReadings", () => ({
  default: vi.fn(),
}));

vi.mock("../api/database", () => ({
  createReadingEntry: vi.fn(),
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
    vi.mocked(createReadingEntry).mockResolvedValue("reading-id");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns the three most-read books from the last seven days", () => {
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

    expect(books.map((book) => book.title)).toEqual(["Book B", "Book C", "Book D"]);
    expect(books.find((book) => book.title === "Book A")?.totalPages).toBeUndefined();
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
});
