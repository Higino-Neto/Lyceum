// @vitest-environment node
import { createRequire } from "node:module";
import zlib from "node:zlib";
import { describe, expect, it } from "vitest";
import { lookupInPack, type PackQueryRunner } from "../../core/dictionary-packs";

/**
 * Checks built packs (github.com/Higino-Neto/lyceum-lexicon). Runs only when
 * LYCEUM_LEXICON_DIR points at a folder with the `<lang>.db` files.
 */
const directory = process.env.LYCEUM_LEXICON_DIR;
interface SqliteStatement { run(...params: unknown[]): unknown; all(...params: unknown[]): unknown[] }
interface SqliteDatabase { exec(sql: string): void; prepare(sql: string): SqliteStatement }
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as { DatabaseSync: new (path: string, options?: { readOnly?: boolean }) => SqliteDatabase };

function open(lang: string): PackQueryRunner {
  const db = new DatabaseSync(`${directory}/${lang}.db`, { readOnly: true });
  return { all: async (sql, params) => db.prepare(sql).all(...params) as Record<string, unknown>[] };
}
const inflate = (bytes: Uint8Array) => zlib.inflateRawSync(bytes).toString("utf-8");

describe.skipIf(!directory)("built dictionary packs", () => {
  const cases: Array<[string, string, string, string]> = [
    ["fr", "courait", "courir", "correr"],
    ["fr", "yeux", "œil", "olho"],
    ["fr", "maisons", "maison", "casa"],
    ["fr", "l'homme", "homme", "homem"],
    ["es", "tenía", "tener", "ter"],
    ["de", "Häuser", "Haus", "casa"],
    ["de", "ging", "gehen", "ir"],
    ["en", "children", "child", "criança"],
    ["pt", "falávamos", "falar", "speak"],
  ];
  it.each(cases)("%s %s → %s (%s)", async (lang, word, lemma, translation) => {
    const target = lang === "pt" ? "en" : "pt";
    const result = await lookupInPack(open(lang), inflate, { word, lang, target });
    expect(result.found).toBe(true);
    const entry = result.entries.find((item) => item.word === lemma);
    expect(entry, result.entries.map((item) => item.word).join(", ")).toBeDefined();
    expect(entry!.translations.slice(0, 8).map((item) => item.word)).toContain(translation);
  });

  it("prints a full entry", async () => {
    const result = await lookupInPack(open("fr"), inflate, { word: "heureuses", lang: "fr", target: "pt" });
    const entry = result.entries[0]!;
    console.log(JSON.stringify({ ...entry, forms: entry.forms.slice(0, 5), senses: entry.senses.slice(0, 3) }, null, 1).slice(0, 3000));
    expect(entry.ipa.length).toBeGreaterThan(0);
    expect(entry.senses.length).toBeGreaterThan(0);
  });
});
