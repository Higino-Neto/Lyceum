import { describe, it, expect } from "vitest";
import { normalizeText, tokenize, calculateSimilarity, LOCAL_BOOK_PREFIX } from "../pages/Library/utils";

describe("Library Utils", () => {
  describe("normalizeText", () => {
    it("should convert to lowercase", () => {
      expect(normalizeText("HELLO")).toBe("hello");
    });

    it("should remove diacritics", () => {
      expect(normalizeText("café")).toBe("cafe");
      expect(normalizeText("ação")).toBe("acao");
    });

    it("should replace hyphens and underscores with spaces", () => {
      expect(normalizeText("hello-world")).toBe("hello world");
      expect(normalizeText("hello_world")).toBe("hello world");
    });

    it("should trim whitespace", () => {
      expect(normalizeText("  hello  ")).toBe("hello");
    });
  });

  describe("tokenize", () => {
    it("should split by spaces", () => {
      expect(tokenize("hello world")).toEqual(["hello", "world"]);
    });

    it("should filter out empty tokens", () => {
      expect(tokenize("hello   world")).toEqual(["hello", "world"]);
    });

    it("should not filter out single characters", () => {
      expect(tokenize("a hello b")).toEqual(["a", "hello", "b"]);
    });
  });

  describe("calculateSimilarity", () => {
    it("should return perfect match for exact title", () => {
      const result = calculateSimilarity("Hello World", null, "Hello World");
      expect(result.score).toBe(1);
      expect(result.matches).toBe(true);
    });

    it("should return high score for title starting with query", () => {
      const result = calculateSimilarity("Hello World Book", null, "Hello");
      expect(result.score).toBe(1);
      expect(result.matches).toBe(true);
    });

    it("should return match when score exceeds threshold", () => {
      const result = calculateSimilarity("The Great Book", null, "great");
      expect(result.score).toBeGreaterThan(0.2);
      expect(result.matches).toBe(true);
    });

    it("should not match when score is below threshold", () => {
      const result = calculateSimilarity("ABC", null, "XYZ completely different");
      expect(result.score).toBeLessThanOrEqual(0.2);
      expect(result.matches).toBe(false);
    });

    it("should consider author in matching", () => {
      const result = calculateSimilarity("Unknown Title", "John Doe", "John");
      expect(result.score).toBeGreaterThan(0);
    });

    it("should handle empty query", () => {
      const result = calculateSimilarity("Some Title", null, "");
      expect(result.score).toBe(0);
      expect(result.matches).toBe(false);
    });

    it("should handle very short queries", () => {
      const result = calculateSimilarity("Some Title", null, "a");
      expect(result.score).toBe(0);
      expect(result.matches).toBe(false);
    });

    it("should accept custom threshold", () => {
      const result = calculateSimilarity("Hello", null, "He", 0.5);
      expect(result.score).toBe(1);
      expect(result.matches).toBe(true);
    });
  });

  describe("LOCAL_BOOK_PREFIX", () => {
    it("should be 'local-'", () => {
      expect(LOCAL_BOOK_PREFIX).toBe("local-");
    });
  });
});
