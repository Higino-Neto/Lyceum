import path from "node:path";
import fs from "node:fs";
import { app } from "electron";
import AdmZip from "adm-zip";

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

  async fetchIndex(): Promise<DictionaryIndex> {
    this.index = DEFAULT_INDEX;
    return DEFAULT_INDEX;
  }

  async loadLocalIndex(): Promise<DictionaryIndex> {
    try {
      if (fs.existsSync(this.indexPath)) {
        const data = fs.readFileSync(this.indexPath, "utf-8");
        const localIndex = JSON.parse(data) as DictionaryIndex;
        
        for (const dict of localIndex.dictionaries) {
          const dictPath = this.getDictionaryPath(dict.id);
          dict.isDownloaded = fs.existsSync(dictPath);
          if (dict.isDownloaded) {
            const metaPath = path.join(dictPath, this.metadataFile);
            if (fs.existsSync(metaPath)) {
              const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
              dict.downloadedAt = meta.downloadedAt;
            }
          }
        }
        this.index = localIndex;
      } else {
        this.index = DEFAULT_INDEX;
      }
    } catch {
      this.index = { dictionaries: [] };
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

      const tempPath = path.join(this.dictionariesPath, `${dictId}.zip`);

      const response = await fetch(dict.url);
      if (!response.ok) {
        throw new Error(`Failed to download dictionary: ${response.status}`);
      }

      const contentLength = parseInt(response.headers.get("content-length") || "0");
      let downloaded = 0;
      const chunks: Uint8Array[] = [];

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Failed to read response body");
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        if (value) {
          chunks.push(value);
          downloaded += value.length;
          
          if (contentLength > 0 && onProgress) {
            const progress = Math.round((downloaded / contentLength) * 100);
            this.downloadProgress.set(dictId, progress);
            onProgress(progress);
          }
        }
      }

      const buffer = Buffer.concat(chunks.map(c => new Uint8Array(c)));
      fs.writeFileSync(tempPath, buffer);

      // Extract ZIP (works cross-platform with adm-zip)
      const zip = new AdmZip(tempPath);
      zip.extractAllTo(dictPath, true);
      fs.unlinkSync(tempPath);

      // Extract any .tar files in the directory
      const tarFile = fs.readdirSync(dictPath).find(f => f.endsWith(".tar"));
      if (tarFile) {
        const tarPath = path.join(dictPath, tarFile);
        const { execSync } = await import("node:child_process");
        const sevenZip = "C:\\Program Files\\7-Zip\\7z.exe";
        try {
          execSync(`"${sevenZip}" x -y "${tarPath}" -o"${dictPath}"`, { cwd: dictPath });
          fs.unlinkSync(tarPath);
        } catch (e) {
          console.error("[DictionaryManager] Error extracting tar:", e);
        }
      }

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