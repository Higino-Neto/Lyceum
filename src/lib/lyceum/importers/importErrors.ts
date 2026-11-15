/**
 * Machine-readable reasons an importer refuses a file. The code travels as a
 * `[lyceum:<code>]` message prefix because errors lose their class when they
 * cross the worker boundary; {@link parseImportErrorCode} reads it back.
 */
export type LyceumImportErrorCode =
  | "drm"
  | "corrupt"
  | "unsupported-compression"
  | "print-replica"
  | "kfx"
  | "rar-extractor-missing"
  | "no-content";

const CODE_PATTERN = /\[lyceum:([a-z-]+)\]/;

export class LyceumImportError extends Error {
  readonly code: LyceumImportErrorCode;

  constructor(code: LyceumImportErrorCode, message: string) {
    super(`[lyceum:${code}] ${message}`);
    this.name = "LyceumImportError";
    this.code = code;
  }
}

export function parseImportErrorCode(error: unknown): LyceumImportErrorCode | null {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const match = CODE_PATTERN.exec(message);
  return match ? match[1] as LyceumImportErrorCode : null;
}
