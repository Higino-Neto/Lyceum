// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createAppLogger } from "./app-logger";

describe("app logger", () => {
  it("writes levelled lines with error stacks", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lyceum-log-"));
    const logger = createAppLogger(dir);
    logger.log("error", "[Main] falhou", new Error("boom"), { id: 7 });
    const text = fs.readFileSync(logger.file, "utf8");
    expect(text).toMatch(/\[ERROR\] \[Main\] falhou Error: boom/);
    expect(text).toContain("id: 7");
  });

  it("rotates by size and keeps a bounded number of files", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lyceum-log-"));
    const logger = createAppLogger(dir, { maxBytes: 200, keepFiles: 2 });
    for (let index = 0; index < 50; index += 1) logger.log("info", `linha ${index} ${"x".repeat(40)}`);
    const files = fs.readdirSync(dir).sort();
    expect(files).toEqual(["lyceum.log", "lyceum.log.1", "lyceum.log.2"]);
    expect(fs.statSync(logger.file).size).toBeLessThan(400);
  });

  it("mirrors console.warn/error into the file without hiding them", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lyceum-log-"));
    const logger = createAppLogger(dir);
    const originalError = console.error;
    const originalWarn = console.warn;
    const spyError = vi.fn();
    const spyWarn = vi.fn();
    console.error = spyError;
    console.warn = spyWarn;
    try {
      logger.captureConsole();
      console.error("erro visivel");
      console.warn("aviso visivel");
    } finally {
      console.error = originalError;
      console.warn = originalWarn;
    }
    expect(spyError).toHaveBeenCalledWith("erro visivel");
    expect(spyWarn).toHaveBeenCalledWith("aviso visivel");
    const text = fs.readFileSync(logger.file, "utf8");
    expect(text).toContain("[ERROR] erro visivel");
    expect(text).toContain("[WARN] aviso visivel");
  });
});
