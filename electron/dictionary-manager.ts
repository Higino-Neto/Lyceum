import path from "node:path";
import fs from "node:fs";
import electron from "electron";
import AdmZip from "adm-zip";
import { extractNestedTarArchives } from "./services/dictionary-archive";
import { downloadHttpBuffer } from "./services/http-download";
import crypto from "node:crypto";
import {
  FREEDICT_DATABASE_URL,
  freeDictCatalog,
  parseFreeDictDatabase,
} from "./services/freedict-catalog";
import type { FreeDictRow } from "./services/freedict-snapshot";

const { app } = electron;

export interface DictionaryInfo {
  id: string;
  name: string;
  sourceLang: string;
  targetLang: string;
  size: number;
  url: string;
  version: string;
  hash: string;
  downloadedAt?: string;
  isDownloaded?: boolean;
  /** Archive format of `url`; zip when omitted. */
  format?: "zip" | "tar.xz";
  headwords?: number;
  provider?: "lyceum" | "freedict";
}

export interface DictionaryIndex {
  dictionaries: DictionaryInfo[];
}

const DICTIONARY_BUCKET_URL = "https://szjunmocyxycmuirvzta.supabase.co/storage/v1/object/public/dictionaries";

const DEFAULT_INDEX: DictionaryIndex = {
  dictionaries: [
    {
      id: "eng-spa",
      name: "English → Spanish",
      sourceLang: "en",
      targetLang: "es",
      size: 1024 * 1024 * 5,
      url: `${DICTIONARY_BUCKET_URL}/eng-spa.zip`,
      version: "2025.11.23",
      hash: "",
    },
    {
      id: "eng-por",
      name: "English → Portuguese",
      sourceLang: "en",
      targetLang: "pt",
      size: 1024 * 1024 * 1,
      url: `${DICTIONARY_BUCKET_URL}/eng-por.zip`,
      version: "0.3",
      hash: "",
    },
    {
      id: "eng-fra",
      name: "English → French",
      sourceLang: "en",
      targetLang: "fr",
      size: 1024 * 1024 * 1,
      url: `${DICTIONARY_BUCKET_URL}/eng-fra.zip`,
      version: "0.1.6",
      hash: "",
    },
    {
      id: "eng-deu",
      name: "English → German",
      sourceLang: "en",
      targetLang: "de",
      size: 1024 * 1024 * 26,
      url: `${DICTIONARY_BUCKET_URL}/eng-deu.zip`,
      version: "1.9-fd1",
      hash: "",
    },
    {
      id: "eng-ita",
      name: "English → Italian",
      sourceLang: "en",
      targetLang: "it",
      size: 1024 * 1024 * 4,
      url: `${DICTIONARY_BUCKET_URL}/eng-ita.zip`,
      version: "2025.11.23",
      hash: "",
    },
    {
      id: "eng-zho",
      name: "English → Chinese",
      sourceLang: "en",
      targetLang: "zh",
      size: 1024 * 1024 * 2,
      url: `${DICTIONARY_BUCKET_URL}/eng-zho.zip`,
      version: "2025.11.23",
      hash: "",
    },
    {
      id: "eng-jpn",
      name: "English → Japanese",
      sourceLang: "en",
      targetLang: "ja",
      size: 1024 * 1024 * 3,
      url: `${DICTIONARY_BUCKET_URL}/eng-jpn.zip`,
      version: "2025.11.23",
      hash: "",
    },
    {
      id: "eng-rus",
      name: "English → Russian",
      sourceLang: "en",
      targetLang: "ru",
      size: 1024 * 1024 * 6,
      url: `${DICTIONARY_BUCKET_URL}/eng-rus.zip`,
      version: "2025.11.23",
      hash: "",
    },
  ],
};

export class DictionaryManager {
  private dictionariesPath: string;
  private indexPath: string;
  private index: DictionaryIndex;
  private metadataFile = "metadata.json";
  private downloadProgress: Map<string, number> = new Map();
  private fetchCallback?: (dictId: string, progress: number) => void;

  constructor() {
    this.dictionariesPath = path.join(app.getPath("userData"), "dictionaries");
    this.indexPath = path.join(this.dictionariesPath, "index.json");
    this.index = { dictionaries: [] };
    this.ensureDirectory();
  }

  private ensureDirectory(): void {
    if (!fs.existsSync(this.dictionariesPath)) {
      fs.mkdirSync(this.dictionariesPath, { recursive: true });
    }
  }

  private cloneIndex(index: DictionaryIndex): DictionaryIndex {
    return {
      dictionaries: index.dictionaries.map((dict) => ({ ...dict })),
    };
  }

  private hydrateDownloadState(index: DictionaryIndex): DictionaryIndex {
    const hydrated = this.cloneIndex(index);

    for (const dict of hydrated.dictionaries) {
      const dictPath = this.getDictionaryPath(dict.id);
      dict.isDownloaded = fs.existsSync(dictPath);

      if (dict.isDownloaded) {
        const metaPath = path.join(dictPath, this.metadataFile);
        if (fs.existsSync(metaPath)) {
          const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
          dict.downloadedAt = meta.downloadedAt;
        }
      } else {
        dict.downloadedAt = undefined;
      }
    }

    return hydrated;
  }

  private freeDictCachePath() {
    return path.join(this.dictionariesPath, "freedict-catalog.json");
  }

  private cachedFreeDictRows(): FreeDictRow[] | undefined {
    try {
      const cached = JSON.parse(fs.readFileSync(this.freeDictCachePath(), "utf-8")) as unknown;
      return Array.isArray(cached) && cached.length > 0 ? (cached as FreeDictRow[]) : undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Curated Lyceum dictionaries first, then every FreeDict StarDict release
   * (bundled snapshot, or the copy refreshed from freedict.org).
   */
  private catalog(): DictionaryIndex {
    const curated = DEFAULT_INDEX.dictionaries.map((dict) => ({ ...dict, provider: "lyceum" as const }));
    const ids = new Set(curated.map((dict) => dict.id));
    const freeDict = freeDictCatalog(this.cachedFreeDictRows()).filter((dict) => !ids.has(dict.id));
    return { dictionaries: [...curated, ...freeDict] };
  }

  async fetchIndex(): Promise<DictionaryIndex> {
    try {
      const buffer = await downloadHttpBuffer(FREEDICT_DATABASE_URL, { maxBytes: 20 * 1024 * 1024 });
      const rows = parseFreeDictDatabase(JSON.parse(buffer.toString("utf-8")));
      if (rows.length > 0) fs.writeFileSync(this.freeDictCachePath(), JSON.stringify(rows));
    } catch (error) {
      console.warn("[DictionaryManager] FreeDict catalog refresh failed; using the bundled list:", error);
    }
    this.index = this.hydrateDownloadState(this.catalog());
    await this.saveLocalIndex();
    return this.index;
  }

  async loadLocalIndex(): Promise<DictionaryIndex> {
    try {
      // The catalog is code-defined; the saved index only matters for download state,
      // which is re-derived from disk. Downloaded entries no longer in the catalog stay listed.
      const catalog = this.catalog();
      if (fs.existsSync(this.indexPath)) {
        const saved = JSON.parse(fs.readFileSync(this.indexPath, "utf-8")) as DictionaryIndex;
        const ids = new Set(catalog.dictionaries.map((dict) => dict.id));
        for (const dict of saved.dictionaries ?? []) {
          if (!ids.has(dict.id) && fs.existsSync(this.getDictionaryPath(dict.id))) catalog.dictionaries.push(dict);
        }
      }
      this.index = this.hydrateDownloadState(catalog);
    } catch {
      this.index = this.hydrateDownloadState(this.catalog());
    }
    return this.index;
  }

  async saveLocalIndex(): Promise<void> {
    this.ensureDirectory();
    fs.writeFileSync(this.indexPath, JSON.stringify(this.index, null, 2));
  }

  getDictionaryPath(dictId: string): string {
    return path.join(this.dictionariesPath, dictId);
  }

  getDictionaryInfo(dictId: string): DictionaryInfo | undefined {
    return this.index.dictionaries.find(d => d.id === dictId);
  }

  getAvailableDictionaries(): DictionaryInfo[] {
    return this.index.dictionaries;
  }

  getDownloadedDictionaries(): DictionaryInfo[] {
    return this.index.dictionaries.filter(d => d.isDownloaded);
  }

  isDownloaded(dictId: string): boolean {
    const dict = this.getDictionaryInfo(dictId);
    if (!dict?.isDownloaded) return false;
    
    // Verify database actually exists
    const dbPath = path.join(this.dictionariesPath, `${dictId}.db`);
    return fs.existsSync(dbPath);
  }

  async downloadDictionary(
    dictId: string,
    onProgress?: (progress: number) => void
  ): Promise<boolean> {
    const dict = this.getDictionaryInfo(dictId);
    if (!dict) {
      throw new Error(`Dictionary ${dictId} not found`);
    }

    if (dict.isDownloaded) {
      return true;
    }

    try {
      const dictPath = this.getDictionaryPath(dictId);
      this.ensureDirectory();

      const buffer = await downloadHttpBuffer(dict.url, {
        maxBytes: 200 * 1024 * 1024,
        onProgress: (progress) => {
          this.downloadProgress.set(dictId, progress);
          onProgress?.(progress);
        },
      });
      if (/^[0-9a-f]{128}$/i.test(dict.hash)) {
        const actual = crypto.createHash("sha512").update(buffer).digest("hex");
        if (actual.toLowerCase() !== dict.hash.toLowerCase()) throw new Error(`Checksum mismatch for ${dictId}`);
      }

      if (dict.format === "tar.xz") {
        fs.rmSync(dictPath, { recursive: true, force: true });
        fs.mkdirSync(dictPath, { recursive: true });
        fs.writeFileSync(path.join(dictPath, `${dictId}.tar.xz`), buffer);
      } else {
        const tempPath = path.join(this.dictionariesPath, `${dictId}.zip`);
        fs.writeFileSync(tempPath, buffer);
        // Extract ZIP (works cross-platform with adm-zip)
        const zip = new AdmZip(tempPath);
        zip.extractAllTo(dictPath, true);
        fs.unlinkSync(tempPath);
      }

      // Some dictionary ZIPs contain a TAR/TAR.XZ payload. Extract it in-process
      // so downloads work on Linux and do not depend on a system 7-Zip install.
      await extractNestedTarArchives(dictPath);

      const metadata = {
        ...dict,
        downloadedAt: new Date().toISOString(),
        isDownloaded: true,
      };
      fs.writeFileSync(
        path.join(dictPath, this.metadataFile),
        JSON.stringify(metadata, null, 2)
      );

      dict.isDownloaded = true;
      dict.downloadedAt = metadata.downloadedAt;
      await this.saveLocalIndex();
      
      // Invalidate engine and delete database to force re-import
      const dbPath = path.join(this.dictionariesPath, `${dictId}.db`);
      if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
        console.log(`[DictionaryManager] Deleted old database: ${dbPath}`);
      }

      return true;
    } catch (error) {
      console.error("[DictionaryManager] Download error:", error);
      throw error;
    }
  }

  async deleteDictionary(dictId: string): Promise<boolean> {
    const dict = this.getDictionaryInfo(dictId);
    if (!dict) {
      return false;
    }

    const dictPath = this.getDictionaryPath(dictId);
    if (fs.existsSync(dictPath)) {
      fs.rmSync(dictPath, { recursive: true, force: true });
    }
    
    // Also delete the database
    const dbPath = path.join(this.dictionariesPath, `${dictId}.db`);
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }

    dict.isDownloaded = false;
    dict.downloadedAt = undefined;
    await this.saveLocalIndex();
    
    return true;
  }

  getDownloadProgress(dictId: string): number {
    return this.downloadProgress.get(dictId) || 0;
  }

  setDownloadProgress(dictId: string, progress: number): void {
    this.downloadProgress.set(dictId, progress);
  }
}

export const dictionaryManager = new DictionaryManager();
