import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Newer Kindles (Paperwhite 5+, Kindle 11th gen, Scribe, 2024 models) and some
 * Kobos expose MTP instead of USB mass storage. On Linux, GNOME's gvfs detects
 * them but only mounts them (under /run/user/<uid>/gvfs/mtp:host=...) once a
 * file manager opens them. These helpers mount e-readers on demand and copy
 * files with `gio`, because the gvfs FUSE bridge rejects plain open/copyfile
 * writes with ENOTSUP.
 */

export interface GioMtpVolume {
  name: string;
  activationRoot: string;
}

const EREADER_NAME_PATTERN = /\b(kindle|kobo|lab126)\b/i;
const EREADER_ROOT_PATTERN = /mtp:\/\/[^/]*(kindle|kobo|lab126)/i;
const MOUNT_RETRY_MS = 15_000;
const failedMountsAt = new Map<string, number>();

/** Parses the "Volume(n): ..." blocks of `gio mount -li` that belong to MTP e-readers. */
export function parseGioMtpEreaderVolumes(output: string): GioMtpVolume[] {
  const volumes: GioMtpVolume[] = [];
  const blocks = output.split(/^(?=\s*Volume\(\d+\):)/m);
  for (const block of blocks) {
    const header = /^\s*Volume\(\d+\):\s*(.+)$/m.exec(block);
    if (!header) continue;
    // Stop at the next nested Mount(...) / Drive(...) so their fields do not leak in.
    const body = block.split(/^\s*(?:Mount|Drive)\(\d+\):/m)[0];
    const root = /activation_root=(mtp:\/\/\S+)/.exec(body)?.[1];
    const isMtp = /GProxyVolumeMonitorMTP/.test(body) || Boolean(root);
    if (!root || !isMtp) continue;
    const name = header[1].trim();
    if (!EREADER_NAME_PATTERN.test(name) && !EREADER_ROOT_PATTERN.test(root)) continue;
    volumes.push({ name, activationRoot: root });
  }
  return volumes;
}

/** "mtp://Amazon_Kindle_X/" -> "/run/user/<uid>/gvfs/mtp:host=Amazon_Kindle_X" */
export function gvfsMountPathForMtpRoot(activationRoot: string, uid: number): string {
  const host = activationRoot.replace(/^mtp:\/\//, "").replace(/\/+$/, "");
  return path.join("/run/user", String(uid), "gvfs", `mtp:host=${host}`);
}

export function isGvfsMtpPath(targetPath: string): boolean {
  return /[\\/]gvfs[\\/]mtp:host=/.test(targetPath);
}

/**
 * Mounts every detected-but-unmounted MTP e-reader. Safe to call often: it is a
 * no-op off Linux, without `gio`, or when everything is already mounted. A
 * failed mount (e.g. the Kindle is locked) is retried at most every 15s.
 */
export async function ensureLinuxMtpEreadersMounted(): Promise<string[]> {
  if (process.platform !== "linux" || typeof process.getuid !== "function") return [];
  const uid = process.getuid();
  let output: string;
  try {
    output = (await execFileAsync("gio", ["mount", "-li"], { timeout: 5000 })).stdout;
  } catch {
    return [];
  }

  const mounted: string[] = [];
  for (const volume of parseGioMtpEreaderVolumes(output)) {
    const mountPath = gvfsMountPathForMtpRoot(volume.activationRoot, uid);
    if (fs.existsSync(mountPath)) continue;
    const lastFailure = failedMountsAt.get(volume.activationRoot) || 0;
    if (Date.now() - lastFailure < MOUNT_RETRY_MS) continue;
    try {
      await execFileAsync("gio", ["mount", volume.activationRoot], { timeout: 20_000 });
      failedMountsAt.delete(volume.activationRoot);
      mounted.push(mountPath);
    } catch (error) {
      failedMountsAt.set(volume.activationRoot, Date.now());
      console.warn(`[usb] Nao foi possivel montar ${volume.name} via MTP:`, error instanceof Error ? error.message : error);
    }
  }
  return mounted;
}

/**
 * Copies a local file to a destination that may be on a gvfs MTP mount.
 * Plain filesystem destinations use fs.copyFileSync.
 */
export async function copyFileToVolume(sourcePath: string, targetPath: string): Promise<void> {
  if (!isGvfsMtpPath(targetPath)) {
    fs.copyFileSync(sourcePath, targetPath);
    return;
  }
  await execFileAsync("gio", ["copy", "-T", sourcePath, targetPath], { timeout: 10 * 60_000 });
}
