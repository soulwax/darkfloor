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
const winTargets = ["nsis", "portable"];

function runBuilder(target) {
  return spawnSync(
    process.execPath,
    [
      "apps/desktop/scripts/load-env-build.js",
      `electron-builder --win ${target}`,
    ],
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

function isMissingElectronExeRenameError(output) {
  return /ENOENT:\s*no such file or directory,\s*rename\s+'[^']*dist[\\/]win-unpacked[\\/]electron\.exe'\s*->\s*'[^']*dist[\\/]win-unpacked[\\/]Starchild\.exe'/i.test(
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

for (const target of winTargets) {
  console.log(`[electron-builder:win] Building target "${target}"...`);
  cleanupWinUnpacked();

  const firstRun = runBuilder(target);
  printRun(firstRun);

  if (firstRun.status === 0) {
    continue;
  }

  const firstOutput = `${firstRun.stdout ?? ""}\n${firstRun.stderr ?? ""}`;
  const shouldRetry =
    isMissingResourcesError(firstOutput) ||
    isMissingElectronExeRenameError(firstOutput);

  if (!shouldRetry) {
    process.exit(typeof firstRun.status === "number" ? firstRun.status : 1);
  }

  console.warn(
    `\n[electron-builder:win] Detected transient packaging failure for "${target}"; retrying once...\n`,
  );
  cleanupWinUnpacked();

  const secondRun = runBuilder(target);
  printRun(secondRun);

  if (secondRun.status !== 0) {
    process.exit(typeof secondRun.status === "number" ? secondRun.status : 1);
  }
}

process.exit(0);
