import type { IpcMain } from "electron";
import {
  backupAllCategories,
  backupAllDocuments,
  backupAllHabits,
  clearBackupSession,
  initBackupClient,
  setBackupSession,
} from "../backup";
import {
  getAllCategories,
  getAllDocumentCategories,
  getDocumentsForBackup,
} from "../local-database";
import { sqliteHabitRepository } from "../infrastructure/sqlite-habit-repository";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function failedBackup(error: unknown) {
  return { success: 0, failed: 0, errors: [errorMessage(error)] };
}

export function registerBackupHandlers(ipcMain: IpcMain) {
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
      const result = await backupAllDocuments(getDocumentsForBackup());
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
        sqliteHabitRepository.list(),
        sqliteHabitRepository.listAllCompletions(),
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
        getAllCategories(),
        getAllDocumentCategories(),
      );
      console.log(`[Backup] Categories completed: ${result.success} succeeded, ${result.failed} failed`);
      return result;
    } catch (error) {
      console.error("[Backup] Categories error:", error);
      return failedBackup(error);
    }
  });
}
