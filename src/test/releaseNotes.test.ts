import { describe, expect, it } from "vitest";
import {
  RELEASE_NOTES,
  compareVersions,
  getUnseenReleaseNotes,
  getVisibleReleaseNotes,
} from "../features/whats-new/releaseNotes";

describe("release notes", () => {
  it("compares semantic versions numerically", () => {
    expect(compareVersions("1.10.0", "1.9.1")).toBeGreaterThan(0);
    expect(compareVersions("1.9.0", "1.9.0")).toBe(0);
    expect(compareVersions("1.8.30", "1.9.0")).toBeLessThan(0);
  });

  it("hides notes of versions that have not shipped yet", () => {
    const visible = getVisibleReleaseNotes("1.9.1");
    expect(visible.every((note) => compareVersions(note.version, "1.9.1") <= 0)).toBe(true);
  });

  it("lists only versions released after the last seen one", () => {
    expect(getUnseenReleaseNotes(null, "1.9.1")).toEqual([]);
    expect(getUnseenReleaseNotes("1.9.0", "1.9.1").map((note) => note.version)).toEqual(["1.9.1"]);
  });

  it("keeps entries sorted newest first with both languages filled", () => {
    for (let index = 1; index < RELEASE_NOTES.length; index += 1) {
      expect(compareVersions(RELEASE_NOTES[index - 1].version, RELEASE_NOTES[index].version)).toBeGreaterThan(0);
    }
    for (const note of RELEASE_NOTES) {
      for (const item of note.items) {
        expect(item.text.en).toBeTruthy();
        expect(item.text["pt-BR"]).toBeTruthy();
      }
    }
  });
});
