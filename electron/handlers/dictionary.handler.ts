import type { BrowserWindow, IpcMain } from "electron";
import { dictionaryManager } from "../dictionary-manager";
import { closeAllStorage } from "../dictionary-storage";
import { quickLookup } from "../lookup-engine";
import { nonEmptyString } from "../ipc/validation";

export function registerDictionaryHandlers(
  ipcMain: IpcMain,
  getWindow: () => BrowserWindow | null,
) {
  ipcMain.handle("dictionary:get-index", async () =>
    (await dictionaryManager.loadLocalIndex()).dictionaries);

  ipcMain.handle("dictionary:fetch-index", async () =>
    (await dictionaryManager.fetchIndex()).dictionaries);

  ipcMain.handle("dictionary:download", async (_, dictId: string) => {
    try {
      const validDictionaryId = nonEmptyString(dictId, "dictId", 80);
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

  ipcMain.handle("dictionary:get-info", (_, dictId: string) =>
    dictionaryManager.getDictionaryInfo(nonEmptyString(dictId, "dictId", 80)) ?? null);
}
