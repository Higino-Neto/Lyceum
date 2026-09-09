import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function isDirectory(targetPath: string): boolean {
  try {
    return fs.statSync(targetPath).isDirectory();
  } catch {
    return false;
  }
}

function childDirectories(parentPath: string): string[] {
  try {
    return fs.readdirSync(parentPath, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
      .map((entry) => path.join(parentPath, entry.name))
      .filter(isDirectory);
  } catch {
    return [];
  }
}

export function getLinuxVolumeParents(
  username = os.userInfo().username,
  uid = typeof process.getuid === "function" ? process.getuid() : undefined,
): Array<{ path: string; includeStorageChildren?: boolean }> {
  return [
    { path: path.join("/media", username) },
    { path: path.join("/run/media", username) },
    { path: "/mnt" },
    ...(typeof uid === "number"
      ? [{ path: path.join("/run/user", String(uid), "gvfs"), includeStorageChildren: true }]
      : []),
  ];
}

export function enumerateMountedVolumeRoots(
  parents: Array<{ path: string; includeStorageChildren?: boolean }>,
): string[] {
  const roots = new Set<string>();
  for (const parent of parents) {
    for (const mountRoot of childDirectories(parent.path)) {
      roots.add(mountRoot);
      if (parent.includeStorageChildren) {
        for (const storageRoot of childDirectories(mountRoot)) roots.add(storageRoot);
      }
    }
  }
  return Array.from(roots);
}

export function getCandidateVolumeRoots(
  platform: NodeJS.Platform = process.platform,
): string[] {
  if (platform === "win32") {
    return "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
      .split("")
      .map((letter) => `${letter}:\\`)
      .filter(isDirectory);
  }

  if (platform === "darwin") {
    return enumerateMountedVolumeRoots([{ path: "/Volumes" }]);
  }

  return enumerateMountedVolumeRoots(getLinuxVolumeParents());
}
