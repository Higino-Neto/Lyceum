import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(".github/workflows/main.yml", "utf8");

describe("global release workflow", () => {
  it("aggregates Android with desktop instead of publishing a mobile release", () => {
    expect(workflow).toContain("build-android:");
    expect(workflow).toContain("publish-release:");
    expect(workflow).toContain("MOBILE_NATIVE_TARGET: android");
    expect(workflow).toContain("scripts/prepare-mobile-apk-manifest.mjs");
    expect(workflow).toContain("Lyceum-${MOBILE_RELEASE_VERSION}-Android-universal.apk");
    expect(workflow).toContain('tags:\n      - "v*"');
    expect(workflow).not.toContain("mobile-v");
    expect(workflow).not.toContain("--publish always");
    expect(workflow).not.toMatch(/^\s{2}ios[^:]*:/m);
    expect(workflow).not.toContain("ios/App");
    expect(workflow).not.toContain(".ipa");
  });
});
