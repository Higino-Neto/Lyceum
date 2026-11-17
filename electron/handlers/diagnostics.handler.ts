import fs from "node:fs";
import type { App, IpcMain } from "electron";
import type { AppLogger } from "../services/app-logger";
import { openPathDetached } from "../services/open-path";
import { nonEmptyString, nullableString } from "../ipc/validation";

const MAX_TEXT = 8000;

function clip(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return value.length > MAX_TEXT ? `${value.slice(0, MAX_TEXT)}…` : value;
}

/**
 * Process-level error capture: uncaught exceptions and rejections in the main
 * process and crashed renderers are written to the log file instead of being
 * lost (there is no crash reporter).
 */
export function installProcessErrorLogging(app: App, logger: AppLogger) {
  process.on("uncaughtException", (error) => {
    logger.log("error", "[Main] uncaughtException", error);
  });
  process.on("unhandledRejection", (reason) => {
    logger.log("error", "[Main] unhandledRejection", reason);
  });
  app.on("render-process-gone", (_, webContents, details) => {
    logger.log("error", "[Main] renderer process gone", {
      reason: details.reason,
      exitCode: details.exitCode,
      url: webContents.getURL(),
    });
  });
}

export function registerDiagnosticsHandlers(ipcMain: IpcMain, logger: AppLogger) {
  /** Errors caught by the renderer's error boundaries / window.onerror. */
  ipcMain.handle("diagnostics:report-renderer-error", (_, raw: unknown) => {
    const input = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    let message = "Renderer error";
    try {
      message = nonEmptyString(input.message, "message", 100_000).slice(0, 1000);
    } catch {
      message = "Renderer error";
    }
    const safe = (value: unknown) => {
      try {
        return clip(nullableString(value, "field", 1_000_000));
      } catch {
        return undefined;
      }
    };
    logger.log("error", "[Renderer]", message, {
      source: safe(input.source),
      route: safe(input.route),
      stack: safe(input.stack),
      componentStack: safe(input.componentStack),
    });
    return { success: true };
  });

  ipcMain.handle("diagnostics:open-logs", async () => {
    fs.mkdirSync(logger.directory, { recursive: true });
    const error = await openPathDetached(logger.directory);
    return error ? { success: false, error } : { success: true };
  });
}
