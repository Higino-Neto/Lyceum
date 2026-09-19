import { describe, expect, it } from "vitest";
import { findWordBounds, isWordCharacter } from "../../core/pdf-reader-core/words";

describe("isWordCharacter", () => {
  it("keeps letters, apostrophes and hyphens as word characters", () => {
    expect(isWordCharacter("a")).toBe(true);
    expect(isWordCharacter("'")).toBe(true);
    expect(isWordCharacter("-")).toBe(true);
  });

  it("treats whitespace and punctuation as separators", () => {
    expect(isWordCharacter(" ")).toBe(false);
    expect(isWordCharacter("\n")).toBe(false);
    expect(isWordCharacter(".")).toBe(false);
    expect(isWordCharacter(",")).toBe(false);
    expect(isWordCharacter("(")).toBe(false);
    expect(isWordCharacter("")).toBe(false);
    expect(isWordCharacter(undefined)).toBe(false);
  });
});

describe("findWordBounds", () => {
  it("returns the whole word wrapping an index", () => {
    expect(findWordBounds("Olá mundo", 1)).toEqual({ start: 0, end: 3 });
  });

  it("keeps apostrophes and hyphens inside the word", () => {
    expect(findWordBounds("d'água", 1)).toEqual({ start: 0, end: 6 });
    expect(findWordBounds("RNA-Seq", 3)).toEqual({ start: 0, end: 7 });
  });

  it("stops at punctuation", () => {
    expect(findWordBounds("bom dia.", 5)).toEqual({ start: 4, end: 7 });
  });

  it("snaps a separator index to the previous word", () => {
    expect(findWordBounds("bom dia", 3)).toEqual({ start: 0, end: 3 });
  });

  it("returns null for separator-only text", () => {
    expect(findWordBounds("...", 1)).toBeNull();
    expect(findWordBounds("", 0)).toBeNull();
  });
});