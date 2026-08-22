import { describe, expect, it } from "vitest";
import { findLatestMobileReleaseAsset, MobileReleaseError } from "../mobile/githubReleaseResolver";

describe("mobile release resolution", () => {
  it("finds the newest mobile asset even when a desktop release is newer", () => {
    const url = findLatestMobileReleaseAsset([
      {
        tag_name: "v9.0.0",
        published_at: "2026-08-20T00:00:00Z",
        assets: [{ name: "Lyceum-Setup.exe", browser_download_url: "https://example.com/desktop" }],
      },
      {
        tag_name: "mobile-v2.0.0",
        published_at: "2026-08-19T00:00:00Z",
        assets: [{ name: "lyceum-mobile-latest.json", browser_download_url: "https://example.com/mobile" }],
      },
    ], "lyceum-mobile-latest.json");

    expect(url).toBe("https://example.com/mobile");
  });

  it("reports a distinct unpublished state instead of a generic fetch failure", () => {
    expect(() => findLatestMobileReleaseAsset([], "lyceum-mobile-latest.json"))
      .toThrowError(expect.objectContaining<Partial<MobileReleaseError>>({ code: "NOT_PUBLISHED" }));
  });

  it("rejects unsafe asset URLs", () => {
    expect(() => findLatestMobileReleaseAsset([{
      tag_name: "mobile-v2.0.0",
      published_at: "2026-08-19T00:00:00Z",
      assets: [{ name: "lyceum-mobile-latest.json", browser_download_url: "http://example.com/mobile" }],
    }], "lyceum-mobile-latest.json")).toThrow("Ainda nao existe");
  });
});
