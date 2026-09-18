import { describe, expect, it } from "vitest";
import { buildLibraryQuery } from "./libraryQuery";

describe("buildLibraryQuery", () => {
  it("serializes multiple formats for the existing SQLite query", () => {
    expect(buildLibraryQuery({
      section: "synced",
      search: "fowler",
      sort: "recent_desc",
      fileTypes: ["pdf", "epub"],
      selectedFolder: "Architecture",
      includeSubfolders: true,
    })).toEqual({
      section: "synced",
      search: "fowler",
      sort: "recent_desc",
      fileType: "pdf,epub",
      folderPath: "Architecture",
      includeSubfolders: true,
    });
  });

  it("does not send desktop folder state to USB queries", () => {
    expect(buildLibraryQuery({
      section: "usb",
      search: "",
      sort: "title_asc",
      fileTypes: [],
      selectedFolder: "Programming",
      includeSubfolders: false,
    }).folderPath).toBeNull();
  });
});
