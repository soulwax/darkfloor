#!/usr/bin/env node
// File: apps/desktop/scripts/run-electron-builder-win.js

import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../../..");
const winUnpackedDir = path.join(rootDir, "dist", "win-unpacked");

function runBuilder() {
  return spawnSync(
    process.execPath,
    ["apps/desktop/scripts/load-env-build.js", "electron-builder --win"],
    {
      cwd: rootDir,
      stdio: "pipe",
      encoding: "utf8",
    },
  );
}

function printRun(result) {
  if (typeof result.stdout === "string" && result.stdout.length > 0) {
    process.stdout.write(result.stdout);
  }
  if (typeof result.stderr === "string" && result.stderr.length > 0) {
    process.stderr.write(result.stderr);
  }
}

function isMissingResourcesError(output) {
  return /ENOENT:\s*no such file or directory,\s*scandir\s+'[^']*dist[\\/]win-unpacked[\\/]resources'/i.test(
    output,
  );
}

function cleanupWinUnpacked() {
  try {
    fs.rmSync(winUnpackedDir, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup only.
  }
}

const firstRun = runBuilder();
printRun(firstRun);

if (firstRun.status === 0) {
  process.exit(0);
}

const firstOutput = `${firstRun.stdout ?? ""}\n${firstRun.stderr ?? ""}`;
if (!isMissingResourcesError(firstOutput)) {
  process.exit(typeof firstRun.status === "number" ? firstRun.status : 1);
}

console.warn(
  "\n[electron-builder:win] Detected transient missing resources folder; retrying once...\n",
);
cleanupWinUnpacked();

const secondRun = runBuilder();
printRun(secondRun);
process.exit(typeof secondRun.status === "number" ? secondRun.status : 1);
