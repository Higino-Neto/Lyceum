import { describe, expect, it } from "vitest";
import {
  authorsCompatible,
  findDuplicateGroups,
  normalizeDuplicateTitle,
  normalizeIsbn,
  type DuplicateCandidate,
} from "../features/library/model/duplicates";

function book(fileHash: string, title: string, extra: Partial<DuplicateCandidate> = {}): DuplicateCandidate {
  return { fileHash, title, ...extra };
}

describe("duplicate normalization", () => {
  it("drops extensions, subtitles, bracketed noise, accents and leading articles", () => {
    expect(normalizeDuplicateTitle("O Príncipe: Edição comentada (Retail).epub", "epub")).toBe("principe");
    expect(normalizeDuplicateTitle("The Hobbit [v2]")).toBe("hobbit");
    expect(normalizeDuplicateTitle("Dom Casmurro - Machado de Assis")).toBe("dom casmurro");
  });

  it("normalizes ISBN-10 to ISBN-13", () => {
    expect(normalizeIsbn("0-306-40615-2")).toBe("9780306406157");
    expect(normalizeIsbn("978-0-306-40615-7")).toBe("9780306406157");
    expect(normalizeIsbn("abc")).toBeNull();
  });

  it("treats unknown authors as compatible but requires a shared name otherwise", () => {
    expect(authorsCompatible(null, "J. R. R. Tolkien")).toBe(true);
    expect(authorsCompatible("Tolkien, J.R.R.", "J. R. R. Tolkien")).toBe(true);
    expect(authorsCompatible("Machado de Assis", "José de Alencar")).toBe(false);
  });
});

describe("findDuplicateGroups", () => {
  it("groups by ISBN, exact title and similar title", () => {
    const groups = findDuplicateGroups([
      book("a", "Dom Casmurro.epub", { fileType: "epub", author: "Machado de Assis" }),
      book("b", "Dom Casmurro.pdf", { fileType: "pdf", author: "Assis, Machado de" }),
      book("c", "Livro qualquer", { isbn: "0-306-40615-2" }),
      book("d", "Outro nome", { identifier: "urn:isbn:9780306406157" }),
      book("e", "Memorias Postumas de Bras Cubas", { author: "Machado de Assis" }),
      book("f", "Memórias Póstumas de Brás Cubas!", { author: "Machado de Assis" }),
      book("g", "Memorias Postumas de Bras Cuba", { author: "Machado de Assis" }),
      book("h", "Iracema", { author: "José de Alencar" }),
    ]);

    const byMembers = Object.fromEntries(groups.map((group) => [group.books.map((item) => item.fileHash).sort().join(""), group.reasons]));
    expect(byMembers.ab).toEqual(["sameTitle"]);
    expect(byMembers.cd).toEqual(["isbn"]);
    expect(byMembers.efg).toEqual(["sameTitle", "similarTitle"]);
    expect(groups[0].reasons).toContain("isbn");
    expect(groups.some((group) => group.books.some((item) => item.fileHash === "h"))).toBe(false);
  });

  it("keeps different editions (different ISBNs) and different authors apart", () => {
    const groups = findDuplicateGroups([
      book("a", "Poemas", { author: "Fernando Pessoa", isbn: "9780306406157" }),
      book("b", "Poemas", { author: "Fernando Pessoa", isbn: "9781861972712" }),
      book("c", "Poemas", { author: "Carlos Drummond" }),
    ]);
    expect(groups).toEqual([]);
  });

  it("ignores files already merged as one book and dismissed groups", () => {
    const books = [
      book("a", "Ensaio", { bookId: "book-1" }),
      book("b", "Ensaio", { bookId: "book-1" }),
      book("c", "Tratado"),
      book("d", "Tratado"),
    ];
    expect(findDuplicateGroups(books).map((group) => group.key)).toEqual(["c|d"]);
    expect(findDuplicateGroups(books, { dismissedKeys: ["c|d"] })).toEqual([]);
  });

  it("requires known authors for fuzzy-only matches", () => {
    const groups = findDuplicateGroups([
      book("a", "Fundamentos de Fisica"),
      book("b", "Fundamentos de Fisico"),
    ]);
    expect(groups).toEqual([]);
  });
});
