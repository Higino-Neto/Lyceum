// @vitest-environment node
import path from "node:path";
import { describe, expect, it } from "vitest";
import { IpcValidationError, filePathString, safePathSegment } from "./validation";

describe("IPC path validation", () => {
  it("accepts real paths and rejects non-strings, empty values and NUL", () => {
    expect(filePathString("/home/user/Livros/a.epub", "filePath")).toBe("/home/user/Livros/a.epub");
    expect(filePathString("C:\\Livros\\a.pdf", "filePath")).toBe("C:\\Livros\\a.pdf");
    expect(() => filePathString(42, "filePath")).toThrow(IpcValidationError);
    expect(() => filePathString("   ", "filePath")).toThrow(IpcValidationError);
    expect(() => filePathString("/tmp/a\0.png", "filePath")).toThrow(/NUL/);
  });

  it("keeps identifiers to one safe segment that cannot escape a directory", () => {
    const hash = "a".repeat(64);
    expect(safePathSegment(hash, "fileHash")).toBe(hash);
    for (const hostile of ["../../.bashrc", "..\\..\\evil", "/etc/passwd", "usb:abc/../x"]) {
      const segment = safePathSegment(hostile, "fileHash");
      expect(segment).not.toMatch(/[\\/]/);
      expect(segment.startsWith(".")).toBe(false);
      const joined = path.join("/tmp/lyceum", `${segment}.pdf`);
      expect(path.dirname(joined)).toBe("/tmp/lyceum");
    }
    expect(() => safePathSegment("", "fileHash")).toThrow(IpcValidationError);
  });
});
