import {
  createMemoryLanguageLearningRepository,
  type MemoryLanguageLearningRepository,
} from "../../core/language-learning/memoryRepository";
import { createRepositoryLearningClient, type RepositoryLearningHost } from "../../features/language-learning/repositoryLearningClient";
import type { LearningClient } from "../../features/language-learning/learningClient";
import { translateWithMyMemory } from "../../features/language-learning/myMemory";
import type { LearningBridge } from "../../platform";
import { openLearningDatabase, type LearningDatabase } from "../../platform/web/learningDatabase";
import { fetchBytes, nativeFetch } from "./mobileHttp";
import toast from "react-hot-toast";
import { translate } from "../../i18n";
import { pickBackupJson, VOCABULARY_BACKUP_ROOT, writeVocabularyBackup, writeVocabularyExport } from "./vocabularyBackups";

/**
 * Mobile language-learning runtime: the vocabulary repository (memory +
 * IndexedDB journal), automatic JSON backups and the dictionary bridge.
 * Everything is created lazily the first time the learning reader is used.
 */

interface Runtime {
  repository: MemoryLanguageLearningRepository;
  database: LearningDatabase;
}

let runtime: Promise<Runtime> | null = null;

function loadRuntime(): Promise<Runtime> {
  if (!runtime) {
    runtime = (async () => {
      const database = await openLearningDatabase();
      const initial = await database.load();
      const repository = createMemoryLanguageLearningRepository({ initial, onChange: (changes) => database.apply(changes) });
      return { repository, database };
    })();
    runtime.catch(() => {
      runtime = null;
    });
  }
  return runtime;
}

const BACKUP_DELAY_MS = 20_000;
const backupTimers = new Map<string, number>();

async function backupNow(userId: string) {
  const timer = backupTimers.get(userId);
  if (timer) window.clearTimeout(timer);
  backupTimers.delete(userId);
  const { repository } = await loadRuntime();
  await writeVocabularyBackup(userId, repository.exportUserData(userId));
}

function scheduleBackup(userId: string) {
  if (backupTimers.has(userId)) return;
  backupTimers.set(userId, window.setTimeout(() => {
    void backupNow(userId).catch((error: unknown) => console.error("[Vocabulary] backup failed", error));
  }, BACKUP_DELAY_MS));
}

// Leaving the app (home button, switching apps) writes pending backups right away.
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "hidden") return;
    for (const userId of [...backupTimers.keys()]) void backupNow(userId).catch(() => undefined);
  });
}

const host: RepositoryLearningHost = {
  repository: async () => (await loadRuntime()).repository,
  flush: async () => (await loadRuntime()).database.flush(),
  afterWrite: scheduleBackup,
  saveBackupFile: (userId, backup) => writeVocabularyExport(userId, backup),
  pickBackupFile: pickBackupJson,
  // Android has no "open folder" intent for app documents; say where the copies are.
  openBackupsFolder: async (userId) => {
    await backupNow(userId).catch(() => undefined);
    toast(translate("mobile:learning.backupsLocation", { path: `Documents/${VOCABULARY_BACKUP_ROOT}` }), { duration: 6000 });
    return null;
  },
};

const clients = new Map<string, LearningClient>();

export function getMobileLearningClient(userId: string): LearningClient {
  let client = clients.get(userId);
  if (!client) {
    client = createRepositoryLearningClient(host, userId);
    clients.set(userId, client);
  }
  return client;
}

/** Counts per language for the profile screen. */
export async function vocabularySummary(userId: string) {
  const { repository } = await loadRuntime();
  const backup = repository.exportUserData(userId);
  const byLanguage = new Map<string, { known: number; learning: number }>();
  for (const record of backup.knowledge) {
    const entry = byLanguage.get(record.language) ?? { known: 0, learning: 0 };
    if (record.state === "known") entry.known += 1;
    if (record.state === "learning") entry.learning += 1;
    byLanguage.set(record.language, entry);
  }
  return [...byLanguage.entries()].map(([language, counts]) => ({ language, ...counts })).filter((entry) => entry.known + entry.learning > 0);
}

export { backupNow as backupVocabularyNow };

let dictionaries: Promise<LearningBridge> | null = null;
function dictionaryStore() {
  if (!dictionaries) {
    // Loaded on demand: the catalog snapshot and archive codecs are not needed at startup.
    dictionaries = import("../../platform/web/dictionaryStore").then(({ createDictionaryStore }) => createDictionaryStore({ fetchBytes }));
    dictionaries.catch(() => {
      dictionaries = null;
    });
  }
  return dictionaries;
}

/** Registered as the platform learning bridge; the dictionary database opens on first use. */
export const mobileLearningBridge: LearningBridge = {
  dictionaryGetIndex: async () => (await dictionaryStore()).dictionaryGetIndex(),
  dictionaryLookup: async (word, dictId) => (await dictionaryStore()).dictionaryLookup(word, dictId),
  dictionaryDownload: async (id) => (await dictionaryStore()).dictionaryDownload(id),
  dictionaryDelete: async (id) => (await dictionaryStore()).dictionaryDelete?.(id) ?? false,
  onDictionaryDownloadProgress(callback) {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    void dictionaryStore().then((store) => {
      if (!cancelled) unsubscribe = store.onDictionaryDownloadProgress?.(callback);
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  },
  async languageLearningTranslateOnline(text, source, target) {
    try {
      return { success: true, translation: await translateWithMyMemory(text, source, target, nativeFetch) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  },
};
