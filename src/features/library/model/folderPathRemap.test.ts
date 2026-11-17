import { describe, expect, it } from "vitest";
import { remapFolderPath } from "./folderPathRemap";

describe("remapFolderPath", () => {
  const root = "/home/me/Lyceum";

  it("follows a renamed library folder selected by its relative path", () => {
    expect(remapFolderPath("Fiction", "/home/me/Lyceum/Fiction", "/home/me/Lyceum/Novels", root)).toBe("Novels");
    expect(remapFolderPath("Fiction/French", "/home/me/Lyceum/Fiction", "/home/me/Lyceum/Novels", root)).toBe("Novels/French");
  });

  it("leaves unrelated folders and siblings with a shared prefix alone", () => {
    expect(remapFolderPath("Fiction2", "/home/me/Lyceum/Fiction", "/home/me/Lyceum/Novels", root)).toBeNull();
    expect(remapFolderPath(null, "/home/me/Lyceum/Fiction", "/home/me/Lyceum/Novels", root)).toBeNull();
  });

  it("follows absolute source-folder paths", () => {
    expect(remapFolderPath("/mnt/books/old/sub", "/mnt/books/old", "/mnt/books/new", root)).toBe("/mnt/books/new/sub");
  });

  it("handles Windows paths case-insensitively", () => {
    expect(remapFolderPath("Sci", "C:\\Users\\me\\Lyceum\\sci", "C:\\Users\\me\\Lyceum\\Science", "C:\\Users\\me\\Lyceum")).toBe("Science");
  });
});
