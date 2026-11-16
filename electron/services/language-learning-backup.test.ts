// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LEARNING_BACKUP_SCHEMA, type LanguageLearningRepository, type LearningBackup } from "../../src/core/language-learning/model";
import { createLearningBackupService, isLearningBackup } from "./language-learning-backup";

function backupWith(words: number): LearningBackup {
  return {
    schema: LEARNING_BACKUP_SCHEMA,
    version: 1,
    exportedAt: "2026-11-15T00:00:00.000Z",
    knowledge: Array.from({ length: words }, (_, index) => ({ language: "fr", key: `mot${index}`, state: "learning", label: `mot${index}` })) as never,
    forms: [],
    reviewItems: [],
    reviewLog: [],
    annotations: [],
    readingStates: [],
  };
}

function repositoryReturning(getBackup: () => LearningBackup) {
  return { exportUserData: () => getBackup() } as unknown as LanguageLearningRepository;
}

describe("vocabulary backups", () => {
  it("mirrors every backup to the extra folder with the same daily rotation", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "lyceum-backup-"));
    const mirror = path.join(root, "Drive");
    fs.mkdirSync(mirror);
    let day = "2026-11-01";
    const service = createLearningBackupService({
      repository: repositoryReturning(() => backupWith(3)),
      directory: path.join(root, "local"),
      mirrorDirectory: () => mirror,
      today: () => day,
    });

    for (let index = 1; index <= 32; index += 1) {
      day = `2026-11-${String(index).padStart(2, "0")}`.replace("2026-11-31", "2026-12-01").replace("2026-11-32", "2026-12-02");
      service.writeBackup("user-1");
    }

    const mirrored = path.join(mirror, "lyceum-vocabulario", "user-1");
    const latest = JSON.parse(fs.readFileSync(path.join(mirrored, "latest.json"), "utf8"));
    expect(isLearningBackup(latest)).toBe(true);
    expect(latest.knowledge).toHaveLength(3);
    const daily = fs.readdirSync(mirrored).filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name));
    expect(daily).toHaveLength(30);

    const status = service.status("user-1");
    expect(status.mirrorDirectory).toBe(mirror);
    expect(status.lastBackupAt).toBeGreaterThan(0);
    expect(status.lastMirrorAt).toBeGreaterThan(0);
    expect(status.dailyCopies).toBe(30);
    expect(status.mirrorError).toBeNull();
  });

  it("keeps the local backup when the extra folder is unavailable", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "lyceum-backup-"));
    const blocker = path.join(root, "not-a-folder");
    fs.writeFileSync(blocker, "file in the way");
    const service = createLearningBackupService({
      repository: repositoryReturning(() => backupWith(2)),
      directory: path.join(root, "local"),
      mirrorDirectory: () => blocker,
    });

    const latest = service.writeBackup("user-1");
    expect(latest && fs.existsSync(latest)).toBe(true);
    const status = service.status("user-1");
    expect(status.lastBackupAt).toBeGreaterThan(0);
    expect(status.lastMirrorAt).toBeNull();
    expect(status.mirrorError).toBeTruthy();
  });

  it("never overwrites existing backups with an empty database", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "lyceum-backup-"));
    const mirror = path.join(root, "Drive");
    let current = backupWith(5);
    const service = createLearningBackupService({
      repository: repositoryReturning(() => current),
      directory: path.join(root, "local"),
      mirrorDirectory: () => mirror,
    });
    service.writeBackup("user-1");
    current = backupWith(0);
    expect(service.writeBackup("user-1")).toBeNull();

    for (const folder of [path.join(root, "local", "user-1"), path.join(mirror, "lyceum-vocabulario", "user-1")]) {
      const latest = JSON.parse(fs.readFileSync(path.join(folder, "latest.json"), "utf8"));
      expect(latest.knowledge).toHaveLength(5);
    }
  });

  it("reports no mirror when none is configured", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "lyceum-backup-"));
    const service = createLearningBackupService({
      repository: repositoryReturning(() => backupWith(1)),
      directory: path.join(root, "local"),
    });
    expect(service.status("user-1")).toMatchObject({ mirrorDirectory: null, lastBackupAt: null, lastMirrorAt: null, dailyCopies: 0 });
  });
});
