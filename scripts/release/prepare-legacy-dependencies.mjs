import { spawnSync } from "node:child_process";

// Electron 22 embeds Node 16. The main dependency set targets Node 18/20+, so the
// Legacy package is rebuilt with the last API-compatible lines that support Node 16.
const packages = [
  "better-sqlite3@8.7.0",
  "sharp@0.32.6",
  "chokidar@3.6.0",
  "tar@6.2.1",
];
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(npm, ["install", "--no-save", "--package-lock=false", ...packages], {
  stdio: "inherit",
  shell: process.platform === "win32",
});
if (result.error) throw result.error;
if (result.status !== 0) throw new Error(`Could not prepare Electron 22 dependencies (exit ${result.status})`);
