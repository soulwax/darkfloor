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
const forceNativeRebuild = /^(1|true)$/i.test(
  String(process.env.STARCHILD_ELECTRON_WIN_NATIVE_REBUILD ?? ""),
);
const noNativeRebuildFlags = [
  "-c.npmRebuild=false",
  "-c.nodeGypRebuild=false",
  "-c.buildDependenciesFromSource=false",
];

function runBuilder(target, options = {}) {
  const commandParts = ["electron-builder", "--win", target];
  if (options.disableNativeRebuild === true) {
    commandParts.push(...noNativeRebuildFlags);
  }

  return spawnSync(
    process.execPath,
    [
      "apps/desktop/scripts/load-env-build.js",
      commandParts.join(" "),
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

function isMissingVisualStudioForNativeRebuild(output) {
  return (
    /Could not find any Visual Studio installation to use/i.test(output) &&
    /node-gyp failed to rebuild/i.test(output)
  );
}

function cleanupWinUnpacked() {
  try {
    fs.rmSync(winUnpackedDir, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup only.
  }
}

const shouldAttemptNativeRebuildFirst = forceNativeRebuild;

if (forceNativeRebuild) {
  console.log(
    "[electron-builder:win] STARCHILD_ELECTRON_WIN_NATIVE_REBUILD=true detected; native rebuild is enabled.",
  );
} else {
  console.log(
    "[electron-builder:win] Packaging with native rebuild disabled by default. Set STARCHILD_ELECTRON_WIN_NATIVE_REBUILD=true to force @electron/rebuild.",
  );
}

for (const target of winTargets) {
  console.log(`[electron-builder:win] Building target "${target}"...`);
  cleanupWinUnpacked();

  const firstRun = runBuilder(target, {
    disableNativeRebuild: !shouldAttemptNativeRebuildFirst,
  });
  printRun(firstRun);

  if (firstRun.status === 0) {
    continue;
  }

  const firstOutput = `${firstRun.stdout ?? ""}\n${firstRun.stderr ?? ""}`;
  const shouldRetryWithoutNativeRebuild =
    shouldAttemptNativeRebuildFirst &&
    isMissingVisualStudioForNativeRebuild(firstOutput);
  if (shouldRetryWithoutNativeRebuild) {
    console.log(
      `\n[electron-builder:win] Native rebuild failed due to missing Visual Studio Build Tools for "${target}". Retrying with native rebuild disabled...\n`,
    );
    cleanupWinUnpacked();

    const fallbackRun = runBuilder(target, { disableNativeRebuild: true });
    printRun(fallbackRun);

    if (fallbackRun.status !== 0) {
      process.exit(typeof fallbackRun.status === "number" ? fallbackRun.status : 1);
    }
    continue;
  }

  const shouldRetryTransient =
    isMissingResourcesError(firstOutput) ||
    isMissingElectronExeRenameError(firstOutput);

  if (!shouldRetryTransient) {
    process.exit(typeof firstRun.status === "number" ? firstRun.status : 1);
  }

  console.warn(
    `\n[electron-builder:win] Detected transient packaging failure for "${target}"; retrying once...\n`,
  );
  cleanupWinUnpacked();

  const secondRun = runBuilder(target, {
    disableNativeRebuild: !shouldAttemptNativeRebuildFirst,
  });
  printRun(secondRun);

  if (secondRun.status !== 0) {
    process.exit(typeof secondRun.status === "number" ? secondRun.status : 1);
  }
}

process.exit(0);
