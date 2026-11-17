import { describe, expect, it } from "vitest";
import { createMemoryLanguageLearningRepository } from "../core/language-learning/memoryRepository";
import type { LearningBackup } from "../core/language-learning/model";
import { canReceive, parseTransferObjectName, transferObjectName } from "../features/device-sync/transferNames";
import { syncVocabulary, type VocabularySyncPort } from "../features/device-sync/vocabularySync";

describe("transfer object names", () => {
  it("round-trips unicode file names and sender info", () => {
    const name = transferObjectName({ fileName: "Le Petit Prince — édition 2.epub", platform: "desktop", deviceId: "abc123", sentAt: 1763400000000 });
    expect(name).toMatch(/^[A-Za-z0-9_.-]+$/);
    const parsed = parseTransferObjectName("uid/books", name, 42);
    expect(parsed).toEqual({
      path: `uid/books/${name}`,
      fileName: "Le Petit Prince — édition 2.epub",
      extension: "epub",
      sentAt: 1763400000000,
      platform: "desktop",
      deviceId: "abc123",
      size: 42,
    });
  });

  it("ignores foreign objects", () => {
    expect(parseTransferObjectName("uid/books", ".emptyFolderPlaceholder")).toBeNull();
    expect(parseTransferObjectName("uid/books", "notes.txt")).toBeNull();
  });

  it("filters by what each platform can open", () => {
    expect(canReceive("mobile", { extension: "epub" })).toBe(true);
    expect(canReceive("mobile", { extension: "azw3" })).toBe(false);
    expect(canReceive("desktop", { extension: "txt" })).toBe(false);
  });
});

function device(userId: string, clock: { now: string }) {
  const repository = createMemoryLanguageLearningRepository({ now: () => clock.now });
  return {
    repository,
    port(cloud: { snapshot: LearningBackup | null; uploads: number }): VocabularySyncPort {
      return {
        download: async () => (cloud.snapshot ? structuredClone(cloud.snapshot) : null),
        upload: async (backup) => {
          cloud.snapshot = structuredClone(backup);
          cloud.uploads += 1;
        },
        exportData: async () => repository.exportUserData(userId),
        importData: async (backup) => repository.importUserData(userId, backup),
      };
    },
  };
}

describe("vocabulary sync", () => {
  it("merges words learned on two devices and converges", async () => {
    const cloud = { snapshot: null as LearningBackup | null, uploads: 0 };
    const clock = { now: "2026-11-17T10:00:00.000Z" };
    const desktop = device("u1", clock);
    const phone = device("u1", clock);

    desktop.repository.setLemmaState("u1", { language: "fr", key: "maison", state: "known", label: "maison" });
    await syncVocabulary(desktop.port(cloud));

    clock.now = "2026-11-17T11:00:00.000Z";
    phone.repository.setLemmaState("u1", { language: "fr", key: "chat", state: "learning", label: "chat" });
    await syncVocabulary(phone.port(cloud));

    // The phone changed its mind about a word the desktop knew.
    clock.now = "2026-11-17T12:00:00.000Z";
    phone.repository.setLemmaState("u1", { language: "fr", key: "maison", state: "learning", label: "maison" });
    await syncVocabulary(phone.port(cloud));
    await syncVocabulary(desktop.port(cloud));

    const desktopWords = desktop.repository.loadKnowledge("u1", "fr").lemmas;
    expect(desktopWords.chat?.state).toBe("learning");
    expect(desktopWords.maison?.state).toBe("learning");
    expect(phone.repository.loadKnowledge("u1", "fr").lemmas.maison?.state).toBe("learning");
  });

  it("does not upload when nothing changed or nothing exists", async () => {
    const cloud = { snapshot: null as LearningBackup | null, uploads: 0 };
    const clock = { now: "2026-11-17T10:00:00.000Z" };
    const empty = device("u1", clock);
    expect(await syncVocabulary(empty.port(cloud))).toEqual({ pulled: null, pushed: false });

    empty.repository.setLemmaState("u1", { language: "de", key: "haus", state: "known", label: "Haus" });
    await syncVocabulary(empty.port(cloud));
    const result = await syncVocabulary(empty.port(cloud));
    expect(result.pushed).toBe(false);
    expect(cloud.uploads).toBe(1);
  });
});
