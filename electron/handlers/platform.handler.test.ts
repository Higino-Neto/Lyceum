import { describe, expect, it } from "vitest";
import { clampZoom } from "./platform.handler";

describe("clampZoom", () => {
  it("keeps valid zoom levels and clamps unsafe values", () => {
    expect(clampZoom(1.25)).toBe(1.25);
    expect(clampZoom(0)).toBe(0.3);
    expect(clampZoom(10)).toBe(3);
    expect(clampZoom(Number.NaN)).toBe(1);
  });
});
