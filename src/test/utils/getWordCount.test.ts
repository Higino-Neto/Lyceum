import { describe, it, expect, vi } from "vitest";
import getWordCount from "../../utils/getWordCount";

describe("getWordCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return undefined when registry is null", async () => {
    const result = await getWordCount(null as any, 1, 10);
    expect(result).toBeUndefined();
  });

  it("should return undefined when engine is not available", async () => {
    const mockRegistry = {
      getEngine: vi.fn().mockReturnValue(null),
      getPlugin: vi.fn(),
    };

    const result = await getWordCount(mockRegistry as any, 1, 10);
    expect(result).toBeUndefined();
  });

  it("should return 0 when document is not available", async () => {
    const mockRegistry = {
      getEngine: vi.fn().mockReturnValue({
        extractText: vi.fn().mockReturnValue({
          toPromise: vi.fn().mockResolvedValue(""),
        }),
      }),
      getPlugin: vi.fn().mockReturnValue({
        provides: vi.fn().mockReturnValue(null),
      }),
    };

    const result = await getWordCount(mockRegistry as any, 1, 10);
    expect(result).toBe(0);
  });

  it("should return correct word count", async () => {
    const mockRegistry = {
      getEngine: vi.fn().mockReturnValue({
        extractText: vi.fn().mockReturnValue({
          toPromise: vi.fn().mockResolvedValue("Hello world this is a test"),
        }),
      }),
      getPlugin: vi.fn().mockReturnValue({
        provides: vi.fn().mockReturnValue({
          getActiveDocument: vi.fn().mockReturnValue({}),
        }),
      }),
    };

    const result = await getWordCount(mockRegistry as any, 1, 10);
    expect(result).toBe(6);
  });

  it("should handle empty text", async () => {
    const mockRegistry = {
      getEngine: vi.fn().mockReturnValue({
        extractText: vi.fn().mockReturnValue({
          toPromise: vi.fn().mockResolvedValue(""),
        }),
      }),
      getPlugin: vi.fn().mockReturnValue({
        provides: vi.fn().mockReturnValue({
          getActiveDocument: vi.fn().mockReturnValue({}),
        }),
      }),
    };

    const result = await getWordCount(mockRegistry as any, 1, 10);
    expect(result).toBe(0);
  });

  it("should handle text with extra whitespace", async () => {
    const mockRegistry = {
      getEngine: vi.fn().mockReturnValue({
        extractText: vi.fn().mockReturnValue({
          toPromise: vi.fn().mockResolvedValue("  Hello   world  "),
        }),
      }),
      getPlugin: vi.fn().mockReturnValue({
        provides: vi.fn().mockReturnValue({
          getActiveDocument: vi.fn().mockReturnValue({}),
        }),
      }),
    };

    const result = await getWordCount(mockRegistry as any, 1, 10);
    expect(result).toBe(2);
  });
});
