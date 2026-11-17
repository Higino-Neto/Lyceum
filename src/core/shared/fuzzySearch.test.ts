import { describe, expect, it } from "vitest";
import { boundedEditDistance, fuzzyRank, fuzzyScore } from "./fuzzySearch";

const books = [
  { title: "Álgebra Linear", author: "Gilbert Strang" },
  { title: "O Pequeno Príncipe", author: "Antoine de Saint-Exupéry" },
  { title: "Dom Casmurro", author: "Machado de Assis" },
  { title: "Grande Dicionário Português", author: null },
];
const fields = (book: (typeof books)[number]) => [
  { value: book.title, weight: 3 },
  { value: book.author, weight: 2 },
];

describe("fuzzy search", () => {
  it("ignores accents and case", () => {
    expect(fuzzyRank(books, "algebra", fields)[0].item.title).toBe("Álgebra Linear");
  });

  it("requires every token and matches across fields", () => {
    expect(fuzzyRank(books, "casmurro machado", fields).map((r) => r.item.title)).toEqual(["Dom Casmurro"]);
    expect(fuzzyScore("casmurro tolstoi", fields(books[2]))).toBe(0);
  });

  it("tolerates small typos", () => {
    expect(fuzzyRank(books, "pequeno prinicpe", fields)[0].item.title).toBe("O Pequeno Príncipe");
    expect(fuzzyRank(books, "machdo", fields)[0].item.title).toBe("Dom Casmurro");
  });

  it("matches initials and ranks title hits above author hits", () => {
    expect(fuzzyRank(books, "gdp", fields)[0].item.title).toBe("Grande Dicionário Português");
    const ranked = fuzzyRank(
      [{ title: "Notes", author: "Strang" }, { title: "Strang lectures", author: "X" }],
      "strang",
      fields,
    );
    expect(ranked[0].item.title).toBe("Strang lectures");
  });

  it("computes bounded edit distances", () => {
    expect(boundedEditDistance("prinicpe", "principe", 2)).toBe(1);
    expect(boundedEditDistance("abc", "xyz", 1)).toBe(2);
  });
});
