/**
 * A self-healing IndexedDB connection for the WebView builds.
 *
 * Android's WebView can close an origin's connections at any time (storage
 * pressure, backing-store errors, the app returning from the background). A
 * closed connection makes every later `transaction()` throw
 * "InvalidStateError: The database connection is closing", so a cached
 * connection must be reopened instead of reused forever.
 */

export function isConnectionError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const { name, message } = error as { name?: string; message?: string };
  return name === "InvalidStateError" || name === "UnknownError" || /connection is clos|database.*clos|backing store/i.test(message ?? "");
}

export interface IdbConnection {
  /** A transaction on a live connection, reopening the database if it was closed. */
  transaction(stores: string | string[], mode?: IDBTransactionMode): Promise<IDBTransaction>;
  /** Runs `work` and, if the connection was lost meanwhile, once more on a fresh one. */
  run<T>(work: (transaction: (stores: string | string[], mode?: IDBTransactionMode) => Promise<IDBTransaction>) => Promise<T>): Promise<T>;
  close(): void;
}

export function createIdbConnection(open: () => Promise<IDBDatabase>): IdbConnection {
  let current: Promise<IDBDatabase> | null = null;

  const connect = () => {
    if (!current) {
      const pending = open().then((db) => {
        const forget = () => {
          if (current === pending) current = null;
        };
        db.onclose = forget;
        db.onversionchange = () => {
          db.close();
          forget();
        };
        return db;
      });
      pending.catch(() => {
        if (current === pending) current = null;
      });
      current = pending;
    }
    return current;
  };

  const reset = () => {
    const stale = current;
    current = null;
    void stale?.then((db) => db.close()).catch(() => undefined);
  };

  const transaction = async (stores: string | string[], mode: IDBTransactionMode = "readonly") => {
    try {
      return (await connect()).transaction(stores, mode);
    } catch (error) {
      if (!isConnectionError(error)) throw error;
      reset();
      return (await connect()).transaction(stores, mode);
    }
  };

  return {
    transaction,
    async run(work) {
      try {
        return await work(transaction);
      } catch (error) {
        if (!isConnectionError(error)) throw error;
        reset();
        return work(transaction);
      }
    },
    close: reset,
  };
}

/** Readable cause for logs and error toasts (`QuotaExceededError`, …). */
export function describeStorageError(error: unknown) {
  if (error && typeof error === "object") {
    const { name, message } = error as { name?: string; message?: string };
    return [name, message].filter(Boolean).join(": ") || String(error);
  }
  return String(error);
}

export function isQuotaError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const { name, message } = error as { name?: string; message?: string };
  return name === "QuotaExceededError" || /quota|disk full|no space/i.test(message ?? "");
}
