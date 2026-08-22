import { describe, expect, it } from "vitest";
import { isNewerVersionCode, parseNativeApkManifest } from "../mobile/nativeApkUpdater";

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

  it("validates security-sensitive manifest fields", () => {
    const parsed = parseNativeApkManifest({
      version: "2.0.0",
      versionCode: 20000,
      apkUrl: "https://example.com/lyceum.apk",
      sha256: "a".repeat(64),
      sizeBytes: 25_000_000,
      minSdk: 24,
    });

    expect(parsed.sha256).toBe("a".repeat(64));
    expect(() => parseNativeApkManifest({
      version: "2.0.0",
      versionCode: 20000,
      apkUrl: "https://example.com/lyceum.apk",
      sha256: "not-a-hash",
    })).toThrow("SHA-256");
    expect(() => parseNativeApkManifest({
      version: "2.0.0",
      versionCode: 0,
      apkUrl: "https://example.com/lyceum.apk",
    })).toThrow("versionCode");
    expect(() => parseNativeApkManifest({
      version: "2.0.0",
      versionCode: 20000,
      apkUrl: "https://example.com/lyceum.apk",
      sha256: "a".repeat(64),
    })).toThrow("tamanho");
  });
});
