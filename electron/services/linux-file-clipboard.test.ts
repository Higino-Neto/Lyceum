// @vitest-environment node

import { describe, expect, it } from "vitest";
import { pathToFileURL } from "node:url";
import { buildLinuxFileClipboardPayload } from "./linux-file-clipboard";

describe("Linux file clipboard", () => {
  it("uses the GNOME file-copy clipboard format", () => {
    const payload = buildLinuxFileClipboardPayload(
      ["/home/alice/Books/Um livro.epub", "/home/alice/Books/capa #1.pdf"],
      "ubuntu:GNOME",
    );

    expect(payload.format).toBe("x-special/gnome-copied-files");
    expect(payload.data.toString("utf8")).toBe([
      "copy",
      pathToFileURL("/home/alice/Books/Um livro.epub").href,
      pathToFileURL("/home/alice/Books/capa #1.pdf").href,
      "",
    ].join("\r\n").replace("copy\r\n", "copy\n"));
  });

  it("uses the standard URI list format on KDE", () => {
    const payload = buildLinuxFileClipboardPayload(["/home/alice/book.pdf"], "KDE");
    expect(payload.format).toBe("text/uri-list");
    expect(payload.data.toString("utf8")).toBe(`${pathToFileURL("/home/alice/book.pdf").href}\r\n`);
  });
});
