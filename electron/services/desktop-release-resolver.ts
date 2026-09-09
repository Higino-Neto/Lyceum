export interface GithubReleaseAsset {
  name: string;
  browser_download_url: string;
}

export interface GithubRelease {
  draft?: boolean;
  prerelease?: boolean;
  tag_name: string;
  assets?: GithubReleaseAsset[];
}

function desktopMetadataName(platform: NodeJS.Platform) {
  if (platform === "darwin") return "latest-mac.yml";
  if (platform === "linux") return "latest-linux.yml";
  return "latest.yml";
}

function hasDesktopArtifact(release: GithubRelease, platform: NodeJS.Platform) {
  const names = new Set((release.assets || []).map((asset) => asset.name.toLowerCase()));
  if (platform === "darwin") return Array.from(names).some((name) => name.endsWith(".dmg") || name.endsWith(".zip"));
  if (platform === "linux") return Array.from(names).some((name) => name.endsWith(".appimage") || name.endsWith(".deb"));
  return Array.from(names).some((name) => name.endsWith(".exe"));
}

export function resolveDesktopRelease(
  releases: GithubRelease[],
  platform: NodeJS.Platform = process.platform,
) {
  const metadataName = desktopMetadataName(platform);
  for (const release of releases) {
    if (release.draft || release.prerelease) continue;
    const metadata = (release.assets || []).find(
      (asset) => asset.name.toLowerCase() === metadataName && asset.browser_download_url,
    );
    if (!metadata || !hasDesktopArtifact(release, platform)) continue;
    return {
      release,
      metadata,
      feedUrl: metadata.browser_download_url.replace(/\/[^/]+$/, ""),
    };
  }
  return null;
}
