import { describe, it, expect } from "vitest";
import { FolderInfo } from "../types/LibraryTypes";
import {
  normalizeText,
  tokenize,
  calculateSimilarity,
  classifyFolder,
  classifyFolders,
  LOCAL_BOOK_PREFIX,
  findFolderTrail,
  folderPathsEqual,
  getFolderBookCount,
  getFolderBreadcrumbs,
  getFolderChildren,
  getParentFolderPath,
  normalizeFolderPath,
} from "../pages/Library/utils";

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

  describe("folder classification", () => {
    it("classifies normal, merged, and collection folders by prefix", () => {
      expect(classifyFolder("Fiction")).toBe("normal");
      expect(classifyFolder("_Dune")).toBe("merged");
      expect(classifyFolder("__Sci-Fi")).toBe("collection");
    });

    it("groups folders by classification", () => {
      const grouped = classifyFolders([
        {
          name: "Fiction",
          path: "Fiction",
          fullPath: "C:\\library\\Fiction",
          bookCount: 1,
          subfolders: [],
        },
        {
          name: "_Dune",
          path: "_Dune",
          fullPath: "C:\\library\\_Dune",
          bookCount: 2,
          subfolders: [],
        },
        {
          name: "__Sci-Fi",
          path: "__Sci-Fi",
          fullPath: "C:\\library\\__Sci-Fi",
          bookCount: 3,
          subfolders: [],
        },
      ]);

      expect(grouped.normal.map((folder) => folder.name)).toEqual(["Fiction"]);
      expect(grouped.merged.map((folder) => folder.name)).toEqual(["_Dune"]);
      expect(grouped.collection.map((folder) => folder.name)).toEqual(["__Sci-Fi"]);
    });
  });

  describe("folder tree helpers", () => {
    const folders: FolderInfo[] = [
      {
        name: "Computer Science",
        path: "Computer Science",
        fullPath: "C:\\library\\Computer Science",
        bookCount: 6,
        subfolders: [
          {
            name: "Data Structures",
            path: "Computer Science\\Data Structures",
            fullPath: "C:\\library\\Computer Science\\Data Structures",
            bookCount: 3,
            subfolders: [],
          },
          {
            name: "Machine Learning",
            path: "Computer Science\\Machine Learning",
            fullPath: "C:\\library\\Computer Science\\Machine Learning",
            bookCount: 2,
            subfolders: [
              {
                name: "Deep Learning",
                path: "Computer Science\\Machine Learning\\Deep Learning",
                fullPath:
                  "C:\\library\\Computer Science\\Machine Learning\\Deep Learning",
                bookCount: 1,
                subfolders: [],
              },
            ],
          },
        ],
      },
      {
        name: "Math",
        path: "Math",
        fullPath: "C:\\library\\Math",
        bookCount: 0,
        subfolders: [],
      },
    ];

    it("normalizes Windows and URL-like separators", () => {
      expect(normalizeFolderPath("\\Computer Science\\Machine Learning\\")).toBe(
        "Computer Science/Machine Learning",
      );
      expect(
        folderPathsEqual(
          "Computer Science\\Machine Learning",
          "Computer Science/Machine Learning",
        ),
      ).toBe(true);
    });

    it("finds the folder trail for nested folders", () => {
      expect(
        findFolderTrail(
          folders,
          "Computer Science/Machine Learning/Deep Learning",
        ).map((folder) => folder.name),
      ).toEqual(["Computer Science", "Machine Learning", "Deep Learning"]);
    });

    it("returns the visible children for the current folder", () => {
      expect(getFolderChildren(folders, null).map((folder) => folder.name)).toEqual([
        "Computer Science",
        "Math",
      ]);
      expect(
        getFolderChildren(folders, "Computer Science").map((folder) => folder.name),
      ).toEqual(["Data Structures", "Machine Learning"]);
    });

    it("builds breadcrumbs using real folder paths when available", () => {
      expect(
        getFolderBreadcrumbs(
          folders,
          "Computer Science/Machine Learning",
        ),
      ).toEqual([
        { label: "Raiz", path: null },
        { label: "Computer Science", path: "Computer Science" },
        {
          label: "Machine Learning",
          path: "Computer Science\\Machine Learning",
        },
      ]);
    });

    it("returns parent paths for known and fallback folders", () => {
      expect(
        getParentFolderPath(
          folders,
          "Computer Science/Machine Learning/Deep Learning",
        ),
      ).toBe("Computer Science\\Machine Learning");
      expect(getParentFolderPath(folders, "Imported/Unknown")).toBe("Imported");
      expect(getParentFolderPath(folders, "Math")).toBeNull();
    });

    it("formats folder book counts defensively", () => {
      expect(getFolderBookCount(folders[0])).toBe(6);
      expect(getFolderBookCount({ ...folders[0], bookCount: -2 })).toBe(0);
    });
  });
});
