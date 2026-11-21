import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import electron from "electron";
import {
  PACK_MANIFEST_URL,
  isPackLanguage,
  lookupInPack,
  packAssetUrl,
  packCatalogEntries,
  parsePackManifest,
  type PackLookupResult,
  type PackManifest,
} from "../src/core/dictionary-packs";
import { downloadHttpBuffer, downloadHttpFile } from "./services/http-download";

const { app } = electron;

interface InstalledPack {
  lang: string;
  version: string;
  file: string;
  size: number;
  installedAt: string;
}

/**
 * Wiktionary dictionary packs on desktop: downloaded from GitHub Releases into
 * `userData/dictionary-packs/<lang>.db` and opened read-only.
 */
class DictionaryPackManager {
  private manifest: PackManifest | null = null;
  private manifestLoadedAt = 0;
  private readonly databases = new Map<string, Database.Database>();

  private get directory() {
    const directory = path.join(app.getPath("userData"), "dictionary-packs");
    fs.mkdirSync(directory, { recursive: true });
    return directory;
  }

  private get installedPath() {
    return path.join(this.directory, "installed.json");
  }

  private readInstalled(): Record<string, InstalledPack> {
    try {
      return JSON.parse(fs.readFileSync(this.installedPath, "utf-8")) as Record<string, InstalledPack>;
    } catch {
      return {};
    }
  }

  private writeInstalled(installed: Record<string, InstalledPack>) {
    fs.writeFileSync(this.installedPath, JSON.stringify(installed, null, 2));
  }

  isInstalled(lang: string) {
    const pack = this.readInstalled()[lang];
    return Boolean(pack && fs.existsSync(path.join(this.directory, pack.file)));
  }

  /** Cached manifest; refreshed from GitHub at most every 6 hours. */
  async loadManifest(force = false): Promise<PackManifest | null> {
    const cachePath = path.join(this.directory, "manifest.json");
    if (!this.manifest) {
      try {
        this.manifest = parsePackManifest(JSON.parse(fs.readFileSync(cachePath, "utf-8")));
      } catch {
        this.manifest = null;
      }
    }
    if (force || !this.manifest || Date.now() - this.manifestLoadedAt > 6 * 3600_000) {
      try {
        const buffer = await downloadHttpBuffer(PACK_MANIFEST_URL, { maxBytes: 1024 * 1024, headers: { "User-Agent": "Lyceum" } });
        const manifest = parsePackManifest(JSON.parse(buffer.toString("utf-8")));
        if (manifest) {
          this.manifest = manifest;
          fs.writeFileSync(cachePath, JSON.stringify(manifest));
        }
        this.manifestLoadedAt = Date.now();
      } catch (error) {
        console.warn("[DictionaryPacks] manifest refresh failed:", error);
        // Retry on the next catalog read instead of waiting 6 hours.
        this.manifestLoadedAt = 0;
      }
    }
    return this.manifest;
  }

  async catalog() {
    let manifest = this.manifest;
    try {
      manifest = await this.loadManifest();
    } catch {
      // Offline: list packs from the cached manifest (or without sizes).
    }
    return packCatalogEntries(manifest, (lang) => this.isInstalled(lang));
  }

  async download(lang: string, onProgress: (percent: number) => void) {
    if (!isPackLanguage(lang)) throw new Error(`Unknown dictionary pack: ${lang}`);
    const manifest = await this.loadManifest(true);
    const item = manifest?.packs.find((pack) => pack.lang === lang);
    if (!manifest || !item) throw new Error("Dictionary pack catalog unavailable");

    const target = path.join(this.directory, item.file);
    const partial = `${target}.part`;
    try {
      const result = await downloadHttpFile(packAssetUrl(manifest.version, item.file), partial, { onProgress });
      if (item.size && result.bytes !== item.size) throw new Error(`Incomplete download (${result.bytes}/${item.size} bytes)`);
      if (item.sha256 && result.sha256 !== item.sha256) throw new Error("Checksum mismatch");
      this.close(lang);
      fs.renameSync(partial, target);
    } finally {
      fs.rmSync(partial, { force: true });
    }
    const installed = this.readInstalled();
    installed[lang] = { lang, version: manifest.version, file: item.file, size: item.size, installedAt: new Date().toISOString() };
    this.writeInstalled(installed);
  }

  delete(lang: string) {
    const installed = this.readInstalled();
    const pack = installed[lang];
    this.close(lang);
    if (pack) fs.rmSync(path.join(this.directory, pack.file), { force: true });
    delete installed[lang];
    this.writeInstalled(installed);
    return true;
  }

  private open(lang: string) {
    let database = this.databases.get(lang);
    if (database) return database;
    const pack = this.readInstalled()[lang];
    if (!pack) return null;
    const file = path.join(this.directory, pack.file);
    if (!fs.existsSync(file)) return null;
    database = new Database(file, { readonly: true, fileMustExist: true });
    this.databases.set(lang, database);
    return database;
  }

  private close(lang: string) {
    this.databases.get(lang)?.close();
    this.databases.delete(lang);
  }

  closeAll() {
    for (const lang of [...this.databases.keys()]) this.close(lang);
  }

  async lookup(word: string, lang: string, target: string, lemmaHint?: string | null): Promise<PackLookupResult> {
    const database = this.open(lang);
    if (!database) return { found: false, query: word, lang, target, entries: [] };
    return lookupInPack(
      { all: async (sql, params) => database.prepare(sql).all(...params) as Record<string, unknown>[] },
      (bytes) => zlib.inflateRawSync(bytes).toString("utf-8"),
      { word, lang, target, lemmaHint },
    );
  }
}

export const dictionaryPackManager = new DictionaryPackManager();
