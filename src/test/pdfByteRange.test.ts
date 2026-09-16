import { describe, expect, it } from "vitest";
import { parseByteRange } from "../../electron/services/pdfByteRange";

describe("local PDF byte ranges", () => {
  it("supports bounded, open-ended, and suffix requests", () => {
    expect(parseByteRange("bytes=10-19", 100)).toEqual({ start: 10, end: 19 });
    expect(parseByteRange("bytes=90-", 100)).toEqual({ start: 90, end: 99 });
    expect(parseByteRange("bytes=-10", 100)).toEqual({ start: 90, end: 99 });
    expect(parseByteRange("bytes=90-200", 100)).toEqual({ start: 90, end: 99 });
    expect(parseByteRange(null, 100)).toBeNull();
  });

  it("rejects out-of-bounds and multi-range requests", () => {
    expect(parseByteRange("bytes=100-", 100)).toEqual({ unsatisfiable: true });
    expect(parseByteRange("bytes=20-10", 100)).toEqual({ unsatisfiable: true });
    expect(parseByteRange("bytes=0-10,20-30", 100)).toEqual({ unsatisfiable: true });
  });
});
