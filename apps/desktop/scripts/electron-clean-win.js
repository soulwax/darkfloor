#!/usr/bin/env node
// File: apps/desktop/scripts/electron-clean-win.js

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const distDir = path.join(repoRoot, "dist");

function findProcessesLockingDist() {
  if (process.platform !== "win32") {
    return [];
  }

  try {
    const escapedDistDir = distDir.replace(/\\/g, "\\\\");
    const command = [
      "$dist = '" + escapedDistDir.replace(/'/g, "''") + "'",
      "Get-Process | Where-Object { $_.Path -and $_.Path.StartsWith($dist, [System.StringComparison]::OrdinalIgnoreCase) } |",
      "Select-Object ProcessName, Id, Path | ConvertTo-Json -Compress",
    ].join("; ");

    const output = execSync(`pwsh -NoProfile -Command "${command}"`, {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
    }).trim();

    if (!output) {
      return [];
    }

    const parsed = JSON.parse(output);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

if (!fs.existsSync(distDir)) {
  process.exit(0);
}

try {
  fs.rmSync(distDir, { recursive: true, force: true });
} catch (err) {
  const code = err?.code ?? "";
  const msg = err?.message ?? String(err);
  const lockingProcesses = findProcessesLockingDist();
  console.error("");
  console.error("electron-clean:win: Could not remove dist/");
  console.error("  " + (code ? code + ": " : "") + msg);
  console.error("");
  if (lockingProcesses.length > 0) {
    console.error("Processes still running from dist/:");
    for (const processInfo of lockingProcesses) {
      console.error(
        `  - ${processInfo.ProcessName} (PID ${processInfo.Id}) ${processInfo.Path}`,
      );
    }
    console.error("");
  }
  console.error("Close Starchild (Starchild.exe) and any process using dist\\win-unpacked");
  console.error("(e.g. Task Manager, Explorer, or a terminal in that folder), then run:");
  console.error("  npm run electron:build:win");
  console.error("");
  process.exit(1);
}
