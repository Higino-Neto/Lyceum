import { FREEDICT_SNAPSHOT, type FreeDictRow } from "./freedict-snapshot";

export const FREEDICT_DATABASE_URL = "https://freedict.org/freedict-database.json";

/** ISO 639-3 (FreeDict) → the short codes used by the rest of the app. */
const ISO3_TO_APP: Record<string, string> = {
  afr: "af", ara: "ar", ast: "ast", bre: "br", bul: "bg", cat: "ca", ces: "cs", ckb: "ckb",
  cym: "cy", dan: "da", deu: "de", ell: "el", eng: "en", epo: "eo", fin: "fi", fra: "fr",
  gla: "gd", gle: "ga", hin: "hi", hrv: "hr", hun: "hu", ind: "id", isl: "is", ita: "it",
  jpn: "ja", kha: "kha", kmr: "kmr", kur: "ku", lat: "la", lit: "lt", mkd: "mk", mlg: "mg",
  nld: "nl", nno: "nn", nob: "nb", nor: "no", oci: "oc", pol: "pl", por: "pt", rom: "rom",
  rus: "ru", san: "sa", slk: "sk", slv: "sl", spa: "es", srp: "sr", swe: "sv", swh: "sw",
  tur: "tr", wol: "wo", zho: "zh",
};

export function appLanguageCode(iso3: string) {
  return ISO3_TO_APP[iso3] ?? iso3;
}

export interface FreeDictEntry {
  id: string;
  name: string;
  sourceLang: string;
  targetLang: string;
  size: number;
  url: string;
  version: string;
  hash: string;
  headwords: number;
  format: "tar.xz";
  provider: "freedict";
}

function languageName(code: string) {
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function toFreeDictEntry([name, headwords, version, url, size, checksum]: FreeDictRow): FreeDictEntry | null {
  const [source, target] = name.split("-");
  if (!source || !target || !/^https:\/\/download\.freedict\.org\//.test(url)) return null;
  const sourceLang = appLanguageCode(source);
  const targetLang = appLanguageCode(target);
  return {
    id: name,
    name: `${languageName(sourceLang)} → ${languageName(targetLang)}`,
    sourceLang,
    targetLang,
    size,
    url,
    version,
    hash: checksum,
    headwords,
    format: "tar.xz",
    provider: "freedict",
  };
}

interface FreeDictRelease {
  URL?: unknown;
  checksum?: unknown;
  date?: unknown;
  platform?: unknown;
  size?: unknown;
  version?: unknown;
}

/** Parses freedict-database.json into catalog rows (StarDict releases only). */
export function parseFreeDictDatabase(raw: unknown): FreeDictRow[] {
  if (!Array.isArray(raw)) return [];
  const rows: FreeDictRow[] = [];
  for (const item of raw as Array<Record<string, unknown>>) {
    if (!item || typeof item.name !== "string" || !/^[a-z]{2,3}-[a-z]{2,3}$/.test(item.name)) continue;
    const releases = (Array.isArray(item.releases) ? item.releases : []) as FreeDictRelease[];
    const stardict = releases
      .filter((release) => release.platform === "stardict" && typeof release.URL === "string")
      .sort((a, b) => String(a.date ?? "").localeCompare(String(b.date ?? "")))
      .at(-1);
    if (!stardict) continue;
    rows.push([
      item.name,
      Number(item.headwords) || 0,
      String(stardict.version ?? ""),
      String(stardict.URL),
      Number(stardict.size) || 0,
      typeof stardict.checksum === "string" ? stardict.checksum : "",
    ]);
  }
  return rows;
}

export function freeDictCatalog(rows: FreeDictRow[] = FREEDICT_SNAPSHOT): FreeDictEntry[] {
  return rows.map(toFreeDictEntry).filter((entry): entry is FreeDictEntry => entry !== null);
}
