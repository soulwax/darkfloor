#!/usr/bin/env node
// File: apps/desktop/scripts/sign-tauri-artifacts.cjs

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const desktopDir = path.resolve(__dirname, "..");
const releaseDir = path.join(desktopDir, "src-tauri", "target", "release");
const signScriptPath = path.join(desktopDir, "scripts", "sign-tauri-windows.ps1");

function fail(message) {
  console.error(`[tauri:sign:artifacts] ${message}`);
  process.exit(1);
}

function findLatestFile(directory, extension) {
  if (!fs.existsSync(directory)) {
    return null;
  }

  const matches = fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(extension))
    .map((entry) => {
      const fullPath = path.join(directory, entry.name);
      return {
        fullPath,
        mtimeMs: fs.statSync(fullPath).mtimeMs,
      };
    })
    .sort((left, right) => right.mtimeMs - left.mtimeMs);

  return matches[0]?.fullPath ?? null;
}

const requestedBundles = new Set(
  process.argv
    .slice(2)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
);

const targets = [];
const releaseExePath = path.join(releaseDir, "starchild-tauri-experimental.exe");
if (fs.existsSync(releaseExePath)) {
  targets.push(releaseExePath);
}

if (requestedBundles.size === 0 || requestedBundles.has("nsis")) {
  const nsisBundlePath = findLatestFile(path.join(releaseDir, "bundle", "nsis"), ".exe");
  if (nsisBundlePath) {
    targets.push(nsisBundlePath);
  }
}

if (requestedBundles.has("msi")) {
  console.warn(
    "[tauri:sign:artifacts] MSI post-signing is not part of the default free signing flow. Skipping MSI artifacts.",
  );
}

const uniqueTargets = [...new Set(targets)].filter((target) => fs.existsSync(target));
if (uniqueTargets.length === 0) {
  fail("No Tauri Windows artifacts were found to sign.");
}

if (!fs.existsSync(signScriptPath)) {
  fail(`Missing signing script: ${signScriptPath}`);
}

console.log("[tauri:sign:artifacts] Signing:");
for (const target of uniqueTargets) {
  console.log(`  - ${target}`);
}

const result = spawnSync(
  "pwsh",
  [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    signScriptPath,
    "-FilePathJson",
    JSON.stringify(uniqueTargets),
  ],
  {
    cwd: desktopDir,
    env: process.env,
    stdio: "inherit",
  },
);

process.exit(typeof result.status === "number" ? result.status : 1);
