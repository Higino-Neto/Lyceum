import { describe, expect, it, vi } from "vitest";
import { createMemoryLanguageLearningRepository } from "../../core/language-learning/memoryRepository";
import { createRepositoryLearningClient } from "../../features/language-learning/repositoryLearningClient";

function setup() {
  const repository = createMemoryLanguageLearningRepository();
  const order: string[] = [];
  const host = {
    repository: vi.fn(async () => repository),
    flush: vi.fn(async () => { order.push("flush"); }),
    afterWrite: vi.fn(() => { order.push("afterWrite"); }),
    saveBackupFile: vi.fn(async (_userId: string, _backup: unknown) => "Documents/Lyceum/Vocabulario/u/x.json"),
    pickBackupFile: vi.fn(async (): Promise<unknown> => null),
  };
  return { repository, host, order, client: createRepositoryLearningClient(host, "u") };
}

describe("repository learning client (mobile)", () => {
  it("resolves a write only after it is flushed, then schedules the automatic backup", async () => {
    const { client, order, host } = setup();
    const saved = await client.setLemmaState({ language: "fr", key: "maison", state: "learning", label: "maison" });
    expect(saved.state).toBe("learning");
    expect(order).toEqual(["flush", "afterWrite"]);
    expect(host.afterWrite).toHaveBeenCalledWith("u");
    expect((await client.loadKnowledge("fr")).lemmas.maison?.state).toBe("learning");
  });

  it("does not report a write as saved when persistence fails", async () => {
    const { client, host } = setup();
    host.flush.mockRejectedValueOnce(new Error("QuotaExceededError"));
    await expect(client.setLemmaState({ language: "fr", key: "chat", state: "known", label: "chat" })).rejects.toThrow("QuotaExceededError");
    expect(host.afterWrite).not.toHaveBeenCalled();
  });

  it("imports desktop backups and rejects other files", async () => {
    const { client, host } = setup();
    host.pickBackupFile.mockResolvedValueOnce({ hello: "world" });
    expect(await client.importBackup()).toEqual({ success: false, error: "INVALID_BACKUP" });

    host.pickBackupFile.mockResolvedValueOnce({
      schema: "lyceum.learning-backup", version: 1, exportedAt: "2026-11-16T00:00:00.000Z",
      knowledge: [{ language: "fr", key: "jour", state: "known", label: "jour", translation: "dia", note: null, lookupCount: 2, updatedAt: "2026-11-15T00:00:00.000Z" }],
      forms: [], reviewItems: [], reviewLog: [], annotations: [], readingStates: [],
    });
    expect(await client.importBackup()).toMatchObject({ success: true, knowledge: 1 });
    expect((await client.loadKnowledge("fr")).lemmas.jour).toMatchObject({ state: "known", translation: "dia" });

    host.pickBackupFile.mockResolvedValueOnce(null);
    expect(await client.importBackup()).toEqual({ success: false, error: "CANCELLED" });
  });

  it("exports through the host", async () => {
    const { client, host } = setup();
    await client.setLemmaState({ language: "fr", key: "nuit", state: "known", label: "nuit" });
    expect(await client.exportBackup()).toEqual({ success: true, path: "Documents/Lyceum/Vocabulario/u/x.json" });
    expect(host.saveBackupFile.mock.calls[0]?.[1]).toMatchObject({ knowledge: [expect.objectContaining({ key: "nuit" })] });
  });
});
