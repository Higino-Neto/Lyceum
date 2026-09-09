// @vitest-environment node

import { describe, expect, it } from "vitest";
import { buildWindowsFileClipboardCommand } from "./windows-file-clipboard";

describe("Windows file clipboard command", () => {
  it("passes paths through JSON environment data instead of PowerShell source", () => {
    const paths = [
      "C:\\Library\\Computer Science\\Book One.pdf",
      "C:\\Library\\Dados & IA\\Livro 'dois'.epub",
    ];
    const command = buildWindowsFileClipboardCommand(paths);
    const encodedIndex = command.args.indexOf("-EncodedCommand") + 1;
    const script = Buffer.from(command.args[encodedIndex], "base64").toString("utf16le");

    expect(command.args).not.toContain(paths[0]);
    expect(command.args).not.toContain(paths[1]);
    expect(script).toContain("SetFileDropList");
    expect(script).toContain("LYCEUM_CLIPBOARD_FILE_PATHS");
    expect(JSON.parse(command.env.LYCEUM_CLIPBOARD_FILE_PATHS)).toEqual(paths);
  });

  it("rejects an empty file selection", () => {
    expect(() => buildWindowsFileClipboardCommand([])).toThrow("Nenhum arquivo encontrado");
  });
});
