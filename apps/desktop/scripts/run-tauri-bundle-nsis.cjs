#!/usr/bin/env node
// File: apps/desktop/scripts/run-tauri-bundle-nsis.cjs

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const desktopDir = path.resolve(__dirname, "..");
const tauriCliPath = path.join(
  desktopDir,
  "node_modules",
  "@tauri-apps",
  "cli",
  "tauri.js",
);
const baseConfigPath = path.join(desktopDir, "src-tauri", "tauri.conf.json");
const generatedConfigPath = path.join(
  desktopDir,
  "src-tauri",
  "tauri.nsis.generated.json",
);

function fail(message) {
  console.error(`[tauri:bundle:nsis] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(baseConfigPath)) {
  fail(`Missing Tauri config: ${baseConfigPath}`);
}

if (!fs.existsSync(tauriCliPath)) {
  fail(`Tauri CLI entrypoint not found: ${tauriCliPath}`);
}

const baseConfig = JSON.parse(fs.readFileSync(baseConfigPath, "utf8"));
const generatedConfig = {
  ...baseConfig,
  bundle: {
    ...(baseConfig.bundle ?? {}),
    windows: {
      ...(baseConfig.bundle?.windows ?? {}),
      // Tauri's NSIS bundler still reaches the signtool-based verification path
      // for some resources when signCommand is configured, even with --no-sign.
      signCommand: null,
    },
  },
};

fs.writeFileSync(
  generatedConfigPath,
  JSON.stringify(generatedConfig, null, 2),
  "utf8",
);

const result = spawnSync(
  process.execPath,
  [
    tauriCliPath,
    "build",
    "--config",
    generatedConfigPath,
    "--bundles",
    "nsis",
    "--no-sign",
    ...process.argv.slice(2),
  ],
  {
    cwd: desktopDir,
    env: process.env,
    stdio: "inherit",
  },
);

try {
  fs.rmSync(generatedConfigPath, { force: true });
} catch {}

process.exit(typeof result.status === "number" ? result.status : 1);
