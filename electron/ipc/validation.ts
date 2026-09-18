export class IpcValidationError extends Error {
  readonly code = "invalid_ipc_payload";

  constructor(readonly field: string, message: string) {
    super(`${field}: ${message}`);
    this.name = "IpcValidationError";
  }
}

export function nonEmptyString(value: unknown, field: string, maxLength = 512): string {
  if (typeof value !== "string") {
    throw new IpcValidationError(field, "must be a string");
  }
  const normalized = value.trim();
  if (!normalized) throw new IpcValidationError(field, "must not be empty");
  if (normalized.length > maxLength) {
    throw new IpcValidationError(field, `must contain at most ${maxLength} characters`);
  }
  return normalized;
}

export function positiveInteger(value: unknown, field: string): number {
  if (!Number.isInteger(value) || Number(value) <= 0) {
    throw new IpcValidationError(field, "must be a positive integer");
  }
  return Number(value);
}

export function record(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new IpcValidationError(field, "must be an object");
  }
  return value as Record<string, unknown>;
}

export function nullableString(
  value: unknown,
  field: string,
  maxLength = 512,
): string | null {
  return value === null ? null : nonEmptyString(value, field, maxLength);
}

export function stringArray(value: unknown, field: string, maxItems = 256): string[] {
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new IpcValidationError(field, `must be an array with at most ${maxItems} items`);
  }
  return value.map((item, index) => nonEmptyString(item, `${field}[${index}]`));
}

export function positiveIntegerArray(value: unknown, field: string, maxItems = 256): number[] {
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new IpcValidationError(field, `must be an array with at most ${maxItems} items`);
  }
  return value.map((item, index) => positiveInteger(item, `${field}[${index}]`));
}

export function dateKey(value: unknown, field: string): string {
  const normalized = nonEmptyString(value, field, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new IpcValidationError(field, "must use YYYY-MM-DD format");
  }
  return normalized;
}
