import { describe, expect, it } from "vitest";
import { isNewerVersionCode } from "../mobile/nativeApkUpdater";

describe("native APK updater", () => {
  it("detects newer APK version codes", () => {
    expect(isNewerVersionCode(10813, 10812)).toBe(true);
    expect(isNewerVersionCode(10812, 10812)).toBe(false);
    expect(isNewerVersionCode(10811, 10812)).toBe(false);
  });

  it("rejects invalid version codes", () => {
    expect(isNewerVersionCode(Number.NaN, 10812)).toBe(false);
    expect(isNewerVersionCode(10813, Number.NaN)).toBe(false);
  });
});
