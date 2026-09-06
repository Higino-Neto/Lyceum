import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(".github/workflows/mobile-release.yml", "utf8");

describe("mobile release workflow", () => {
  it("publishes Android APK and OTA assets without an iOS job", () => {
    expect(workflow).toContain("android-and-ota:");
    expect(workflow).toContain("MOBILE_NATIVE_TARGET: android");
    expect(workflow).toContain("lyceum-mobile-latest.json");
    expect(workflow).toContain("release-mobile/android/*.apk");
    expect(workflow).not.toMatch(/^\s{2}ios[^:]*:/m);
    expect(workflow).not.toContain("ios/App");
    expect(workflow).not.toContain(".ipa");
  });
});
