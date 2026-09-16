import { describe, expect, it } from "vitest";
import { PdfBufferCache } from "../../electron/services/pdfCache";

describe("PDF buffer cache", () => {
  it("evicts least-recently-used entries when the byte budget is exceeded", () => {
    const cache = new PdfBufferCache(3, 5);
    cache.set("a", Buffer.alloc(2));
    cache.set("b", Buffer.alloc(2));
    expect(cache.get("a")).toHaveLength(2);
    cache.set("c", Buffer.alloc(2));
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("a")).toHaveLength(2);
    expect(cache.get("c")).toHaveLength(2);
  });

  it("never retains a document larger than the entire cache", () => {
    const cache = new PdfBufferCache(2, 5);
    cache.set("large", Buffer.alloc(6));
    expect(cache.get("large")).toBeUndefined();
  });
});
