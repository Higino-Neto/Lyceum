export type DomainError<Code extends string = string> = Readonly<{
  code: Code;
  message: string;
  cause?: unknown;
}>;

export type Result<Value, Code extends string = string> =
  | Readonly<{ ok: true; value: Value }>
  | Readonly<{ ok: false; error: DomainError<Code> }>;

export class DomainException extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "DomainException";
  }
}

export function success<Value>(value: Value): Result<Value, never> {
  return { ok: true, value };
}

export function failure<Code extends string>(
  code: Code,
  message: string,
  cause?: unknown,
): Result<never, Code> {
  return { ok: false, error: { code, message, cause } };
}

export function unwrap<Value, Code extends string>(result: Result<Value, Code>): Value {
  if (result.ok === true) return result.value;
  throw new DomainException(result.error.message, result.error.cause);
}
