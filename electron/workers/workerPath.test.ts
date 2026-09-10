import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { getProcessingWorkerPathCandidates, toAsarUnpackedPath } from "./workerPath";

describe("processing worker path resolution", () => {
  it("derives the worker from import.meta.url without using the working directory", () => {
    const mainPath = path.join("C:\\", "app", "dist-electron", "main.js");
    const candidates = getProcessingWorkerPathCandidates({ moduleUrl: pathToFileURL(mainPath).href });

    expect(candidates[0]).toBe(path.join("C:\\", "app", "dist-electron", "workers", "processing.worker.js"));
  });

  it("covers packed, unpacked, and unpackaged Linux layouts", () => {
    const resourcesPath = path.join("C:\\", "opt", "Lyceum", "resources");
    const moduleUrl = pathToFileURL(path.join(resourcesPath, "app.asar", "dist-electron", "main.js")).href;
    const candidates = getProcessingWorkerPathCandidates({ moduleUrl, resourcesPath });

    expect(candidates).toContain(path.join(resourcesPath, "app.asar", "dist-electron", "workers", "processing.worker.js"));
    expect(candidates).toContain(path.join(resourcesPath, "app.asar.unpacked", "dist-electron", "workers", "processing.worker.js"));
    expect(candidates).toContain(path.join(resourcesPath, "app", "dist-electron", "workers", "processing.worker.js"));
  });

  it("maps an ASAR path to its physical unpacked sibling", () => {
    const packed = path.join("C:\\", "opt", "Lyceum", "resources", "app.asar", "dist-electron", "workers", "processing.worker.js");
    expect(toAsarUnpackedPath(packed)).toBe(
      path.join("C:\\", "opt", "Lyceum", "resources", "app.asar.unpacked", "dist-electron", "workers", "processing.worker.js"),
    );
  });
});
