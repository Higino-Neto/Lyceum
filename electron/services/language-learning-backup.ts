import fs from "node:fs";
import path from "node:path";
import {
  LEARNING_BACKUP_SCHEMA,
  type LanguageLearningRepository,
  type LearningBackup,
} from "../../src/core/language-learning/model";

export interface LearningBackupService {
  /** Debounced backup after a change. */
  schedule(userId: string): void;
  /** Writes pending backups now (app quit). */
  flush(): void;
  directoryFor(userId: string): string;
  writeBackup(userId: string): string | null;
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
export function createLearningBackupService(options: {
  repository: LanguageLearningRepository;
  directory: string;
  delayMs?: number;
  today?: () => string;
}): LearningBackupService {
  const pending = new Map<string, NodeJS.Timeout>();
  const delay = options.delayMs ?? 4000;
  const today = options.today ?? (() => new Date().toISOString().slice(0, 10));

  const directoryFor = (userId: string) => path.join(options.directory, safeSegment(userId));

  const writeBackup = (userId: string): string | null => {
    const backup = options.repository.exportUserData(userId);
    if (entryCount(backup) === 0) return null;
    const directory = directoryFor(userId);
    fs.mkdirSync(directory, { recursive: true });
    const content = JSON.stringify(backup);
    const latest = path.join(directory, "latest.json");
    writeAtomic(latest, content);
    writeAtomic(path.join(directory, `${today()}.json`), content);
    const daily = fs.readdirSync(directory).filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name)).sort();
    for (const old of daily.slice(0, Math.max(0, daily.length - DAILY_COPIES))) {
      fs.rmSync(path.join(directory, old), { force: true });
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
  };
}
