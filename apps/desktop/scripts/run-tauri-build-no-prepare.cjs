#!/usr/bin/env node
// File: apps/desktop/scripts/run-tauri-build-no-prepare.cjs

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const desktopDir = path.resolve(__dirname, "..");
const bundleRoot = path.join(desktopDir, ".tauri-bundle");
const standaloneDir = path.join(bundleRoot, "standalone");
const nodeDir = path.join(bundleRoot, "node");
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
  "tauri.no-prepare.generated.json",
);

function resolveStandaloneServer(standaloneRoot) {
  const candidates = [
    path.join(standaloneRoot, "server.js"),
    path.join(standaloneRoot, "apps", "web", "server.js"),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function resolveBundledNode(nodeRoot) {
  const candidates = [
    path.join(nodeRoot, "node.exe"),
    path.join(nodeRoot, "bin", "node"),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function fail(message) {
  console.error(`[tauri:build:no-prepare] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(baseConfigPath)) {
  fail(`Missing Tauri config: ${baseConfigPath}`);
}

if (!fs.existsSync(standaloneDir)) {
  fail(
    `Missing staged standalone bundle at ${standaloneDir}. Run "pnpm tauri:prepare:no-build" to stage the existing bundle, or "pnpm tauri:prepare" to rebuild it first.`,
  );
}

const standaloneServer = resolveStandaloneServer(standaloneDir);
if (!standaloneServer) {
  fail(
    `Standalone server entry not found under ${standaloneDir}. Run "pnpm tauri:prepare:no-build" to restage the existing bundle, or "pnpm tauri:prepare" to rebuild it first.`,
  );
}

const bundledNode = resolveBundledNode(nodeDir);
if (!bundledNode) {
  fail(
    `Bundled Node.js runtime not found under ${nodeDir}. Run "pnpm tauri:prepare:no-build" to restage the existing bundle, or "pnpm tauri:prepare" to rebuild it first.`,
  );
}

if (!fs.existsSync(tauriCliPath)) {
  fail(`Tauri CLI entrypoint not found: ${tauriCliPath}`);
}

const baseConfig = JSON.parse(fs.readFileSync(baseConfigPath, "utf8"));
const buildConfig = { ...(baseConfig.build ?? {}) };
delete buildConfig.beforeBuildCommand;

const generatedConfig = {
  ...baseConfig,
  build: buildConfig,
};

console.log("[tauri:build:no-prepare] Reusing existing staged Tauri bundle.");
console.log("[tauri:build:no-prepare] Standalone server:", standaloneServer);
console.log("[tauri:build:no-prepare] Bundled Node runtime:", bundledNode);

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
