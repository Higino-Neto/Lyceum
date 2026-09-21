import { describe, expect, it } from "vitest";
import { androidVersionCode, assertStableVersion, expectedArtifacts } from "../../scripts/release/release-config.mjs";

describe("global release contract", () => {
  it("derives a monotonic Android code from stable SemVer", () => {
    expect(androidVersionCode("1.8.28")).toBe(1_008_028);
    expect(androidVersionCode("1.9.0")).toBeGreaterThan(androidVersionCode("1.8.999"));
    expect(() => assertStableVersion("1.9.0-beta.1")).toThrow("stable SemVer");
  });

  it("requires every official platform in the same artifact set", () => {
    const artifacts = expectedArtifacts("1.9.0");
    expect(artifacts).toContain("Lyceum-1.9.0-Windows-Legacy-x64-Setup.exe");
    expect(artifacts).toContain("Lyceum-1.9.0-Linux-x86_64.rpm");
    expect(artifacts).toContain("Lyceum-1.9.0-macOS-universal.dmg");
    expect(artifacts).toContain("Lyceum-1.9.0-Android-universal.apk");
    expect(artifacts).toContain("latest.yml");
    expect(artifacts).toContain("latest-arm64.yml");
    expect(artifacts).toContain("latest-linux.yml");
    expect(artifacts).toContain("latest-mac.yml");
  });
});
