import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  backupNodeBinding,
  ensureNodeNative,
  localBin,
  rebuildForElectron,
  restoreNodeBinding,
  run,
} from "./native-runtime.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporaryDirectory = mkdtempSync(path.join(os.tmpdir(), "lyceum-native-"));
const nodeBindingBackup = path.join(temporaryDirectory, "better_sqlite3.node");
let child;
let forwardedSignal;

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    forwardedSignal = signal;
    if (child && !child.killed) child.kill(signal);
  });
}

try {
  run(process.execPath, ["scripts/prepare-pdfjs.mjs"]);
  run(process.execPath, ["scripts/verify-pdfjs-assets.mjs"]);
  ensureNodeNative();
  backupNodeBinding(nodeBindingBackup);
  rebuildForElectron();

  child = spawn(localBin("vite"), [], { cwd: root, stdio: "inherit" });
  const exit = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
  if (exit.code && exit.code !== 0 && !forwardedSignal) process.exitCode = exit.code;
} finally {
  restoreNodeBinding(nodeBindingBackup);
  rmSync(temporaryDirectory, { recursive: true, force: true });
}

if (forwardedSignal) process.exitCode = forwardedSignal === "SIGINT" ? 130 : 143;
