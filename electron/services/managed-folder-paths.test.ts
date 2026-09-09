// @vitest-environment node

import path from "node:path";
import { describe, expect, it } from "vitest";
import { isSameOrNestedPath, relocatePathWithinFolder } from "./managed-folder-paths";

describe("managed folder path relocation", () => {
  it("relocates nested collection documents without changing their suffix", () => {
    const source = path.resolve("C:/library/__Science");
    const destination = path.resolve("C:/library/Archive/__Science");
    const document = path.join(source, "Data", "Book.pdf");

    expect(relocatePathWithinFolder(source, destination, document)).toBe(
      path.join(destination, "Data", "Book.pdf"),
    );
  });

  it("does not confuse similarly-prefixed sibling folders", () => {
    const source = path.resolve("C:/library/_Book");
    const siblingDocument = path.resolve("C:/library/_Book Notes/Notes.pdf");

    expect(isSameOrNestedPath(source, siblingDocument)).toBe(false);
    expect(relocatePathWithinFolder(source, "C:/library/Archive/_Book", siblingDocument)).toBeNull();
  });
});
