import { describe, expect, it } from "vitest";
import { computeGlobalPage, estimateTotalPages } from "../pages/Conversion/components/previewPaging";

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
});
