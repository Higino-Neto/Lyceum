import { describe, expect, it } from "vitest";
import {
  contentSecurityPolicy,
  shouldBypassContentSecurityPolicy,
} from "./security-policy";

describe("content security policy", () => {
  it("allows development tooling only in development", () => {
    expect(contentSecurityPolicy(true)).toContain("'unsafe-eval'");
    expect(contentSecurityPolicy(true)).toContain("http://localhost:*");
    expect(contentSecurityPolicy(false)).not.toContain("'unsafe-eval'");
    expect(contentSecurityPolicy(false)).not.toContain("http://localhost:*");
  });

  it("keeps local protocol responses outside the renderer header override", () => {
    expect(shouldBypassContentSecurityPolicy("file:///tmp/book.pdf")).toBe(true);
    expect(shouldBypassContentSecurityPolicy("pdf-resource://book.pdf")).toBe(true);
    expect(shouldBypassContentSecurityPolicy("https://example.com")).toBe(false);
  });
});
