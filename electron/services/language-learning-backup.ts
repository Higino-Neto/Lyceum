import fs from "node:fs";
import path from "node:path";
import {
  LEARNING_BACKUP_SCHEMA,
  type LanguageLearningRepository,
  type LearningBackup,
} from "../../src/core/language-learning/model";

export interface LearningBackupStatus {
  directory: string;
  /** Extra folder (e.g. a synced cloud folder) that mirrors every backup. */
  mirrorDirectory: string | null;
  /** When latest.json was last written (ms), or null if never. */
  lastBackupAt: number | null;
  /** When the mirror copy was last written (ms), or null. */
  lastMirrorAt: number | null;
  /** Error of the last mirror write, if it failed (folder missing, offline drive...). */
  mirrorError: string | null;
  dailyCopies: number;
}

export interface LearningBackupService {
  /** Debounced backup after a change. */
  schedule(userId: string): void;
  /** Writes pending backups now (app quit). */
  flush(): void;
  directoryFor(userId: string): string;
  writeBackup(userId: string): string | null;
  status(userId: string): LearningBackupStatus;
}

const DAILY_COPIES = 30;

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "user";
}

function writeAtomic(target: string, content: string) {
  const temporary = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, content, "utf8");
  fs.renameSync(temporary, target);
}

function entryCount(backup: Pick<LearningBackup, "knowledge" | "reviewItems">) {
  return backup.knowledge.length + backup.reviewItems.length;
}

export function isLearningBackup(value: unknown): value is LearningBackup {
  const candidate = value as Partial<LearningBackup> | null;
  return Boolean(
    candidate
    && candidate.schema === LEARNING_BACKUP_SCHEMA
    && candidate.version === 1
    && Array.isArray(candidate.knowledge)
    && Array.isArray(candidate.forms)
    && Array.isArray(candidate.reviewItems)
    && Array.isArray(candidate.reviewLog)
    && Array.isArray(candidate.annotations)
    && Array.isArray(candidate.readingStates),
  );
}

/**
 * Automatic JSON backups of the learning data, outside the database:
 * `latest.json` plus one copy per day (last 30 days). An empty export never
 * overwrites a backup, so a lost or reset database cannot erase them.
 */
function writeCopies(directory: string, content: string, day: string): string {
  fs.mkdirSync(directory, { recursive: true });
  const latest = path.join(directory, "latest.json");
  writeAtomic(latest, content);
  writeAtomic(path.join(directory, `${day}.json`), content);
  const daily = fs.readdirSync(directory).filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name)).sort();
  for (const old of daily.slice(0, Math.max(0, daily.length - DAILY_COPIES))) {
    fs.rmSync(path.join(directory, old), { force: true });
  }
  return latest;
}

function modifiedAt(file: string): number | null {
  try {
    return fs.statSync(file).mtimeMs;
  } catch {
    return null;
  }
}

export function createLearningBackupService(options: {
  repository: LanguageLearningRepository;
  directory: string;
  /**
   * Extra folder that receives the same backups (latest + daily copies), so
   * the vocabulary survives the loss of the app folder or of the whole disk
   * when it points to a synced/cloud or external folder.
   */
  mirrorDirectory?: () => string | null;
  delayMs?: number;
  today?: () => string;
}): LearningBackupService {
  const pending = new Map<string, NodeJS.Timeout>();
  const mirrorErrors = new Map<string, string>();
  const delay = options.delayMs ?? 4000;
  const today = options.today ?? (() => new Date().toISOString().slice(0, 10));

  const directoryFor = (userId: string) => path.join(options.directory, safeSegment(userId));
  const mirrorFor = (userId: string) => {
    const root = options.mirrorDirectory?.();
    return root ? path.join(root, "lyceum-vocabulario", safeSegment(userId)) : null;
  };

  const writeBackup = (userId: string): string | null => {
    const backup = options.repository.exportUserData(userId);
    if (entryCount(backup) === 0) return null;
    const content = JSON.stringify(backup);
    const day = today();
    const latest = writeCopies(directoryFor(userId), content, day);
    const mirror = mirrorFor(userId);
    if (mirror) {
      // The mirror may be an unplugged drive or an offline cloud folder: a
      // failure there never blocks the local backup.
      try {
        writeCopies(mirror, content, day);
        mirrorErrors.delete(userId);
      } catch (error) {
        mirrorErrors.set(userId, error instanceof Error ? error.message : String(error));
        console.error("[LanguageLearning] Mirror backup failed:", error);
      }
    }
    return latest;
  };

  const run = (userId: string) => {
    pending.delete(userId);
    try {
      writeBackup(userId);
    } catch (error) {
      console.error("[LanguageLearning] Backup failed:", error);
    }
  };

  return {
    schedule(userId) {
      const existing = pending.get(userId);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => run(userId), delay);
      timer.unref?.();
      pending.set(userId, timer);
    },
    flush() {
      for (const [userId, timer] of [...pending]) {
        clearTimeout(timer);
        run(userId);
      }
    },
    directoryFor,
    writeBackup,
    status(userId) {
      const directory = directoryFor(userId);
      const mirror = mirrorFor(userId);
      let dailyCopies = 0;
      try {
        dailyCopies = fs.readdirSync(directory).filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name)).length;
      } catch {
        dailyCopies = 0;
      }
      return {
        directory,
        mirrorDirectory: options.mirrorDirectory?.() || null,
        lastBackupAt: modifiedAt(path.join(directory, "latest.json")),
        lastMirrorAt: mirror ? modifiedAt(path.join(mirror, "latest.json")) : null,
        mirrorError: mirrorErrors.get(userId) || null,
        dailyCopies,
      };
    },
  };
}
