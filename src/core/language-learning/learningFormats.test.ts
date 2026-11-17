import { describe, expect, it } from "vitest";
import { isLearningSourceFormat, learningFormatOfPath } from "./learningFormats";

describe("learning formats", () => {
  it("accepts every format with a textual importer", () => {
    for (const format of ["epub", "pdf", "txt", "html", "mobi", "azw3", "fb2", "docx", "lyceum"]) {
      expect(isLearningSourceFormat(format)).toBe(true);
    }
    expect(isLearningSourceFormat("cbz")).toBe(false);
    expect(isLearningSourceFormat("kfx")).toBe(false);
    expect(isLearningSourceFormat(undefined)).toBe(false);
  });

  it("maps file paths by extension", () => {
    expect(learningFormatOfPath("/books/Le Petit Prince.AZW3")).toBe("azw3");
    expect(learningFormatOfPath("/books/a.kepub.epub")).toBe("epub");
    expect(learningFormatOfPath("C:\\books\\page.htm")).toBe("html");
    expect(learningFormatOfPath("/books/pack.lyceum/")).toBe("lyceum");
    expect(learningFormatOfPath("/books/comic.cbz")).toBeNull();
  });
});
