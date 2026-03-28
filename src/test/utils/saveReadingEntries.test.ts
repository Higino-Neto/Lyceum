import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../lib/supabase", () => ({
  supabase: {
    rpc: vi.fn().mockResolvedValue({ data: "book-id-1", error: null }),
  },
  default: {
    rpc: vi.fn().mockResolvedValue({ data: "book-id-1", error: null }),
  },
}));

vi.mock("../../api/database", () => ({
  createReadingEntry: vi.fn().mockResolvedValue("reading-id"),
  getOrCreateBook: vi.fn().mockResolvedValue("book-id-1"),
}));

import { createReadingEntry, getOrCreateBook } from "../../api/database";
import saveReadingEntries from "../../utils/saveReadingEntries";

describe("saveReadingEntries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window.api as any) = undefined;
  });

  it("should save reading entries successfully", async () => {
    const entries = [
      {
        id: "1",
        bookTitle: "Test Book",
        bookId: null,
        numPages: "50",
        category_id: "cat-1",
        readingTime: "120",
        date: "2024-01-15",
      },
    ];

    await saveReadingEntries(entries);

    expect(getOrCreateBook).toHaveBeenCalledWith(
      "Test Book",
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      "cat-1"
    );
    expect(createReadingEntry).toHaveBeenCalledWith(
      "Test Book",
      50,
      "2024-01-15",
      120,
      "cat-1",
      "book-id-1"
    );
  });

  it("should skip local books with local- prefix", async () => {
    const entries = [
      {
        id: "1",
        bookTitle: "Local Book",
        bookId: "local-hash123",
        numPages: "30",
        category_id: "cat-1",
        readingTime: "60",
        date: "2024-01-15",
      },
    ];

    await saveReadingEntries(entries);

    expect(getOrCreateBook).not.toHaveBeenCalled();
  });

  it("should use existing book ID for external books", async () => {
    const entries = [
      {
        id: "1",
        bookTitle: "External Book",
        bookId: "12345678-1234-1234-1234-123456789012",
        numPages: "100",
        category_id: "cat-1",
        readingTime: "200",
        date: "2024-01-15",
      },
    ];

    await saveReadingEntries(entries);

    expect(getOrCreateBook).not.toHaveBeenCalled();
    expect(createReadingEntry).toHaveBeenCalledWith(
      "External Book",
      100,
      "2024-01-15",
      200,
      "cat-1",
      "12345678-1234-1234-1234-123456789012"
    );
  });

  it("should handle multiple entries for the same book", async () => {
    const entries = [
      {
        id: "1",
        bookTitle: "Same Book",
        bookId: null,
        numPages: "50",
        category_id: "cat-1",
        readingTime: "120",
        date: "2024-01-15",
      },
      {
        id: "2",
        bookTitle: "Same Book",
        bookId: null,
        numPages: "30",
        category_id: "cat-1",
        readingTime: "60",
        date: "2024-01-16",
      },
    ];

    await saveReadingEntries(entries);

    expect(getOrCreateBook).toHaveBeenCalledTimes(1);
    expect(createReadingEntry).toHaveBeenCalledTimes(2);
  });

  it("should throw error when createReadingEntry fails", async () => {
    vi.mocked(createReadingEntry).mockRejectedValue(new Error("Create failed"));

    const entries = [
      {
        id: "1",
        bookTitle: "Test Book",
        bookId: null,
        numPages: "50",
        category_id: "cat-1",
        readingTime: "120",
        date: "2024-01-15",
      },
    ];

    await expect(saveReadingEntries(entries)).rejects.toThrow();
  });

  it("should throw error when getOrCreateBook fails", async () => {
    vi.mocked(getOrCreateBook).mockRejectedValue(new Error("Book creation failed"));

    const entries = [
      {
        id: "1",
        bookTitle: "New Book",
        bookId: null,
        numPages: "50",
        category_id: "cat-1",
        readingTime: "120",
        date: "2024-01-15",
      },
    ];

    await expect(saveReadingEntries(entries)).rejects.toThrow("Book creation failed");
  });
});
