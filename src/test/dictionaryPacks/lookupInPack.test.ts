// @vitest-environment node
import { createRequire } from "node:module";
import zlib from "node:zlib";
import { describe, expect, it } from "vitest";
import { lookupInPack, lookupKeys, packKey, type PackQueryRunner } from "../../core/dictionary-packs";

// `node:sqlite` is loaded through require so bundlers that do not know the module yet leave it alone.
interface SqliteStatement { run(...params: unknown[]): unknown; all(...params: unknown[]): unknown[] }
interface SqliteDatabase { exec(sql: string): void; prepare(sql: string): SqliteStatement }
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as { DatabaseSync: new (path: string, options?: { readOnly?: boolean }) => SqliteDatabase };

function buildPack() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE entry(id INTEGER PRIMARY KEY, key TEXT NOT NULL, word TEXT NOT NULL, pos TEXT, data BLOB NOT NULL);
    CREATE TABLE form(key TEXT NOT NULL, lemma TEXT NOT NULL, pos TEXT, tags TEXT);
    CREATE TABLE trans(key TEXT NOT NULL, pos TEXT, lang TEXT NOT NULL, word TEXT NOT NULL, sense TEXT, n INTEGER NOT NULL DEFAULT 1);
  `);
  const entry = db.prepare("INSERT INTO entry(key, word, pos, data) VALUES(?,?,?,?)");
  const add = (word: string, pos: string, data: unknown) => entry.run(packKey(word), word, pos, zlib.deflateRawSync(Buffer.from(JSON.stringify(data))));
  add("courir", "verb", { s: [{ g: "to run", ex: [{ x: "Il court vite.", tr: "He runs fast." }], synonyms: ["galoper"] }], ipa: ["/ku.ʁiʁ/"], au: [{ u: "https://upload.wikimedia.org/x.mp3", t: ["France"] }], fm: [["courait", ["imperfect"]]], antonyms: ["marcher"] });
  add("est", "noun", { s: [{ g: "east" }] });
  add("être", "verb", { s: [{ g: "to be" }] });
  add("maison", "noun", { s: [{ g: "house" }], h: "maison f (plural maisons)" });
  const form = db.prepare("INSERT INTO form VALUES(?,?,?,?)");
  form.run("courait", "courir", "verb", "imperfect indicative third-person singular");
  form.run("est", "être", "verb", "present indicative third-person singular");
  form.run("maisons", "maison", "noun", "plural");
  const trans = db.prepare("INSERT INTO trans VALUES(?,?,?,?,?,?)");
  trans.run("courir", "verb", "pt", "correr", "to run", 5);
  trans.run("courir", "verb", "pt", "percorrer", "to traverse", 1);
  trans.run("maison", "noun", "pt", "lar", "home", 1);
  trans.run("maison", "noun", "pt", "casa", "house", 9);
  trans.run("être", "verb", "pt", "ser", "to be", 4);
  const runner: PackQueryRunner = {
    all: async (sql, params) => db.prepare(sql).all(...params) as Record<string, unknown>[],
  };
  return runner;
}

const inflate = (bytes: Uint8Array) => zlib.inflateRawSync(bytes).toString("utf-8");

describe("dictionary packs", () => {
  it("normalizes apostrophes and French elisions", () => {
    expect(lookupKeys("L’Homme,", "fr")).toEqual(["l'homme", "homme"]);
    expect(lookupKeys("lorsqu'il", "fr")).toContain("il");
    expect(lookupKeys("Straße", "de")).toEqual(["straße", "strasse"]);
  });

  it("resolves an inflected form to its lemma with translations ranked by frequency", async () => {
    const result = await lookupInPack(buildPack(), inflate, { word: "courait", lang: "fr", target: "pt" });
    expect(result.found).toBe(true);
    const [entry] = result.entries;
    expect(entry?.word).toBe("courir");
    expect(entry?.matchedForm).toEqual({ form: "courait", tags: ["imperfect", "indicative", "third-person", "singular"] });
    expect(entry?.translations.map((item) => item.word)).toEqual(["correr", "percorrer"]);
    expect(entry?.ipa).toEqual(["/ku.ʁiʁ/"]);
    expect(entry?.senses[0]?.examples[0]).toEqual({ text: "Il court vite.", translation: "He runs fast." });
    expect(entry?.senses[0]?.relations.synonyms).toEqual(["galoper"]);
    expect(entry?.relations.antonyms).toEqual(["marcher"]);
  });

  it("puts the reading engine's lemma first when a form is ambiguous", async () => {
    const result = await lookupInPack(buildPack(), inflate, { word: "est", lang: "fr", target: "pt", lemmaHint: "être" });
    expect(result.entries.map((entry) => entry.word)).toEqual(["être", "est"]);
    expect(result.entries[0]?.translations[0]?.word).toBe("ser");
  });

  it("orders translations by how often the pair was attested", async () => {
    const result = await lookupInPack(buildPack(), inflate, { word: "Maisons", lang: "fr", target: "pt" });
    expect(result.entries[0]?.translations.map((item) => item.word)).toEqual(["casa", "lar"]);
    expect(result.entries[0]?.head).toBe("maison f (plural maisons)");
  });

  it("reports misses without throwing", async () => {
    const result = await lookupInPack(buildPack(), inflate, { word: "xyzzy", lang: "fr", target: "pt" });
    expect(result).toMatchObject({ found: false, entries: [] });
  });
});
