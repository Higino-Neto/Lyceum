import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchAllBooks } from "../../api/externalBooks";

describe("externalBooks API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe("searchAllBooks", () => {
    it("should return empty array for short queries", async () => {
      const result = await searchAllBooks("a", []);
      expect(result).toEqual([]);
    });

    it("should search local books", async () => {
      const localBooks = [
        { id: "1", title: "Local Book", author: "Local Author", thumbnail_url: null, total_pages: 100 },
      ];

      const result = await searchAllBooks("Local Book", localBooks);

      expect(result.some(r => r.source === 'local')).toBe(true);
    });

    it("should return empty array for empty query", async () => {
      const result = await searchAllBooks("", []);
      expect(result).toEqual([]);
    });

    it("should sort results by similarity", async () => {
      const localBooks = [
        { id: "1", title: "Exact Match Book", author: "Author", thumbnail_url: null, total_pages: 100 },
        { id: "2", title: "Partial Match", author: "Author", thumbnail_url: null, total_pages: 100 },
      ];

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ docs: [] }),
      });

      const result = await searchAllBooks("Exact Match", localBooks);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].similarity).toBeGreaterThanOrEqual(result[result.length - 1].similarity);
    });

    it("should handle external API errors gracefully", async () => {
      const localBooks = [
        { id: "1", title: "Local Book", author: "Author", thumbnail_url: null, total_pages: 100 },
      ];

      (global.fetch as any).mockRejectedValue(new Error("Network error"));

      const result = await searchAllBooks("Local Book", localBooks);

      expect(result.length).toBeGreaterThan(0);
      expect(result.some(r => r.source === 'local')).toBe(true);
    });

    it("should filter duplicate titles", async () => {
      const localBooks = [
        { id: "1", title: "Same Title", author: "Author 1", thumbnail_url: null, total_pages: 100 },
      ];

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          docs: [
            { key: "/works/OL1W", title: "Same Title", author_name: ["Author 2"] },
          ],
        }),
      });

      const result = await searchAllBooks("Same Title", localBooks);

      const titles = result.map(r => r.data.title);
      const uniqueTitles = new Set(titles);
      expect(titles.length).toBe(uniqueTitles.size);
    });

    it("should limit results to 20", async () => {
      const localBooks = Array.from({ length: 30 }, (_, i) => ({
        id: String(i),
        title: `Book ${i}`,
        author: "Author",
        thumbnail_url: null,
        total_pages: 100,
      }));

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ docs: [] }),
      });

      const result = await searchAllBooks("Book", localBooks);

      expect(result.length).toBeLessThanOrEqual(20);
    });
  });
});
