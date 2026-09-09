import { pathToFileURL } from "node:url";

export interface LinuxFileClipboardPayload {
  format: "text/uri-list" | "x-special/gnome-copied-files";
  data: Buffer;
}

export function buildLinuxFileClipboardPayload(
  filePaths: string[],
  desktop = process.env.XDG_CURRENT_DESKTOP || process.env.DESKTOP_SESSION || "",
): LinuxFileClipboardPayload {
  const paths = [...new Set(filePaths)].filter(Boolean);
  if (paths.length === 0) throw new Error("Nenhum arquivo encontrado");

  const uriList = paths.map((filePath) => pathToFileURL(filePath).href).join("\r\n");
  const usesGnomeClipboard = /gnome|unity|cinnamon|mate|budgie/i.test(desktop);
  return usesGnomeClipboard
    ? {
        format: "x-special/gnome-copied-files",
        data: Buffer.from(`copy\n${uriList}\r\n`, "utf8"),
      }
    : {
        format: "text/uri-list",
        data: Buffer.from(`${uriList}\r\n`, "utf8"),
      };
}
