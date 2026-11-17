import toast from "react-hot-toast";
import { translate } from "../../i18n";
import type { TranslationKey } from "../../i18n/keys";
import type { LearningClient } from "../language-learning/learningClient";
import {
  currentSyncUserId,
  DeviceSyncError,
  downloadIncomingBook,
  downloadVocabularySnapshot,
  listIncomingBooks,
  removeIncomingBook,
  sendBookToDevices,
  uploadVocabularySnapshot,
} from "./deviceSync";
import { canReceive, fileExtension, PORTABLE_BOOK_EXTENSIONS, type IncomingTransfer, type TransferPlatform } from "./transferNames";
import { syncVocabulary } from "./vocabularySync";

/**
 * Background device sync: receives books sent from the user's other devices
 * and keeps the vocabulary snapshot merged. One controller per app window.
 */
export type ReceiveOutcome = "imported" | "duplicate" | "failed";

export interface DeviceSyncHost {
  platform: TransferPlatform;
  learningClient(userId: string): LearningClient;
  /** Adds a received book to the local library. */
  receiveBook(file: File, transfer: IncomingTransfer): Promise<ReceiveOutcome>;
}

export interface DeviceSyncStatus {
  syncing: boolean;
  lastVocabularySync: string | null;
  error: string | null;
}

const BOOKS_INTERVAL_MS = 60_000;
const VOCABULARY_INTERVAL_MS = 3 * 60_000;
const LAST_SYNC_KEY = "lyceum:device-sync:last-vocabulary";

let status: DeviceSyncStatus = { syncing: false, lastVocabularySync: readLastSync(), error: null };
const listeners = new Set<(status: DeviceSyncStatus) => void>();

function readLastSync() {
  try {
    return localStorage.getItem(LAST_SYNC_KEY);
  } catch {
    return null;
  }
}

function setStatus(patch: Partial<DeviceSyncStatus>) {
  status = { ...status, ...patch };
  if (patch.lastVocabularySync) {
    try {
      localStorage.setItem(LAST_SYNC_KEY, patch.lastVocabularySync);
    } catch {
      /* per-device convenience only */
    }
  }
  for (const listener of listeners) listener(status);
}

export function getDeviceSyncStatus() {
  return status;
}

export function subscribeDeviceSyncStatus(listener: (status: DeviceSyncStatus) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function describeSyncError(error: unknown): string {
  if (error instanceof DeviceSyncError && error.code !== "STORAGE") return translate(`sync:errors.${error.code}` as TranslationKey);
  const message = error instanceof Error ? error.message : String(error);
  if (/bucket not found/i.test(message)) return translate("sync:errors.SETUP_REQUIRED");
  if (message === "FILE_NOT_FOUND" || message === "FILE_TOO_LARGE") return translate(`sync:errors.${message}` as TranslationKey);
  return message;
}

let host: DeviceSyncHost | null = null;
let running: Promise<void> | null = null;
let lastVocabularyRun = 0;

async function receiveBooks(activeHost: DeviceSyncHost) {
  const transfers = (await listIncomingBooks()).filter((transfer) => canReceive(activeHost.platform, transfer));
  for (const transfer of transfers) {
    try {
      const blob = await downloadIncomingBook(transfer);
      const file = new File([blob], transfer.fileName, { type: blob.type || "application/octet-stream" });
      const outcome = await activeHost.receiveBook(file, transfer);
      if (outcome === "failed") continue;
      await removeIncomingBook(transfer);
      if (outcome === "imported") {
        toast.success(translate("sync:receive.received", { device: translate(`sync:devices.${transfer.platform}` as TranslationKey), name: transfer.fileName }));
      } else {
        toast(translate("sync:receive.alreadyInLibrary", { name: transfer.fileName }));
      }
    } catch (error) {
      toast.error(translate("sync:receive.failed", { name: transfer.fileName, error: describeSyncError(error) }));
    }
  }
}

async function syncLearning(activeHost: DeviceSyncHost, userId: string) {
  const client = activeHost.learningClient(userId);
  await syncVocabulary({
    download: downloadVocabularySnapshot,
    upload: uploadVocabularySnapshot,
    exportData: () => client.exportData(),
    importData: (backup) => client.importData(backup),
  });
  lastVocabularyRun = Date.now();
  setStatus({ lastVocabularySync: new Date().toISOString() });
}

/** Runs one sync pass; concurrent calls share the pass in flight. */
export function runDeviceSync(options: { vocabulary?: "auto" | "force" } = {}): Promise<void> {
  const activeHost = host;
  if (!activeHost) return Promise.resolve();
  if (running) return running;
  running = (async () => {
    const userId = await currentSyncUserId();
    if (!userId) return;
    setStatus({ syncing: true, error: null });
    try {
      await receiveBooks(activeHost);
      const vocabularyDue = options.vocabulary === "force" || Date.now() - lastVocabularyRun >= VOCABULARY_INTERVAL_MS;
      if (vocabularyDue) await syncLearning(activeHost, userId);
    } catch (error) {
      setStatus({ error: describeSyncError(error) });
      if (options.vocabulary === "force") throw error;
      console.warn("[DeviceSync]", error);
    } finally {
      setStatus({ syncing: false });
    }
  })().finally(() => {
    running = null;
  });
  return running;
}

/** Starts background sync for this window; returns a stop function. */
export function startDeviceSync(nextHost: DeviceSyncHost): () => void {
  host = nextHost;
  lastVocabularyRun = 0;
  const tick = () => void runDeviceSync().catch(() => undefined);
  const flushVocabulary = () => void runDeviceSync({ vocabulary: "force" }).catch(() => undefined);
  const onVisibility = () => {
    // Leaving the app pushes what was studied; coming back pulls the rest.
    if (document.visibilityState === "hidden") flushVocabulary();
    else tick();
  };
  tick();
  const timer = window.setInterval(tick, BOOKS_INTERVAL_MS);
  window.addEventListener("focus", tick);
  document.addEventListener("visibilitychange", onVisibility);
  return () => {
    window.clearInterval(timer);
    window.removeEventListener("focus", tick);
    document.removeEventListener("visibilitychange", onVisibility);
    if (host === nextHost) host = null;
  };
}

export interface OutgoingBook {
  fileName: string;
  load(): Promise<Uint8Array | Blob>;
}

/** Sends books to the user's other devices, with progress and per-book errors. */
export async function sendBooksToDevices(platform: TransferPlatform, books: OutgoingBook[]): Promise<number> {
  const portable = books.filter((book) => {
    const supported = (PORTABLE_BOOK_EXTENSIONS as readonly string[]).includes(fileExtension(book.fileName));
    if (!supported) toast.error(translate("sync:send.unsupportedFormat", { name: book.fileName }), { duration: 7000 });
    return supported;
  });
  if (!portable.length) return 0;
  const toastId = toast.loading(translate("sync:send.sending", { current: 1, total: portable.length, name: portable[0]?.fileName ?? "" }));
  let sent = 0;
  try {
    for (const [index, book] of portable.entries()) {
      toast.loading(translate("sync:send.sending", { current: index + 1, total: portable.length, name: book.fileName }), { id: toastId });
      try {
        const bytes = await book.load();
        const contentType = fileExtension(book.fileName) === "pdf" ? "application/pdf" : "application/epub+zip";
        await sendBookToDevices({ fileName: book.fileName, bytes, contentType, platform });
        sent += 1;
      } catch (error) {
        if (error instanceof DeviceSyncError && error.code !== "STORAGE") {
          toast.error(describeSyncError(error));
          break;
        }
        toast.error(translate("sync:send.failed", { name: book.fileName, error: describeSyncError(error) }));
      }
    }
  } finally {
    toast.dismiss(toastId);
  }
  if (sent) toast.success(translate("sync:send.sent", { count: sent }), { duration: 6000 });
  return sent;
}
