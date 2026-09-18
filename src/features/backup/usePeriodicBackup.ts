import { useEffect, useRef } from "react";
import type { Session } from "@supabase/supabase-js";
import type { AppSettings } from "../../contexts/AppSettingsContext";
import { getSupabaseConfig, supabase } from "../../lib/supabase";

const BACKUP_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
const BACKUP_START_DELAY_MS = 30_000;
const LAST_BACKUP_KEY = "lyceum:last-periodic-backup";

type BackupSettings = Pick<
  AppSettings,
  | "weeklyBackupEnabled"
  | "backupDocuments"
  | "backupHabits"
  | "backupCategories"
>;

interface BackupResult {
  success: number;
  failed: number;
  errors: string[];
}

/** Keeps the native backup client aligned with the active Supabase session. */
export function usePeriodicBackup(settings: BackupSettings) {
  const initializedRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const api = window.api;
    if (!api?.backupInit || !api?.backupSetSession) return;

    const config = getSupabaseConfig();
    if (!config) {
      console.log("[Backup] Supabase credentials not configured");
      return;
    }

    let isMounted = true;

    const clearSchedule = () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const schedule = () => {
      if (!settings.weeklyBackupEnabled || timeoutRef.current !== null) return;

      const lastBackup = Number(localStorage.getItem(LAST_BACKUP_KEY) || 0);
      if (Date.now() - lastBackup < BACKUP_INTERVAL_MS) return;

      timeoutRef.current = window.setTimeout(async () => {
        timeoutRef.current = null;
        try {
          const jobs: Promise<BackupResult>[] = [];
          if (settings.backupDocuments) jobs.push(api.backupAllDocuments());
          if (settings.backupHabits) jobs.push(api.backupAllHabits());
          if (settings.backupCategories) jobs.push(api.backupAllCategories());
          if (jobs.length === 0) return;

          const results = await Promise.all(jobs);
          if (results.every((result) => result.failed === 0)) {
            localStorage.setItem(LAST_BACKUP_KEY, String(Date.now()));
          }
          console.log("[Backup] Periodic backup completed:", results);
        } catch (error) {
          console.error("[Backup] Periodic backup error:", error);
        }
      }, BACKUP_START_DELAY_MS);
    };

    const ensureSession = async (session: Session | null) => {
      if (!initializedRef.current) {
        const result = await api.backupInit(config.url, config.anonKey);
        if (!result.success) {
          throw new Error(result.error || "Failed to initialize backup client");
        }
        initializedRef.current = true;
      }

      if (!session?.access_token || !session.refresh_token) {
        clearSchedule();
        await api.backupClearSession();
        return false;
      }

      const result = await api.backupSetSession(
        session.access_token,
        session.refresh_token,
      );
      if (!result.success) {
        clearSchedule();
        throw new Error(result.error || "Failed to authenticate backup client");
      }
      return true;
    };

    const synchronize = async (session: Session | null, context: string) => {
      try {
        if (await ensureSession(session)) schedule();
      } catch (error) {
        console.error(`[Backup] ${context}:`, error);
      }
    };

    void supabase.auth.getSession()
      .then(({ data }) => {
        if (isMounted) void synchronize(data.session, "Init error");
      })
      .catch((error) => {
        console.error("[Backup] Init error:", error);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => { void synchronize(session, "Session sync error"); },
    );

    return () => {
      isMounted = false;
      clearSchedule();
      subscription.unsubscribe();
    };
  }, [
    settings.backupCategories,
    settings.backupDocuments,
    settings.backupHabits,
    settings.weeklyBackupEnabled,
  ]);
}
