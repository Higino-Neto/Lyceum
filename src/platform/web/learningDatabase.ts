import type { LearningRowChange, LearningRows, LearningStoreName } from "../../core/language-learning/memoryRepository";

/**
 * IndexedDB persistence for the in-memory learning repository (WebView builds).
 *
 * The repository reports every changed row; changes are written in order, one
 * IndexedDB transaction per batch, and `flush()` resolves only after the
 * browser reports the transaction as committed. The whole dataset is loaded
 * once at startup (vocabulary is tens of thousands of small rows at most).
 */

const DB_NAME = "lyceum-learning";
const DB_VERSION = 1;
export const LEARNING_STORES: LearningStoreName[] = ["knowledge", "forms", "reviewItems", "reviewLog", "annotations", "readingStates"];

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
  });
}

export interface LearningDatabase {
  load(): Promise<LearningRows>;
  apply(changes: LearningRowChange[]): void;
  /** Resolves when every change applied so far is committed. Rejects if one failed. */
  flush(): Promise<void>;
  close(): void;
}

export async function openLearningDatabase(factory: IDBFactory = indexedDB): Promise<LearningDatabase> {
  const request = factory.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    const db = request.result;
    for (const store of LEARNING_STORES) {
      if (!db.objectStoreNames.contains(store)) db.createObjectStore(store);
    }
  };
  const db = await promisify(request);
  // Ask the browser not to evict this origin's data under storage pressure.
  void navigator.storage?.persist?.().catch(() => false);

  let queue: Promise<void> = Promise.resolve();
  let failure: unknown = null;

  return {
    async load() {
      const transaction = db.transaction(LEARNING_STORES, "readonly");
      const entries = await Promise.all(LEARNING_STORES.map((store) => promisify(transaction.objectStore(store).getAll())));
      const rows = Object.fromEntries(LEARNING_STORES.map((store, index) => [store, entries[index] ?? []]));
      return rows as unknown as LearningRows;
    },
    apply(changes) {
      if (changes.length === 0) return;
      const stores = [...new Set(changes.map((change) => change.store))];
      queue = queue.then(async () => {
        const transaction = db.transaction(stores, "readwrite");
        const done = transactionDone(transaction);
        for (const change of changes) {
          const store = transaction.objectStore(change.store);
          if (change.value === null) store.delete(change.id);
          else store.put(change.value, change.id);
        }
        await done;
      }).catch((error: unknown) => {
        failure = error;
        console.error("[LearningDatabase] write failed", error);
      });
    },
    async flush() {
      await queue;
      if (failure) {
        const error = failure;
        failure = null;
        throw error;
      }
    },
    close() {
      db.close();
    },
  };
}
