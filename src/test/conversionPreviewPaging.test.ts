import { describe, expect, it } from "vitest";
import { computeGlobalPage, estimateGlobalPage, estimateOutputBytes, estimateTotalPages, sampleSegments } from "../pages/Conversion/components/previewPaging";

describe("conversion preview paging", () => {
  it("numbers pages across chapters once earlier chapters are known", () => {
    const counts = new Map([[1, 3], [2, 5]]);
    expect(computeGlobalPage({ segment: 2, page: 2 }, counts)).toBe(5);
    expect(computeGlobalPage({ segment: 3, page: 1 }, counts)).toBe(9);
    expect(computeGlobalPage({ segment: 4, page: 1 }, counts)).toBeNull();
  });

  it("estimates the total until every chapter is measured", () => {
    expect(estimateTotalPages(new Map([[1, 4], [2, 6]]), 4)).toEqual({ total: 20, exact: false });
    expect(estimateTotalPages(new Map([[1, 4], [2, 6]]), 2)).toEqual({ total: 10, exact: true });
  });

  it("estimates the final page number when earlier chapters are unknown", () => {
    expect(estimateGlobalPage({ segment: 2, page: 2 }, new Map([[1, 3]]))).toEqual({ page: 5, exact: true });
    // Chapter 2 unknown: assumed to be as long as the average measured chapter (4 pages).
    expect(estimateGlobalPage({ segment: 3, page: 1 }, new Map([[1, 4], [3, 4]]))).toEqual({ page: 9, exact: false });
  });

  it("samples segments evenly across the book", () => {
    expect(sampleSegments(3, 6)).toEqual([1, 2, 3]);
    expect(sampleSegments(100, 5)).toEqual([1, 26, 51, 75, 100]);
    expect(sampleSegments(0, 5)).toEqual([]);
  });

  it("estimates the output size from sampled segments", () => {
    expect(estimateOutputBytes(new Map(), 10, "page")).toBeNull();
    expect(estimateOutputBytes(new Map([[1, 100], [2, 300]]), 10, "page")).toEqual({ bytes: 2000, exact: false });
    // Chapter slices repeat the overhead: 60% of the smallest slice is counted once.
    const chapters = estimateOutputBytes(new Map([[1, 1000], [2, 2000]]), 2, "chapter");
    expect(chapters).toEqual({ bytes: 2400, exact: true });
  });
});
