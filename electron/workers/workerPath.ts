import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface WorkerPathEnvironment {
  moduleUrl: string;
  resourcesPath?: string;
  appRoot?: string;
}

export function toAsarUnpackedPath(candidate: string): string | null {
  const marker = `${path.sep}app.asar${path.sep}`;
  const index = candidate.indexOf(marker);
  if (index < 0) return null;
  return `${candidate.slice(0, index)}${path.sep}app.asar.unpacked${path.sep}${candidate.slice(index + marker.length)}`;
}

export function getProcessingWorkerPathCandidates(environment: WorkerPathEnvironment): string[] {
  const currentDir = path.dirname(fileURLToPath(environment.moduleUrl));
  const moduleRelative = [
    path.resolve(currentDir, "workers/processing.worker.js"),
    path.resolve(currentDir, "../workers/processing.worker.js"),
    path.resolve(currentDir, "processing.worker.js"),
  ];
  const packagedRoots = environment.resourcesPath ? [
    path.join(environment.resourcesPath, "app.asar", "dist-electron", "workers", "processing.worker.js"),
    path.join(environment.resourcesPath, "app.asar.unpacked", "dist-electron", "workers", "processing.worker.js"),
    path.join(environment.resourcesPath, "app", "dist-electron", "workers", "processing.worker.js"),
  ] : [];
  const appRootCandidate = environment.appRoot
    ? [path.resolve(environment.appRoot, "dist-electron/workers/processing.worker.js")]
    : [];
  const unpackedModulePaths = moduleRelative
    .map(toAsarUnpackedPath)
    .filter((candidate): candidate is string => Boolean(candidate));

  return [...new Set([...moduleRelative, ...unpackedModulePaths, ...packagedRoots, ...appRootCandidate])];
}

export function resolveProcessingWorkerPath(environment: WorkerPathEnvironment): string {
  const candidates = getProcessingWorkerPathCandidates(environment);
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}
