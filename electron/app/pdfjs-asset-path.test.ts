import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolvePdfjsAssetPath } from "./pdfjs-asset-path";

const publicRoot = path.resolve("public/pdfjs");
const sourceOverlayRoot = path.resolve("resources/pdfjs-viewer");
const url = (name: string) => `lyceum-pdfjs://viewer/${name}`;

describe("PDF.js asset routing", () => {
  it("serves the live Lyceum overlay in development and the copied overlay in a build", () => {
    const asset = url("lyceum/features/zoom/index.mjs");
    expect(resolvePdfjsAssetPath(asset, publicRoot, sourceOverlayRoot))
      .toBe(path.join(sourceOverlayRoot, "features/zoom/index.mjs"));
    expect(resolvePdfjsAssetPath(asset, publicRoot))
      .toBe(path.join(publicRoot, "lyceum/features/zoom/index.mjs"));
    expect(resolvePdfjsAssetPath(url("web/viewer.mjs"), publicRoot, sourceOverlayRoot))
      .toBe(path.join(publicRoot, "web/viewer.mjs"));
  });

  it("rejects paths that escape either asset root", () => {
    expect(resolvePdfjsAssetPath(url("lyceum/%2e%2e%2f%2e%2e%2fsecrets"), publicRoot, sourceOverlayRoot)).toBeNull();
    expect(resolvePdfjsAssetPath(url("web/%2e%2e%2f%2e%2e%2fsecrets"), publicRoot)).toBeNull();
  });
});
