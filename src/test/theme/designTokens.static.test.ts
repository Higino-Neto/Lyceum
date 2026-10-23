import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Vitest may expose a non-file import.meta.url. The suite is always launched
// from the repository root by the package scripts.
const rootDir = path.resolve(process.cwd());

describe("design token source invariants", () => {
  it("passes the static regression checker", () => {
    try {
      const output = execFileSync(
        process.execPath,
        ["scripts/check-design-tokens.mjs"],
        {
          cwd: rootDir,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
        },
      );

      expect(output).toContain("[check-design-tokens] OK");
    } catch (error) {
      const failure = error as {
        stdout?: Buffer | string;
        stderr?: Buffer | string;
        message?: string;
      };
      const details = [failure.stdout, failure.stderr, failure.message]
        .filter(Boolean)
        .map((value) => String(value))
        .join("\n");
      throw new Error(`check-design-tokens failed:\n${details}`);
    }
  });
});
