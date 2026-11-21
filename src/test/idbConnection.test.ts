import { describe, expect, it, vi } from "vitest";
import { createIdbConnection, isConnectionError } from "../platform/web/idbConnection";

function closingError() {
  return Object.assign(new Error("Failed to execute 'transaction' on 'IDBDatabase': The database connection is closing."), { name: "InvalidStateError" });
}

function fakeDatabase(transaction: () => IDBTransaction) {
  return { transaction: vi.fn(transaction), close: vi.fn(), onclose: null, onversionchange: null } as unknown as IDBDatabase;
}

describe("self-healing IndexedDB connection", () => {
  it("reopens the database when the cached connection was closed by the WebView", async () => {
    const ok = {} as IDBTransaction;
    const closed = fakeDatabase(() => {
      throw closingError();
    });
    const fresh = fakeDatabase(() => ok);
    const open = vi.fn().mockResolvedValueOnce(closed).mockResolvedValueOnce(fresh);
    const connection = createIdbConnection(open);
    await expect(connection.transaction("knowledge", "readwrite")).resolves.toBe(ok);
    expect(open).toHaveBeenCalledTimes(2);
    expect(closed.close).toHaveBeenCalled();
  });

  it("replays work interrupted by a lost connection once", async () => {
    const db = fakeDatabase(() => ({}) as IDBTransaction);
    const connection = createIdbConnection(vi.fn().mockResolvedValue(db));
    let attempts = 0;
    const result = await connection.run(async (transaction) => {
      await transaction("knowledge");
      attempts += 1;
      if (attempts === 1) throw Object.assign(new Error("Internal error"), { name: "UnknownError" });
      return "saved";
    });
    expect(result).toBe("saved");
    expect(attempts).toBe(2);
  });

  it("does not retry other failures such as a full disk", async () => {
    const connection = createIdbConnection(vi.fn().mockResolvedValue(fakeDatabase(() => ({}) as IDBTransaction)));
    const quota = Object.assign(new Error("quota"), { name: "QuotaExceededError" });
    let attempts = 0;
    await expect(connection.run(async () => {
      attempts += 1;
      throw quota;
    })).rejects.toBe(quota);
    expect(attempts).toBe(1);
    expect(isConnectionError(quota)).toBe(false);
  });

  it("forgets a connection the browser closes", async () => {
    const first = fakeDatabase(() => ({}) as IDBTransaction);
    const second = fakeDatabase(() => ({}) as IDBTransaction);
    const open = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    const connection = createIdbConnection(open);
    await connection.transaction("meta");
    (first as unknown as { onclose: () => void }).onclose();
    await connection.transaction("meta");
    expect(open).toHaveBeenCalledTimes(2);
  });
});
