import { describe, expect, it } from "vitest";
import { parseMobileOtaManifest } from "../mobile/mobileUpdater";

describe("mobile OTA manifest", () => {
  it("accepts a signed HTTPS bundle manifest", () => {
    expect(parseMobileOtaManifest({
      version: "2.1.0",
      url: "https://example.com/lyceum.zip",
      checksum: "b".repeat(64),
    }).version).toBe("2.1.0");
  });

  it("rejects unsigned and insecure bundles", () => {
    expect(() => parseMobileOtaManifest({
      version: "2.1.0",
      url: "http://example.com/lyceum.zip",
      checksum: "b".repeat(64),
    })).toThrow("HTTPS");
    expect(() => parseMobileOtaManifest({
      version: "2.1.0",
      url: "https://example.com/lyceum.zip",
    })).toThrow("checksum");
  });
});
