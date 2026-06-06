import { describe, expect, it } from "vitest";
import {
  thumbnailCache,
} from "../pages/Library/components/BookGrid/thumbnailCache";

describe("thumbnailCache", () => {
  it("returns undefined (no-op after thumb:// protocol migration)", () => {
    expect(thumbnailCache.get("any")).toBeUndefined();
    expect(thumbnailCache.get(null)).toBeUndefined();

    thumbnailCache.load("any");
    thumbnailCache.prefetch(["a", "b"]);
    thumbnailCache.clear();
    thumbnailCache.subscribe("x", () => {});

    expect(true).toBe(true);
  });
});
