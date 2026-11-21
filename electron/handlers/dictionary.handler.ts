import type { BrowserWindow, IpcMain } from "electron";
import { dictionaryManager } from "../dictionary-manager";
import { closeAllStorage } from "../dictionary-storage";
import { quickLookup } from "../lookup-engine";
import { nonEmptyString } from "../ipc/validation";
import { dictionaryPackManager } from "../dictionary-packs";
import { packLanguageFromId } from "../../src/core/dictionary-packs";

/** Wiktionary packs are listed first: they cover every pack language pair. */
async function withPacks<T>(dictionaries: T[]) {
  try {
    return [...(await dictionaryPackManager.catalog()), ...dictionaries];
  } catch (error) {
    console.error("[DictionaryPacks] catalog failed:", error);
    return dictionaries;
  }
}

export function registerDictionaryHandlers(
  ipcMain: IpcMain,
  getWindow: () => BrowserWindow | null,
) {
  ipcMain.handle("dictionary:get-index", async () =>
    withPacks((await dictionaryManager.loadLocalIndex()).dictionaries));

  ipcMain.handle("dictionary:fetch-index", async () =>
    withPacks((await dictionaryManager.fetchIndex()).dictionaries));

  ipcMain.handle("dictionary:download", async (_, dictId: string) => {
    try {
      const validDictionaryId = nonEmptyString(dictId, "dictId", 80);
      const packLanguage = packLanguageFromId(validDictionaryId);
      if (packLanguage) {
        await dictionaryPackManager.download(packLanguage, (progress) => {
          getWindow()?.webContents.send("dictionary:download-progress", { dictId: validDictionaryId, progress });
        });
        return { success: true };
      }
      await dictionaryManager.downloadDictionary(validDictionaryId, (progress) => {
        getWindow()?.webContents.send("dictionary:download-progress", {
          dictId: validDictionaryId,
          progress,
        });
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle("dictionary:delete", async (_, dictId: string) => {
    const packLanguage = packLanguageFromId(nonEmptyString(dictId, "dictId", 80));
    if (packLanguage) return { success: dictionaryPackManager.delete(packLanguage) };
    closeAllStorage();
    return {
      success: await dictionaryManager.deleteDictionary(nonEmptyString(dictId, "dictId", 80)),
    };
  });

  ipcMain.handle("dictionary:lookup", async (_, word: string, dictId = "eng-por") => {
    try {
      return await quickLookup(
        nonEmptyString(word, "word", 256),
        nonEmptyString(dictId, "dictId", 80),
      );
    } catch (error) {
      // Logged so a broken offline dictionary is visible in "Open logs"
      // instead of silently falling back to the online translator.
      console.error(`[Dictionary] Lookup failed in ${dictId}:`, error);
      return {
        found: false,
        word,
        lemma: word,
        content: "",
        source: "fallback" as const,
        error: String(error),
      };
    }
  });

  ipcMain.handle("dictionary:pack-lookup", async (_, word: unknown, lang: unknown, target: unknown, lemmaHint: unknown) => {
    const validWord = nonEmptyString(word, "word", 256);
    const validLang = nonEmptyString(lang, "lang", 12);
    try {
      return await dictionaryPackManager.lookup(
        validWord,
        validLang,
        typeof target === "string" ? target.slice(0, 12) : "",
        typeof lemmaHint === "string" ? lemmaHint.slice(0, 256) : null,
      );
    } catch (error) {
      console.error(`[DictionaryPacks] Lookup failed in ${validLang}:`, error);
      return { found: false, query: validWord, lang: validLang, target: "", entries: [], error: String(error) };
    }
  });

  ipcMain.handle("dictionary:get-info", (_, dictId: string) =>
    dictionaryManager.getDictionaryInfo(nonEmptyString(dictId, "dictId", 80)) ?? null);
}
