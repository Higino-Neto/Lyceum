// @vitest-environment node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { enumerateMountedVolumeRoots, getLinuxVolumeParents } from "./removable-volumes";

let tempDir: string | null = null;

afterEach(() => {
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  tempDir = null;
});

describe("removable volume discovery", () => {
  it("uses the standard Linux mount locations including GVFS", () => {
    expect(getLinuxVolumeParents("alice", 1000)).toEqual([
      { path: path.join("/media", "alice") },
      { path: path.join("/run/media", "alice") },
      { path: "/mnt" },
      { path: path.join("/run/user", "1000", "gvfs"), includeStorageChildren: true },
    ]);
  });

  it("discovers the storage directory exposed inside a GVFS MTP mount", () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lyceum-volumes-"));
    const mtpRoot = path.join(tempDir, "mtp-host-kindle");
    const storageRoot = path.join(mtpRoot, "Internal shared storage");
    fs.mkdirSync(storageRoot, { recursive: true });

    expect(enumerateMountedVolumeRoots([
      { path: tempDir, includeStorageChildren: true },
    ])).toEqual([mtpRoot, storageRoot]);
  });
});
