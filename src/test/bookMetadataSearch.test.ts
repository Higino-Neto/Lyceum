import { afterEach, describe, expect, it, vi } from "vitest";
import {
  candidateToEditableMetadata,
  dedupeMetadataCandidates,
  searchBookMetadata,
  searchBookMetadataSources,
  type BookMetadataCandidate,
} from "../api/bookMetadataSearch";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("book metadata search", () => {
  it("maps Open Library results to editable metadata", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      docs: [{
        key: "/works/OL1W",
        title: "Crime e castigo",
        author_name: ["Fiodor Dostoievski"],
        publisher: ["Editora 34"],
        first_publish_year: 1866,
        language: ["por"],
        isbn: ["9788573265352"],
        subject: ["Ficcao classica"],
        number_of_pages_median: 592,
        cover_i: 123,
      }],
    }))));

    const results = await searchBookMetadata("openlibrary", "Crime e castigo", "title");
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      source: "openlibrary",
      title: "Crime e castigo",
      authors: ["Fiodor Dostoievski"],
      publisher: "Editora 34",
      language: "pt-BR",
      isbn13: "9788573265352",
      pageCount: 592,
      thumbnailUrl: "https://covers.openlibrary.org/b/id/123-L.jpg",
    });

    expect(candidateToEditableMetadata(results[0])).toMatchObject({
      title: "Crime e castigo",
      author: "Fiodor Dostoievski",
      isbn: "9788573265352",
      subject: "Ficcao classica",
      pageCount: 592,
    });
  });

  it("maps Google Books covers to secure image urls", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      items: [{
        id: "google-id",
        volumeInfo: {
          title: "Dom Casmurro",
          subtitle: "Edicao comentada",
          authors: ["Machado de Assis"],
          publisher: "Public Domain",
          publishedDate: "1899",
          language: "pt-BR",
          pageCount: 256,
          categories: ["Fiction"],
          description: "Um romance brasileiro.",
          industryIdentifiers: [{ type: "ISBN_10", identifier: "123456789X" }],
          imageLinks: { thumbnail: "http://books.google.com/books/content?id=1" },
        },
      }],
    }))));

    const results = await searchBookMetadata("google", "Dom Casmurro", "title");
    expect(results[0]).toMatchObject({
      source: "google",
      title: "Dom Casmurro",
      subtitle: "Edicao comentada",
      isbn10: "123456789X",
      thumbnailUrl: "https://books.google.com/books/content?id=1",
    });
  });

  it("maps Library of Congress SRU MODS results", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(`<?xml version="1.0"?>
      <zs:searchRetrieveResponse xmlns:zs="http://www.loc.gov/zing/srw/">
        <zs:records><zs:record><zs:recordData>
          <mods xmlns="http://www.loc.gov/mods/v3">
            <titleInfo><title>Crime e castigo</title></titleInfo>
            <name type="personal"><namePart>Dostoyevsky, Fyodor.</namePart></name>
            <originInfo><agent><namePart>The Russian Messenger</namePart></agent><dateIssued>1866</dateIssued></originInfo>
            <language><languageTerm authority="iso639-2b" type="code">por</languageTerm></language>
            <physicalDescription><extent>592 p. ; 21 cm.</extent></physicalDescription>
            <subject><topic>Fiction</topic></subject>
            <identifier type="isbn">9788573265352</identifier>
            <recordInfo><recordIdentifier>12345</recordIdentifier></recordInfo>
          </mods>
        </zs:recordData></zs:record></zs:records>
      </zs:searchRetrieveResponse>`)));

    const results = await searchBookMetadata("loc", "Crime e castigo", "title");
    expect(results[0]).toMatchObject({
      source: "loc",
      title: "Crime e castigo",
      authors: ["Dostoyevsky, Fyodor."],
      publisher: "The Russian Messenger",
      publishedDate: "1866",
      language: "pt-BR",
      isbn13: "9788573265352",
      pageCount: 592,
      categories: ["Fiction"],
    });
  });

  it("deduplicates candidates by title, author and isbn", () => {
    const base: BookMetadataCandidate = {
      id: "a",
      source: "openlibrary",
      sourceLabel: "Open Library",
      title: "Livro",
      authors: ["Autor"],
      isbn13: "9780000000001",
      categories: [],
    };

    expect(dedupeMetadataCandidates([
      base,
      { ...base, id: "b", source: "google", sourceLabel: "Google Books" },
      { ...base, id: "c", title: "Outro" },
    ])).toHaveLength(2);
  });

  it("keeps working when one source fails in all-source search", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("googleapis")) throw new Error("quota");
      if (url.includes("lx2.loc.gov")) return new Response("<zs:searchRetrieveResponse />");
      return new Response(JSON.stringify({
        docs: [{ key: "/works/OL1W", title: "Livro", author_name: ["Autor"] }],
      }));
    }));

    const response = await searchBookMetadataSources("all", "Livro", "title");
    expect(response.results).toHaveLength(1);
    expect(response.warnings[0]).toContain("Google Books");
  });
});
