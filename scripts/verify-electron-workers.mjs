import fs from "node:fs";
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import { Worker } from "node:worker_threads";

const workerPath = path.resolve("dist-electron/workers/processing.worker.js");
if (!fs.existsSync(workerPath)) {
  throw new Error(`Processing worker bundle is missing: ${workerPath}`);
}

const worker = new Worker(workerPath, { name: "lyceum-build-worker-check" });
const requestId = `build-check-${process.pid}`;
const hashRequestId = `${requestId}-hash`;
const conversionRequestId = `${requestId}-conversion`;
const workspace = await fs.promises.mkdtemp(path.join(os.tmpdir(), "lyceum-worker-check-"));
const fixturePath = path.join(workspace, "fixture.txt");
const outputPath = path.join(workspace, "fixture.epub");
const packageRoot = path.join(workspace, "fixture.lyceum");
const fixture = Buffer.from("lyceum-worker-health-check", "utf8");
await fs.promises.writeFile(fixturePath, fixture);

const result = await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error("Processing worker did not answer the build health check in 20 seconds.")), 20_000);
  const cleanup = () => clearTimeout(timeout);
  worker.once("error", (error) => {
    cleanup();
    reject(error);
  });
  worker.on("message", (message) => {
    if (message?.type === "ready") {
      worker.postMessage({ requestId, kind: "ping", payload: {} });
      return;
    }
    if (message?.type === "result" && message.requestId === requestId) {
      if (message.success && message.value?.pong === true) {
        worker.postMessage({ requestId: hashRequestId, kind: "hash-file", payload: { filePath: fixturePath } });
      } else {
        cleanup();
        reject(new Error(message.error || "Processing worker ping failed."));
      }
      return;
    }
    if (message?.type === "result" && message.requestId === hashRequestId) {
      const expected = crypto.createHash("sha256").update(fixture).digest("hex");
      if (message.success && message.value?.fileHash === expected && message.value?.fileSize === fixture.length) {
        worker.postMessage({
          requestId: conversionRequestId,
          kind: "convert-via-lyceum",
          payload: {
            sourcePath: fixturePath,
            sourceFormat: "txt",
            targetFormat: "epub",
            packageRoot,
            outputPath,
            metadata: { title: "Worker check", language: "pt-BR" },
          },
        });
      } else {
        cleanup();
        reject(new Error(message.error || "Processing worker hash task failed."));
      }
      return;
    }
    if (message?.type === "result" && message.requestId === conversionRequestId) {
      cleanup();
      if (message.success && message.value?.outputPath === outputPath && fs.existsSync(outputPath)) resolve(message.value);
      else reject(new Error(message.error || "Processing worker conversion task failed."));
    }
  });
});

await worker.terminate();
await fs.promises.rm(workspace, { recursive: true, force: true });
console.log(`Electron worker health check passed (hash + ${path.extname(result.outputPath)} conversion).`);
