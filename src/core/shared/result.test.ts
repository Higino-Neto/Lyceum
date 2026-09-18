import { describe, expect, it } from "vitest";
import { failure, success, unwrap } from "./result";

describe("Result", () => {
  it("returns successful values", () => {
    expect(unwrap(success(42))).toBe(42);
  });

  it("preserves a stable error code and cause", () => {
    const cause = new Error("disk unavailable");
    const result = failure("filesystem_unavailable", "Could not save the book", cause);
    expect(result).toEqual({
      ok: false,
      error: { code: "filesystem_unavailable", message: "Could not save the book", cause },
    });
    expect(() => unwrap(result)).toThrow("Could not save the book");
  });
});
