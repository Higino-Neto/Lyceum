import { describe, expect, it } from "vitest";
import { extractCssReferences, sanitizeCss } from "../lib/lyceum/epub/cssSanitizer";

describe("Kindle CSS AST sanitizer", () => {
  it("preserves the useful subset and removes unsafe declarations structurally", () => {
    const result = sanitizeCss(`
      @media screen { p { margin: 1em; display: grid; color: #222; } }
      .hero { background-image: url("cover image.png"); position: fixed; font-weight: bold; }
      @keyframes pulse { from { opacity: 0; } to { opacity: 1; } }
    `, {
      rewriteUrl: (href) => href === "cover image.png" ? "kindle:embed:0001?mime=image" : undefined,
    });

    expect(result.css).toContain("@media screen");
    expect(result.css).toContain("margin: 1em");
    expect(result.css).toContain("color: #222");
    expect(result.css).toContain("kindle:embed:0001?mime=image");
    expect(result.css).toContain("font-weight: bold");
    expect(result.css).not.toContain("display: grid");
    expect(result.css).not.toContain("position: fixed");
    expect(result.css).not.toContain("@keyframes");
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("resolves imports recursively and extracts references from parsed declarations", () => {
    const result = sanitizeCss('@import "base.css"; p { background: url(img.png) no-repeat; }', {
      resolveImport: (href) => href === "base.css" ? "h1 { page-break-before: always; }" : undefined,
      rewriteUrl: () => "kindle:embed:0002?mime=image",
    });

    expect(result.css).toContain("page-break-before: always");
    expect(result.css).toContain("kindle:embed:0002?mime=image");
    expect(extractCssReferences('@import "base.css"; p { background: url("img.png"); }')).toEqual(expect.arrayContaining(["base.css", "img.png"]));
  });
});
