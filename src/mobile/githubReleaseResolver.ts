const GITHUB_RELEASES_API = "https://api.github.com/repos/Higino-Neto/Lyceum/releases?per_page=50";

const DEFAULT_TIMEOUT_MS = 15_000;

type GitHubReleaseAsset = {
  name?: unknown;
  browser_download_url?: unknown;
};

type GitHubRelease = {
  draft?: unknown;
  tag_name?: unknown;
  published_at?: unknown;
  assets?: unknown;
};

export class MobileReleaseError extends Error {
  constructor(
    message: string,
    readonly code: "OFFLINE" | "TIMEOUT" | "HTTP" | "INVALID_RESPONSE" | "NOT_PUBLISHED",
  ) {
    super(message);
    this.name = "MobileReleaseError";
  }
}

let releasesRequest: Promise<unknown> | null = null;

function isOnline() {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

function releaseTimestamp(release: GitHubRelease) {
  const value = typeof release.published_at === "string" ? Date.parse(release.published_at) : 0;
  return Number.isFinite(value) ? value : 0;
}

export function findLatestMobileReleaseAsset(value: unknown, assetName: string) {
  if (!Array.isArray(value)) {
    throw new MobileReleaseError("O GitHub devolveu uma resposta de releases invalida.", "INVALID_RESPONSE");
  }

  const releases = (value as GitHubRelease[])
    .filter((release) => release && release.draft !== true)
    .filter((release) => typeof release.tag_name === "string" && release.tag_name.startsWith("mobile-v"))
    .sort((left, right) => releaseTimestamp(right) - releaseTimestamp(left));

  for (const release of releases) {
    if (!Array.isArray(release.assets)) continue;
    const asset = (release.assets as GitHubReleaseAsset[]).find((candidate) => candidate?.name === assetName);
    if (typeof asset?.browser_download_url === "string" && asset.browser_download_url.startsWith("https://")) {
      return asset.browser_download_url;
    }
  }

  throw new MobileReleaseError(
    "Ainda nao existe uma versao mobile publicada com os arquivos de atualizacao.",
    "NOT_PUBLISHED",
  );
}

export async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
) {
  if (!isOnline()) {
    throw new MobileReleaseError("Sem conexao com a internet.", "OFFLINE");
  }

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new MobileReleaseError("A verificacao de atualizacoes excedeu o tempo limite.", "TIMEOUT");
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

async function fetchJson(url: string, attempts = 2): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, {
        cache: "no-store",
        headers: { Accept: "application/vnd.github+json" },
      });
      if (!response.ok) {
        throw new MobileReleaseError(`O servidor de atualizacoes devolveu HTTP ${response.status}.`, "HTTP");
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      if (error instanceof MobileReleaseError && ["OFFLINE", "NOT_PUBLISHED", "INVALID_RESPONSE"].includes(error.code)) {
        break;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Falha ao consultar atualizacoes.");
}

export async function resolveLatestMobileReleaseAsset(assetName: string) {
  if (!releasesRequest) {
    releasesRequest = fetchJson(GITHUB_RELEASES_API).finally(() => {
      window.setTimeout(() => { releasesRequest = null; }, 60_000);
    });
  }
  const releases = await releasesRequest;
  return findLatestMobileReleaseAsset(releases, assetName);
}

export async function fetchLatestMobileReleaseJson(assetName: string) {
  const assetUrl = await resolveLatestMobileReleaseAsset(assetName);
  const response = await fetchWithTimeout(`${assetUrl}?t=${Date.now()}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new MobileReleaseError(`O manifesto de atualizacao devolveu HTTP ${response.status}.`, "HTTP");
  }
  return response.json() as Promise<unknown>;
}
