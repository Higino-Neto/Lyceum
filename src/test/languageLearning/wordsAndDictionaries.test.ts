// @vitest-environment node
import { describe, expect, it } from "vitest";
import { analyzeDocument, computeFormStates, getLanguageModule, type KnowledgeSnapshot } from "../../core/language-learning";
import { buildWordRows, sortWordRows } from "../../pages/ReadingPage/components/lyceum-reader/wordRows";
import { buildChapterSegments, renderBlocksHtml, renderChapterHtml } from "../../pages/ReadingPage/components/lyceum-reader/renderChapter";
import { freeDictCatalog, parseFreeDictDatabase } from "../../../electron/services/freedict-catalog";

const document = analyzeDocument({
  documentId: "d",
  title: "T",
  language: "de",
  chapters: [
    { id: "a", href: "a", title: "A", blocks: [{ kind: "paragraph", text: "Ich gehe. Du gehst. Er geht nach Hause. Das Haus ist alt." }] },
    { id: "b", href: "b", title: "B", blocks: [{ kind: "paragraph", text: "Wir gehen. Anna wohnt dort. Die Katze schläft 12 Stunden." }] },
  ],
}, getLanguageModule("de"));

function session(snapshot: KnowledgeSnapshot) {
  return { snapshot, formStates: computeFormStates(document, snapshot), lookups: {}, lapses: {} };
}

describe("word list", () => {
  const empty: KnowledgeSnapshot = { lemmas: {}, forms: {} };

  it("lists every word of the book (no numbers) with frequency, sortable", () => {
    const rows = buildWordRows(document, session(empty), "book", 0);
    expect(rows.some((row) => row.label === "12")).toBe(false);
    const byFrequency = sortWordRows(rows, "frequency", "de");
    expect(byFrequency[0]).toMatchObject({ key: "gehen", frequency: 4 });
    const alphabetical = sortWordRows(rows, "alphabetical", "de").map((row) => row.label);
    expect(alphabetical).toEqual([...alphabetical].sort((a, b) => a.localeCompare(b, "de", { sensitivity: "base" })));
  });

  it("ranks words still to learn above known words by relevance", () => {
    const snapshot: KnowledgeSnapshot = { lemmas: { gehen: { language: "de", key: "gehen", label: "gehen", state: "known", translation: null, note: null, lookupCount: 0, updatedAt: "t" } }, forms: {} };
    const ranked = sortWordRows(buildWordRows(document, session(snapshot), "book", 0), "relevance", "de");
    const gehen = ranked.findIndex((row) => row.key === "gehen");
    expect(ranked.slice(0, gehen).every((row) => row.state === "unknown")).toBe(true);
  });

  it("scopes to a chapter and to all saved words (including words from other books)", () => {
    const chapter = buildWordRows(document, session(empty), "chapter", 1);
    expect(chapter.find((row) => row.key === "gehen")?.frequency).toBe(1);
    expect(chapter.some((row) => row.key === "Haus")).toBe(false);

    const snapshot: KnowledgeSnapshot = { lemmas: {
      Haus: { language: "de", key: "Haus", label: "Haus", state: "learning", translation: "casa", note: null, lookupCount: 0, updatedAt: "2" },
      Baum: { language: "de", key: "Baum", label: "Baum", state: "known", translation: null, note: null, lookupCount: 0, updatedAt: "3" },
      Tisch: { language: "de", key: "Tisch", label: "Tisch", state: "unknown", translation: null, note: null, lookupCount: 2, updatedAt: "1" },
    }, forms: {} };
    const all = sortWordRows(buildWordRows(document, session(snapshot), "all", 0), "recent", "de");
    expect(all.map((row) => row.key)).toEqual(["Baum", "Haus"]);
    expect(all[0]!.lexeme).toBeNull();
    expect(all[1]).toMatchObject({ translation: "casa", frequency: 2 }); // "Haus" + dative "Hause"
  });
});

describe("chapter segments", () => {
  it("covers every block exactly once and renders the same markup as the whole chapter", () => {
    const chapter = { ...document.chapters[0]!, blocks: Array.from({ length: 30 }, (_, i) => ({ ...document.chapters[0]!.blocks[0]!, id: `a.b${i}` })) };
    const perBlock = chapter.blocks[0]!.sentences.reduce((sum, s) => sum + s.tokens.length, 0);
    const segments = buildChapterSegments(chapter, 100, perBlock * 4);
    expect(segments.length).toBeGreaterThan(5);
    expect(segments[0]!.blockStart).toBe(0);
    expect(segments.at(-1)!.blockEnd).toBe(30);
    const states = computeFormStates(document, { lemmas: {}, forms: {} });
    const joined = segments.map((segment) => renderBlocksHtml(chapter.blocks.slice(segment.blockStart, segment.blockEnd), segment.firstOrdinal, states)).join("");
    expect(joined).toBe(renderChapterHtml(chapter, 100, states));
  });
});

describe("FreeDict catalog", () => {
  it("offers French → Portuguese and French → English StarDict dictionaries", () => {
    const catalog = freeDictCatalog();
    expect(catalog.find((entry) => entry.id === "fra-por")).toMatchObject({ sourceLang: "fr", targetLang: "pt", format: "tar.xz" });
    expect(catalog.find((entry) => entry.id === "fra-eng")).toMatchObject({ sourceLang: "fr", targetLang: "en" });
    expect(catalog.every((entry) => entry.url.startsWith("https://download.freedict.org/"))).toBe(true);
    expect(catalog.length).toBeGreaterThan(200);
  });

  it("parses the live catalog format, keeping the newest StarDict release", () => {
    const rows = parseFreeDictDatabase([
      { name: "fra-por", headwords: "26132", releases: [
        { platform: "dictd", URL: "https://download.freedict.org/x.dictd.tar.xz", date: "2025-01-01" },
        { platform: "stardict", URL: "https://download.freedict.org/old.stardict.tar.xz", date: "2024-01-01", version: "1", size: "10", checksum: "a" },
        { platform: "stardict", URL: "https://download.freedict.org/new.stardict.tar.xz", date: "2025-11-23", version: "2", size: "20", checksum: "b" },
      ] },
      { software: {} },
      { name: "bad name", releases: [] },
    ]);
    expect(rows).toEqual([["fra-por", 26132, "2", "https://download.freedict.org/new.stardict.tar.xz", 20, "b"]]);
  });
});
