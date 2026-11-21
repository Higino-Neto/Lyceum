/**
 * Wiktionary dictionary packs (built by github.com/Higino-Neto/lyceum-lexicon).
 *
 * One SQLite file per source language with lemma entries (senses, examples,
 * IPA, audio, etymology, relations, inflections), a form -> lemma index and
 * translations into every other pack language. Desktop opens it with
 * better-sqlite3 in the main process, mobile with the native SQLite plugin;
 * both run the same queries through `lookupInPack`.
 */

export const PACK_LANGUAGES = ["en", "pt", "es", "fr", "de"] as const;
export type PackLanguage = (typeof PACK_LANGUAGES)[number];

export const PACK_REPOSITORY = "Higino-Neto/lyceum-lexicon";
export const PACK_RELEASES_URL = `https://github.com/${PACK_REPOSITORY}/releases`;
export const PACK_MANIFEST_URL = `${PACK_RELEASES_URL}/latest/download/manifest.json`;
export const PACK_ID_PREFIX = "wiktionary-";
/** Catalog `targetLang` of a pack: it translates into every pack language. */
export const PACK_TARGET_ANY = "*";

export interface PackManifestItem {
  lang: string;
  file: string;
  size: number;
  sha256: string;
  entries: number;
  forms: number;
  translations: number;
  translatedWords: number;
  targets: Record<string, number>;
}

export interface PackManifest {
  schema: number;
  version: string;
  sourceDate?: string;
  packs: PackManifestItem[];
}

export const PACK_NAMES: Record<string, string> = {
  en: "English",
  pt: "Português",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
};

export function packId(lang: string) {
  return `${PACK_ID_PREFIX}${lang}`;
}

export function packLanguageFromId(id: string): string | null {
  return id.startsWith(PACK_ID_PREFIX) ? id.slice(PACK_ID_PREFIX.length) : null;
}

export function isPackLanguage(lang: string): lang is PackLanguage {
  return (PACK_LANGUAGES as readonly string[]).includes(lang);
}

export function packAssetUrl(version: string, file: string) {
  return `${PACK_RELEASES_URL}/download/v${version}/${file}`;
}

export function parsePackManifest(raw: unknown): PackManifest | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<PackManifest>;
  if (typeof value.version !== "string" || !Array.isArray(value.packs)) return null;
  const packs = value.packs.filter((pack): pack is PackManifestItem =>
    Boolean(pack) && typeof pack.lang === "string" && typeof pack.file === "string" && /^[a-z]{2,3}\.db$/.test(pack.file),
  );
  return { schema: Number(value.schema) || 1, version: value.version, sourceDate: value.sourceDate, packs };
}

/** Catalog rows (same shape as the legacy dictionary catalog) for every pack language. */
export function packCatalogEntries(manifest: PackManifest | null, isInstalled: (lang: string) => boolean) {
  return PACK_LANGUAGES.map((lang) => {
    const item = manifest?.packs.find((pack) => pack.lang === lang);
    return {
      id: packId(lang),
      name: `Wiktionary · ${PACK_NAMES[lang] ?? lang}`,
      sourceLang: lang,
      targetLang: PACK_TARGET_ANY,
      size: item?.size ?? 0,
      headwords: item?.entries,
      version: manifest?.version ?? "",
      isDownloaded: isInstalled(lang),
      provider: "wiktionary" as const,
    };
  });
}

// ---------------------------------------------------------------------------
// Lookup result

export interface PackExample {
  text: string;
  translation?: string;
}

export interface PackSense {
  gloss: string;
  tags: string[];
  examples: PackExample[];
  relations: Record<string, string[]>;
  formOf?: string[];
}

export interface PackTranslation {
  word: string;
  sense?: string;
}

export interface PackEntry {
  word: string;
  pos: string | null;
  head?: string;
  tags: string[];
  ipa: string[];
  audio: Array<{ url: string; tags: string[] }>;
  etymology?: string;
  hyphenation?: string[];
  senses: PackSense[];
  relations: Record<string, string[]>;
  forms: Array<{ form: string; tags: string[] }>;
  translations: PackTranslation[];
  /** How the clicked word relates to this entry (`courait` → imperfect … of `courir`). */
  matchedForm?: { form: string; tags: string[] };
}

export interface PackLookupResult {
  found: boolean;
  query: string;
  lang: string;
  target: string;
  entries: PackEntry[];
}

export type PackRow = Record<string, unknown>;
export interface PackQueryRunner {
  all(sql: string, params: Array<string | number>): Promise<PackRow[]>;
}

export const RELATION_ORDER = ["synonyms", "antonyms", "hypernyms", "hyponyms", "coordinate_terms", "related", "derived", "meronyms", "holonyms", "troponyms"];

// ---------------------------------------------------------------------------
// Normalization

const APOSTROPHES = /[’‘ʼ＇]/g;
const FRENCH_ELISION = /^(?:l|d|j|m|t|s|n|c|qu|lorsqu|puisqu|jusqu|quoiqu|presqu)'(.+)$/;
const EDGE_PUNCTUATION = /^[\s"«»“”„()[\]{}¡¿.,;:!?…]+|[\s"«»“”„()[\]{}¡¿.,;:!?…]+$/g;

export function packKey(word: string) {
  return word.normalize("NFC").replace(APOSTROPHES, "'").toLowerCase().split(/\s+/).filter(Boolean).join(" ");
}

/** Keys to try for a clicked word, most specific first. */
export function lookupKeys(word: string, lang: string): string[] {
  const keys: string[] = [];
  const add = (value: string | undefined) => {
    const key = value ? packKey(value) : "";
    if (key && !keys.includes(key)) keys.push(key);
  };
  const cleaned = word.replace(EDGE_PUNCTUATION, "");
  add(cleaned);
  const key = packKey(cleaned);
  if (lang === "fr" || lang === "it" || lang === "ca") {
    const elided = FRENCH_ELISION.exec(key);
    if (elided) add(elided[1]);
    // Inverted pronouns: "dis-moi", "va-t-en", "peut-être" stays as typed first.
    if (key.includes("-")) add(key.split("-")[0]);
  }
  if (lang === "en" && key.endsWith("'s")) add(key.slice(0, -2));
  if (lang === "de" || lang === "en") add(key.replace(/ß/g, "ss"));
  return keys;
}

// ---------------------------------------------------------------------------
// Query

interface RawSense {
  g: string;
  t?: string[];
  tp?: string[];
  rt?: string[];
  ex?: Array<{ x: string; tr?: string }>;
  of?: string[];
  [relation: string]: unknown;
}

interface RawEntry {
  s: RawSense[];
  ipa?: string[];
  au?: Array<{ u: string; t?: string[] }>;
  et?: string;
  h?: string;
  t?: string[];
  fm?: Array<[string, string[]]>;
  hy?: string[];
  [relation: string]: unknown;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function relationsOf(raw: Record<string, unknown>) {
  const relations: Record<string, string[]> = {};
  for (const name of RELATION_ORDER) {
    const values = stringList(raw[name]);
    if (values.length > 0) relations[name] = values;
  }
  return relations;
}

export function toBytes(value: unknown): Uint8Array | null {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (Array.isArray(value)) return Uint8Array.from(value as number[]);
  if (typeof value === "string") {
    try {
      const binary = atob(value);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      return bytes;
    } catch {
      return null;
    }
  }
  return null;
}

function parseEntry(word: string, pos: string | null, json: string): PackEntry | null {
  let raw: RawEntry;
  try {
    raw = JSON.parse(json) as RawEntry;
  } catch {
    return null;
  }
  const senses: PackSense[] = (raw.s ?? []).filter((sense) => typeof sense?.g === "string").map((sense) => ({
    gloss: sense.g,
    tags: [...stringList(sense.t), ...stringList(sense.tp), ...stringList(sense.rt)],
    examples: (sense.ex ?? []).filter((example) => typeof example?.x === "string").map((example) => ({ text: example.x, ...(example.tr ? { translation: example.tr } : {}) })),
    relations: relationsOf(sense),
    ...(sense.of ? { formOf: stringList(sense.of) } : {}),
  }));
  return {
    word,
    pos,
    ...(raw.h ? { head: raw.h } : {}),
    tags: stringList(raw.t),
    ipa: stringList(raw.ipa),
    audio: (raw.au ?? []).filter((item) => typeof item?.u === "string" && /^https:\/\//.test(item.u)).map((item) => ({ url: item.u, tags: stringList(item.t) })),
    ...(raw.et ? { etymology: raw.et } : {}),
    ...(raw.hy?.length ? { hyphenation: stringList(raw.hy) } : {}),
    senses,
    relations: relationsOf(raw),
    forms: (raw.fm ?? []).filter((item) => Array.isArray(item) && typeof item[0] === "string").map(([form, tags]) => ({ form, tags: stringList(tags) })),
    translations: [],
  };
}

const MAX_ENTRIES = 6;
const MAX_TRANSLATIONS_PER_ENTRY = 24;

function placeholders(count: number) {
  return Array.from({ length: count }, () => "?").join(",");
}

/**
 * Resolves a clicked word: the word's own entries, the lemmas it is an
 * inflection of, then the reader's lemma hint. Entries for the hint (the
 * lemma the reading engine picked from context) come first.
 */
export async function lookupInPack(
  run: PackQueryRunner,
  inflate: (bytes: Uint8Array) => Promise<string> | string,
  input: { word: string; lang: string; target: string; lemmaHint?: string | null },
): Promise<PackLookupResult> {
  const { lang, target } = input;
  const empty: PackLookupResult = { found: false, query: input.word, lang, target, entries: [] };
  const keys = lookupKeys(input.word, lang);
  const hintKey = input.lemmaHint ? packKey(input.lemmaHint) : "";
  if (keys.length === 0 && !hintKey) return empty;

  const queryKeys = keys.length > 0 ? keys : [hintKey];
  const formRows = await run.all(
    `SELECT key, lemma, pos, tags FROM form WHERE key IN (${placeholders(queryKeys.length)}) LIMIT 40`,
    queryKeys,
  );
  const lemmaMatches = new Map<string, { form: string; tags: string[]; pos: string | null }[]>();
  for (const row of formRows) {
    const lemma = String(row.lemma ?? "");
    if (!lemma) continue;
    const list = lemmaMatches.get(lemma) ?? [];
    list.push({ form: String(row.key ?? ""), tags: String(row.tags ?? "").split(" ").filter(Boolean), pos: row.pos ? String(row.pos) : null });
    lemmaMatches.set(lemma, list);
  }

  const entryKeys = [...new Set([...queryKeys, ...lemmaMatches.keys(), ...(hintKey ? [hintKey] : [])])].slice(0, 30);
  const entryRows = await run.all(
    `SELECT id, key, word, pos, data FROM entry WHERE key IN (${placeholders(entryKeys.length)}) LIMIT 60`,
    entryKeys,
  );

  const rank = (key: string) => {
    if (hintKey && key === hintKey) return 0;
    if (queryKeys.includes(key)) return lemmaMatches.size > 0 && hintKey ? 2 : 1;
    return 1.5;
  };
  const sorted = entryRows
    .map((row, order) => ({ row, order, key: String(row.key ?? "") }))
    .sort((a, b) => rank(a.key) - rank(b.key) || a.order - b.order)
    .slice(0, MAX_ENTRIES);

  const entries: Array<PackEntry & { key: string }> = [];
  for (const { row, key } of sorted) {
    const bytes = toBytes(row.data);
    if (!bytes) continue;
    const entry = parseEntry(String(row.word ?? key), row.pos ? String(row.pos) : null, await inflate(bytes));
    if (!entry) continue;
    const matches = lemmaMatches.get(key);
    if (matches && !queryKeys.includes(key)) {
      const match = matches.find((item) => !item.pos || item.pos === entry.pos) ?? matches[0];
      if (match) entry.matchedForm = { form: match.form, tags: match.tags };
    }
    entries.push({ ...entry, key });
  }
  if (entries.length === 0) return empty;

  if (target && target !== lang) {
    const translationKeys = [...new Set(entries.map((entry) => entry.key))];
    const rows = await run.all(
      `SELECT key, pos, word, sense FROM trans WHERE key IN (${placeholders(translationKeys.length)}) AND lang = ? ORDER BY n DESC LIMIT 400`,
      [...translationKeys, target],
    );
    for (const row of rows) {
      const key = String(row.key ?? "");
      const pos = row.pos ? String(row.pos) : null;
      const candidates = entries.filter((entry) => entry.key === key);
      const owner = candidates.find((entry) => entry.pos === pos) ?? candidates[0];
      if (!owner || owner.translations.length >= MAX_TRANSLATIONS_PER_ENTRY) continue;
      const word = String(row.word ?? "");
      if (!word || owner.translations.some((item) => item.word === word)) continue;
      owner.translations.push({ word, ...(row.sense ? { sense: String(row.sense) } : {}) });
    }
  }

  return {
    found: true,
    query: input.word,
    lang,
    target,
    entries: entries.map(({ key: _key, ...entry }) => entry),
  };
}
