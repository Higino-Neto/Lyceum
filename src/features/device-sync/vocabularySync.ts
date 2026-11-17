import type { LearningBackup, LearningImportResult } from "../../core/language-learning/model";

/**
 * Two-way vocabulary sync over a single shared snapshot. Each device pulls the
 * snapshot, merges it into its local repository (newest `updatedAt` wins per
 * record), and pushes the merged result back. If two devices push at the same
 * time, the loser still holds its changes locally and re-adds them on its next
 * sync, so all devices converge.
 */
export interface VocabularySyncPort {
  download(): Promise<LearningBackup | null>;
  upload(backup: LearningBackup): Promise<void>;
  exportData(): Promise<LearningBackup>;
  importData(backup: LearningBackup): Promise<LearningImportResult>;
}

export interface VocabularySyncResult {
  pulled: LearningImportResult | null;
  pushed: boolean;
}

function isEmpty(backup: LearningBackup) {
  return backup.knowledge.length === 0
    && backup.forms.length === 0
    && backup.reviewItems.length === 0
    && backup.annotations.length === 0
    && backup.readingStates.length === 0;
}

/** Content fingerprint that ignores export time and record order. */
export function backupFingerprint(backup: LearningBackup): string {
  const sorted = (rows: unknown[]) => rows.map((row) => JSON.stringify(row)).sort();
  return JSON.stringify([
    sorted(backup.knowledge),
    sorted(backup.forms),
    sorted(backup.reviewItems),
    sorted(backup.reviewLog),
    sorted(backup.annotations),
    sorted(backup.readingStates),
  ]);
}

export async function syncVocabulary(port: VocabularySyncPort): Promise<VocabularySyncResult> {
  const remote = await port.download();
  const pulled = remote ? await port.importData(remote) : null;
  const merged = await port.exportData();
  if (isEmpty(merged)) return { pulled, pushed: false };
  if (remote && backupFingerprint(remote) === backupFingerprint(merged)) return { pulled, pushed: false };
  await port.upload(merged);
  return { pulled, pushed: true };
}
