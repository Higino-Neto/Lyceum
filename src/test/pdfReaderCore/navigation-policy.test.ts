import { describe, expect, it } from "vitest";
import { createNavigationGuard } from "../../core/pdf-reader-core/navigation-policy";

describe("createNavigationGuard", () => {
  it("defers a restore when the document is not ready yet", () => {
    const guard = createNavigationGuard();
    expect(guard.decide("restore", false)).toEqual({ kind: "defer" });
    expect(guard.decide("restore", true)).toEqual({ kind: "apply" });
  });

  it("gives a real navigation priority over a queued restore", () => {
    const guard = createNavigationGuard();
    guard.wait({ page: 1 }, "restore");
    guard.wait({ page: 3 }, "navigate");
    expect(guard.consumePending()).toEqual({ state: { page: 3 }, mode: "navigate" });
    expect(guard.consumePending()).toBeNull();
  });

  it("skips a restore after the reader navigated on its own", () => {
    const guard = createNavigationGuard();
    expect(guard.decide("navigate", true)).toEqual({ kind: "apply" });
    expect(guard.decide("restore", true)).toEqual({ kind: "skip" });
    expect(guard.userNavigated).toBe(true);
  });
});