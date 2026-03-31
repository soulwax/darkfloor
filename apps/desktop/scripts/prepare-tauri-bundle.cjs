#!/usr/bin/env node
// File: apps/desktop/scripts/prepare-tauri-bundle.cjs

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const desktopDir = path.resolve(__dirname, "..");
const repoRoot = path.resolve(desktopDir, "../..");
const bundleRoot = path.join(desktopDir, ".tauri-bundle");
const standaloneSource = path.join(repoRoot, ".next", "standalone");
const standaloneStaticSource = path.join(repoRoot, ".next", "static");
const publicSource = path.join(repoRoot, "apps", "web", "public");
const certsSource = path.join(repoRoot, "certs");
const nodeSource = path.join(repoRoot, "resources", "node");
const standaloneDest = path.join(bundleRoot, "standalone");
const staticDest = path.join(standaloneDest, ".next", "static");
const publicDest = path.join(standaloneDest, "public");
const certsDest = path.join(standaloneDest, "certs");
const nodeDest = path.join(bundleRoot, "node");

function runNodeScript(label, scriptPath, args = []) {
  console.log(`[tauri:prepare] ${label}...`);
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: repoRoot,
    env: process.env,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(typeof result.status === "number" ? result.status : 1);
  }
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    return false;
  }

  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true, force: true, dereference: true });
  return true;
}

function resolveStandaloneServer(standaloneDir) {
  const candidates = [
    path.join(standaloneDir, "server.js"),
    path.join(standaloneDir, "apps", "web", "server.js"),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function resolveBundledNode(nodeDir) {
  const candidates = [
    path.join(nodeDir, "node.exe"),
    path.join(nodeDir, "bin", "node"),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

runNodeScript(
  "Building standalone web bundle for Tauri",
  path.join(repoRoot, "apps", "desktop", "scripts", "load-env-build.js"),
  ["cross-env ELECTRON_BUILD=true pnpm run build:web"],
);

runNodeScript(
  "Ensuring bundled Node.js runtime is present",
  path.join(repoRoot, "apps", "desktop", "scripts", "download-node.js"),
);

if (!fs.existsSync(standaloneSource)) {
  console.error(
    `[tauri:prepare] Missing standalone output: ${standaloneSource}`,
  );
  process.exit(1);
}

const standaloneServer = resolveStandaloneServer(standaloneSource);
if (!standaloneServer) {
  console.error(
    `[tauri:prepare] Standalone server entry not found under: ${standaloneSource}`,
  );
  process.exit(1);
}

if (!resolveBundledNode(nodeSource)) {
  console.error(
    `[tauri:prepare] Bundled Node.js runtime not found under: ${nodeSource}`,
  );
  process.exit(1);
}

console.log("[tauri:prepare] Staging Tauri bundle resources...");
fs.rmSync(bundleRoot, { recursive: true, force: true });
fs.mkdirSync(bundleRoot, { recursive: true });

copyDir(standaloneSource, standaloneDest);
copyDir(nodeSource, nodeDest);

if (!copyDir(standaloneStaticSource, staticDest)) {
  console.warn(
    `[tauri:prepare] Warning: static asset directory missing: ${standaloneStaticSource}`,
  );
}

if (!copyDir(publicSource, publicDest)) {
  console.warn(
    `[tauri:prepare] Warning: public asset directory missing: ${publicSource}`,
  );
}

if (fs.existsSync(certsSource)) {
  copyDir(certsSource, certsDest);
}

for (const bundledEnvPath of [
  path.join(standaloneDest, ".env"),
  path.join(standaloneDest, ".env.local"),
]) {
  if (fs.existsSync(bundledEnvPath)) {
    fs.rmSync(bundledEnvPath, { force: true });
  }
}

console.log("[tauri:prepare] Bundle staged successfully.");
console.log("[tauri:prepare] Standalone server:", standaloneServer);
console.log("[tauri:prepare] Bundled resources:", bundleRoot);
console.log(
  "[tauri:prepare] Note: no plaintext env file is bundled; use STARCHILD_ENV_FILE or place .env.local next to the packaged app.",
);
