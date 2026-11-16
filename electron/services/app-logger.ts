import fs from "node:fs";
import path from "node:path";
import { format } from "node:util";

/**
 * Small file logger for the main process: errors and warnings (and anything
 * logged explicitly) go to `<logs>/lyceum.log`, rotated by size, so problems
 * on users' machines leave a trace that can be opened from the app.
 */

export type LogLevel = "info" | "warn" | "error";

export interface AppLogger {
  readonly directory: string;
  readonly file: string;
  log(level: LogLevel, ...args: unknown[]): void;
  /** Mirrors console.warn/console.error into the log file (once). */
  captureConsole(): void;
}

const MAX_BYTES = 2 * 1024 * 1024;
const KEEP_FILES = 3;

function serialize(arg: unknown): string {
  if (arg instanceof Error) return arg.stack || `${arg.name}: ${arg.message}`;
  if (typeof arg === "string") return arg;
  try {
    return format("%o", arg);
  } catch {
    return String(arg);
  }
}

export function createAppLogger(directory: string, options: { maxBytes?: number; keepFiles?: number } = {}): AppLogger {
  const file = path.join(directory, "lyceum.log");
  const maxBytes = options.maxBytes ?? MAX_BYTES;
  const keepFiles = options.keepFiles ?? KEEP_FILES;
  let consoleCaptured = false;
  let writing = false;

  const rotate = () => {
    try {
      if (!fs.existsSync(file) || fs.statSync(file).size < maxBytes) return;
      for (let index = keepFiles - 1; index >= 1; index -= 1) {
        const from = `${file}.${index}`;
        if (fs.existsSync(from)) fs.renameSync(from, `${file}.${index + 1}`);
      }
      fs.renameSync(file, `${file}.1`);
      fs.rmSync(`${file}.${keepFiles + 1}`, { force: true });
    } catch {
      // Rotation is best effort; logging continues in the current file.
    }
  };

  const log = (level: LogLevel, ...args: unknown[]) => {
    // Re-entrancy guard: a failing write must not log about itself forever.
    if (writing) return;
    writing = true;
    try {
      fs.mkdirSync(directory, { recursive: true });
      rotate();
      const line = `${new Date().toISOString()} [${level.toUpperCase()}] ${args.map(serialize).join(" ")}\n`;
      fs.appendFileSync(file, line, "utf8");
    } catch {
      // Never let logging break the app.
    } finally {
      writing = false;
    }
  };

  return {
    directory,
    file,
    log,
    captureConsole() {
      if (consoleCaptured) return;
      consoleCaptured = true;
      const originalWarn = console.warn.bind(console);
      const originalError = console.error.bind(console);
      console.warn = (...args: unknown[]) => {
        originalWarn(...args);
        log("warn", ...args);
      };
      console.error = (...args: unknown[]) => {
        originalError(...args);
        log("error", ...args);
      };
    },
  };
}
