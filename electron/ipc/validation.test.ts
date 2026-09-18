import { describe, expect, it } from "vitest";
import {
  dateKey,
  nonEmptyString,
  positiveInteger,
  positiveIntegerArray,
} from "./validation";

describe("IPC payload validation", () => {
  it("normalizes bounded strings", () => {
    expect(nonEmptyString("  Lyceum  ", "name")).toBe("Lyceum");
    expect(() => nonEmptyString(" ", "name")).toThrow("name: must not be empty");
  });

  it("rejects invalid identifiers and oversized collections", () => {
    expect(positiveInteger(3, "id")).toBe(3);
    expect(() => positiveInteger(0, "id")).toThrow("positive integer");
    expect(positiveIntegerArray([1, 2], "ids")).toEqual([1, 2]);
  });

  it("accepts only stable local date keys", () => {
    expect(dateKey("2026-09-18", "dateKey")).toBe("2026-09-18");
    expect(() => dateKey("18/09/2026", "dateKey")).toThrow("YYYY-MM-DD");
  });
});
