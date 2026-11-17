import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import type { LearningBackup } from "../../core/language-learning/model";

/**
 * Automatic vocabulary backups outside the WebView storage, mirroring the
 * desktop rules: `latest.json` plus one file per day (last 30), never
 * overwritten by an empty export. They live in Documents/Lyceum/Vocabulario,
 * which survives clearing the app's data and can be copied to the computer.
 */

export const VOCABULARY_BACKUP_ROOT = "Lyceum/Vocabulario";
const KEEP_DAYS = 30;

function folderFor(userId: string) {
  return `${VOCABULARY_BACKUP_ROOT}/${userId.replace(/[^a-zA-Z0-9_-]/g, "_") || "local"}`;
}

function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function hasContent(backup: LearningBackup) {
  return backup.knowledge.length + backup.reviewItems.length + backup.annotations.length > 0;
}

async function writeText(path: string, data: string) {
  await Filesystem.writeFile({ path, data, directory: Directory.Documents, encoding: Encoding.UTF8, recursive: true });
}

/** Writes latest + daily copies; returns the latest path, or null when there is nothing to save. */
export async function writeVocabularyBackup(userId: string, backup: LearningBackup): Promise<string | null> {
  if (!hasContent(backup)) return null;
  const folder = folderFor(userId);
  const content = JSON.stringify(backup);
  if (!Capacitor.isNativePlatform()) {
    try {
      localStorage.setItem(`lyceum-vocabulary-backup:${userId}`, content);
    } catch {
      /* browser preview only */
    }
    return `localStorage:${userId}`;
  }
  await writeText(`${folder}/${today()}.json`, content);
  await writeText(`${folder}/latest.json`, content);
  try {
    const { files } = await Filesystem.readdir({ path: folder, directory: Directory.Documents });
    const daily = files.map((file) => file.name).filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name)).sort();
    for (const name of daily.slice(0, Math.max(0, daily.length - KEEP_DAYS))) {
      await Filesystem.deleteFile({ path: `${folder}/${name}`, directory: Directory.Documents }).catch(() => undefined);
    }
  } catch {
    /* pruning is best effort */
  }
  return `Documents/${folder}/latest.json`;
}

/** A manual export with a timestamped name (kept forever). */
export async function writeVocabularyExport(userId: string, backup: LearningBackup): Promise<string> {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const name = `lyceum-vocabulario-${stamp}.json`;
  const content = JSON.stringify(backup, null, 2);
  if (!Capacitor.isNativePlatform()) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([content], { type: "application/json" }));
    link.download = name;
    link.click();
    return name;
  }
  const path = `${folderFor(userId)}/${name}`;
  await writeText(path, content);
  return `Documents/${path}`;
}

/** Opens the system file picker for a backup JSON; resolves with its parsed content or null. */
export function pickBackupJson(): Promise<unknown | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    let settled = false;
    input.onchange = async () => {
      settled = true;
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(await file.text()));
      } catch {
        reject(new Error("INVALID_BACKUP"));
      }
    };
    // The picker gives no cancel event everywhere; focus returning without a file means cancel.
    window.addEventListener("focus", () => window.setTimeout(() => {
      if (!settled) resolve(null);
    }, 1500), { once: true });
    input.click();
  });
}
