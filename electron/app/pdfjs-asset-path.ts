import path from "node:path";

function isWithin(root: string, file: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(file));
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

export function resolvePdfjsAssetPath(
  requestUrl: string,
  publicRoot: string,
  sourceOverlayRoot?: string,
): string | null {
  try {
    const relativePath = decodeURIComponent(new URL(requestUrl).pathname.replace(/^\/+/, "")) || "viewer.html";
    if (path.isAbsolute(relativePath) ||
        relativePath.split(/[\\/]+/).some(part => part === "." || part === "..")) {
      return null;
    }

    const overlayPrefix = "lyceum/";
    const useSource = Boolean(sourceOverlayRoot) && relativePath.startsWith(overlayPrefix);
    const root = useSource ? sourceOverlayRoot! : publicRoot;
    const file = path.resolve(root, useSource ? relativePath.slice(overlayPrefix.length) : relativePath);
    return isWithin(root, file) ? file : null;
  } catch {
    return null;
  }
}
