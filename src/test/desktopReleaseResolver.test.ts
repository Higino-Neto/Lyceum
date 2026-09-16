import { describe, expect, it } from "vitest";
import { desktopUpdateChannel, resolveDesktopRelease } from "../../electron/services/desktop-release-resolver";

describe("desktop release resolution", () => {
  it("skips a newer mobile release and selects the desktop feed", () => {
    const result = resolveDesktopRelease([
      {
        tag_name: "mobile-v2.0.0",
        assets: [{ name: "lyceum-mobile.apk", browser_download_url: "https://example.test/mobile/app.apk" }],
      },
      {
        tag_name: "v1.9.0",
        assets: [
          { name: "latest.yml", browser_download_url: "https://example.test/v1.9.0/latest.yml" },
          { name: "Lyceum-Setup-1.9.0.exe", browser_download_url: "https://example.test/v1.9.0/setup.exe" },
        ],
      },
    ], "win32");

    expect(result?.release.tag_name).toBe("v1.9.0");
    expect(result?.feedUrl).toBe("https://example.test/v1.9.0");
  });

  it("ignores old split-track tags even if they contain desktop metadata", () => {
    expect(resolveDesktopRelease([{
      tag_name: "v2.0.0-win7",
      assets: [
        { name: "latest.yml", browser_download_url: "https://example.test/legacy/latest.yml" },
        { name: "legacy.exe", browser_download_url: "https://example.test/legacy/setup.exe" },
      ],
    }], "win32")).toBeNull();
  });

  it("does not mistake metadata-only or draft releases for installable desktop versions", () => {
    expect(resolveDesktopRelease([
      {
        tag_name: "v2.0.0",
        draft: true,
        assets: [
          { name: "latest.yml", browser_download_url: "https://example.test/latest.yml" },
          { name: "setup.exe", browser_download_url: "https://example.test/setup.exe" },
        ],
      },
      {
        tag_name: "v1.9.1",
        assets: [{ name: "latest.yml", browser_download_url: "https://example.test/only/latest.yml" }],
      },
    ], "win32")).toBeNull();
  });

  it("selects the Linux update feed only when an AppImage is present", () => {
    const result = resolveDesktopRelease([{
      tag_name: "v1.9.0",
      assets: [
        { name: "latest.yml", browser_download_url: "https://example.test/release/latest.yml" },
        { name: "latest-linux.yml", browser_download_url: "https://example.test/release/latest-linux.yml" },
        { name: "Lyceum-Linux-1.9.0-x86_64.AppImage", browser_download_url: "https://example.test/release/app.AppImage" },
      ],
    }], "linux");

    expect(result?.metadata.name).toBe("latest-linux.yml");
    expect(result?.feedUrl).toBe("https://example.test/release");
  });

  it("keeps Windows ARM64 on its own metadata feed", () => {
    const result = resolveDesktopRelease([{
      tag_name: "v1.9.0",
      assets: [
        { name: "latest.yml", browser_download_url: "https://example.test/release/latest.yml" },
        { name: "latest-arm64.yml", browser_download_url: "https://example.test/release/latest-arm64.yml" },
        { name: "Lyceum-1.9.0-Windows-arm64-Setup.exe", browser_download_url: "https://example.test/release/arm64.exe" },
      ],
    }], "win32", "arm64");

    expect(result?.metadata.name).toBe("latest-arm64.yml");
    expect(desktopUpdateChannel("win32", "arm64")).toBe("latest-arm64");
    expect(desktopUpdateChannel("win32", "x64")).toBe("latest");
  });
});
