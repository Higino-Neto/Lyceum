import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { suggestSourceFolders } from "./source-folder-suggestions";

let home: string;

function touch(relative: string) {
  const file = path.join(home, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, "");
}

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), "lyceum-suggest-"));
});

afterEach(() => {
  fs.rmSync(home, { recursive: true, force: true });
});

describe("source folder suggestions", () => {
  it("suggests folders that concentrate books and skips noise", async () => {
    for (let index = 0; index < 6; index += 1) touch(`Documents/Old stuff/Ebooks/book-${index}.epub`);
    // Calibre-like layout: one book per folder.
    for (let index = 0; index < 5; index += 1) touch(`Calibre Library/Author ${index}/Title/book.mobi`);
    touch("Downloads/invoice.pdf");
    for (let index = 0; index < 9; index += 1) touch(`project/node_modules/pkg/doc-${index}.epub`);
    for (let index = 0; index < 9; index += 1) touch(`.hidden/book-${index}.epub`);

    const { suggestions } = await suggestSourceFolders({ roots: [home], excludedPaths: [] });
    const paths = suggestions.map((suggestion) => path.relative(home, suggestion.path));
    expect(paths).toEqual([path.join("Documents", "Old stuff", "Ebooks"), "Calibre Library", "Downloads"]);
    expect(suggestions[0].ebookCount).toBe(6);
    expect(suggestions.map((suggestion) => suggestion.recommended)).toEqual([true, true, false]);
  });

  it("lists folders with only a few books and the siblings of a dominant folder", async () => {
    for (let index = 0; index < 20; index += 1) touch(`Documents/Books/book-${index}.epub`);
    touch("Documents/Papers/paper.epub");
    touch("Documents/Papers/notes.pdf");

    const { suggestions } = await suggestSourceFolders({ roots: [home], excludedPaths: [] });
    const paths = suggestions.map((suggestion) => path.relative(home, suggestion.path));
    expect(paths).toEqual([path.join("Documents", "Books"), path.join("Documents", "Papers")]);
    expect(suggestions[1]).toMatchObject({ bookCount: 2, recommended: false });
  });

  it("ignores folders already in the library", async () => {
    for (let index = 0; index < 6; index += 1) touch(`Books/book-${index}.epub`);
    const { suggestions } = await suggestSourceFolders({ roots: [home], excludedPaths: [path.join(home, "Books")] });
    expect(suggestions).toEqual([]);
  });
});
