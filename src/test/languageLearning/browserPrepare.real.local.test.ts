import { it, expect } from "vitest";
import fs from "node:fs";
import { readEpubChapters } from "../../features/language-learning/browser/sourceChapters";
import { analyzeBook } from "../../features/language-learning/browser/analyzeBook";
it.skipIf(!process.env.LYCEUM_REAL_EPUB)("real epub", async () => {
  const bytes = new Uint8Array(fs.readFileSync(process.env.LYCEUM_REAL_EPUB!));
  let t = Date.now();
  const book = await readEpubChapters(bytes, "x");
  const readMs = Date.now() - t; t = Date.now();
  const r = analyzeBook({ documentId: "x", book });
  const biggest = Math.max(...r.document.chapters.map((c) => c.tokenCount));
  console.log(JSON.stringify({ title: book.title, lang: r.document.language, meta: r.metadataLanguage, chapters: r.document.chapters.length, tokens: r.document.totals.tokens, biggest, readMs, analyzeMs: Date.now() - t, sample: r.document.chapters.slice(0, 4).map((c) => c.title) }));
  expect(r.document.totals.tokens).toBeGreaterThan(1000);
}, 120000);
