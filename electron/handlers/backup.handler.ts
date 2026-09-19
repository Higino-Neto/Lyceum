import type { IpcMain } from "electron";
import type { HabitRepository } from "../../src/core/habits/model";
import type { CategoryRepository } from "../../src/core/library/category";
import {
  backupAllCategories,
  backupAllDocuments,
  backupAllHabits,
  clearBackupSession,
  initBackupClient,
  setBackupSession,
  type BackupDocumentCategory,
  type BackupDocumentInput,
} from "../backup";

export interface BackupDataSource {
  listDocuments(): BackupDocumentInput[];
  listDocumentCategories(): BackupDocumentCategory[];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function failedBackup(error: unknown) {
  return { success: 0, failed: 0, errors: [errorMessage(error)] };
}

export function registerBackupHandlers(
  ipcMain: IpcMain,
  habits: HabitRepository,
  categories: CategoryRepository,
  dataSource: BackupDataSource,
) {
  ipcMain.handle("backup:init", (_, supabaseUrl: string, supabaseAnonKey: string) => {
    try {
      initBackupClient(supabaseUrl, supabaseAnonKey);
      console.log("[Backup] Supabase client initialized");
      return { success: true };
    } catch (error) {
      console.error("[Backup] Error initializing:", error);
      return { success: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle("backup:set-session", async (_, accessToken: string, refreshToken: string) => {
    try {
      return await setBackupSession(accessToken, refreshToken);
    } catch (error) {
      console.error("[Backup] Error setting session:", error);
      return { success: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle("backup:clear-session", async () => {
    try {
      return await clearBackupSession();
    } catch (error) {
      console.error("[Backup] Error clearing session:", error);
      return { success: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle("backup:all-documents", async () => {
    try {
      const result = await backupAllDocuments(dataSource.listDocuments());
      console.log(`[Backup] Completed: ${result.success} succeeded, ${result.failed} failed`);
      return result;
    } catch (error) {
      console.error("[Backup] Error:", error);
      return failedBackup(error);
    }
  });

  ipcMain.handle("backup:all-habits", async () => {
    try {
      const result = await backupAllHabits(
        habits.list(),
        habits.listAllCompletions(),
      );
      console.log(`[Backup] Habits completed: ${result.success} succeeded, ${result.failed} failed`);
      return result;
    } catch (error) {
      console.error("[Backup] Habits error:", error);
      return failedBackup(error);
    }
  });

  ipcMain.handle("backup:all-categories", async () => {
    try {
      const result = await backupAllCategories(
        categories.list(),
        dataSource.listDocumentCategories(),
      );
      console.log(`[Backup] Categories completed: ${result.success} succeeded, ${result.failed} failed`);
      return result;
    } catch (error) {
      console.error("[Backup] Categories error:", error);
      return failedBackup(error);
    }
  });
}
