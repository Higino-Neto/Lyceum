import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  resetThumbnailCacheForTests,
  thumbnailCache,
} from "../pages/Library/components/BookGrid/thumbnailCache";

describe("thumbnailCache", () => {
  beforeEach(() => {
    resetThumbnailCacheForTests();
    vi.restoreAllMocks();
  });

  it("batches thumbnail requests through the renderer IPC API", async () => {
    const getThumbnails = vi.fn().mockResolvedValue({
      "a.webp": "data:image/webp;base64,a",
      "b.webp": "data:image/webp;base64,b",
    });

    Object.defineProperty(window, "api", {
      value: { getThumbnails },
      writable: true,
      configurable: true,
    });

    const subscriber = vi.fn();
    thumbnailCache.subscribe("a.webp", subscriber);
    thumbnailCache.load("a.webp");
    thumbnailCache.load("b.webp");

    await waitFor(() => {
      expect(getThumbnails).toHaveBeenCalledTimes(1);
      expect(getThumbnails).toHaveBeenCalledWith(["a.webp", "b.webp"]);
      expect(subscriber).toHaveBeenCalledWith("data:image/webp;base64,a");
    });
  });
});
