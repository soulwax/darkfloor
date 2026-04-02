#!/usr/bin/env node
// File: apps/desktop/scripts/prepare-tauri-bundle-no-build.cjs

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const desktopDir = path.resolve(__dirname, "..");
const repoRoot = path.resolve(desktopDir, "../..");
const bundleRoot = path.join(desktopDir, "src-tauri", "b");
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
const runtimeSource = path.join(
  repoRoot,
  "apps",
  "desktop",
  "scripts",
  "resolve-runtime-env.cjs",
);
const runtimeDest = path.join(bundleRoot, "runtime", "resolve-runtime-env.cjs");
const runtimeBundleDest = path.join(
  bundleRoot,
  "runtime",
  "tauri-runtime-env.json",
);

function runNodeScript(label, scriptPath, args = []) {
  console.log(`[tauri:prepare:no-build] ${label}...`);
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

/**
 * @returns {void}
 */
function stripBundledTauriEnvSecrets() {
  for (const bundledPath of [
    path.join(standaloneDest, ".env"),
    path.join(standaloneDest, ".env.local"),
    path.join(standaloneDest, ".env.enc"),
    path.join(standaloneDest, ".env.local.enc"),
    path.join(certsDest, "ca.key"),
    path.join(certsDest, "starchild-env-private.key"),
    path.join(certsDest, "starchild-env-public.pem"),
  ]) {
    if (fs.existsSync(bundledPath)) {
      fs.rmSync(bundledPath, { force: true });
    }
  }
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
  "Ensuring bundled Node.js runtime is present",
  path.join(repoRoot, "apps", "desktop", "scripts", "download-node.js"),
);

if (!fs.existsSync(standaloneSource)) {
  console.error(
    `[tauri:prepare:no-build] Missing standalone output: ${standaloneSource}`,
  );
  console.error(
    `[tauri:prepare:no-build] Build the web bundle first, or run "pnpm tauri:prepare" if you want Tauri to rebuild it for you.`,
  );
  process.exit(1);
}

const standaloneServer = resolveStandaloneServer(standaloneSource);
if (!standaloneServer) {
  console.error(
    `[tauri:prepare:no-build] Standalone server entry not found under: ${standaloneSource}`,
  );
  process.exit(1);
}

if (!resolveBundledNode(nodeSource)) {
  console.error(
    `[tauri:prepare:no-build] Bundled Node.js runtime not found under: ${nodeSource}`,
  );
  process.exit(1);
}

console.log("[tauri:prepare:no-build] Staging Tauri bundle from existing outputs...");
fs.rmSync(bundleRoot, { recursive: true, force: true });
fs.mkdirSync(bundleRoot, { recursive: true });

copyDir(standaloneSource, standaloneDest);
copyDir(nodeSource, nodeDest);
copyDir(runtimeSource, runtimeDest);
runNodeScript(
  "Preparing obfuscated Tauri runtime env bundle",
  path.join(
    repoRoot,
    "apps",
    "desktop",
    "scripts",
    "prepare-tauri-runtime-env.cjs",
  ),
  [],
);

if (!copyDir(standaloneStaticSource, staticDest)) {
  console.warn(
    `[tauri:prepare:no-build] Warning: static asset directory missing: ${standaloneStaticSource}`,
  );
}

if (!copyDir(publicSource, publicDest)) {
  console.warn(
    `[tauri:prepare:no-build] Warning: public asset directory missing: ${publicSource}`,
  );
}

if (fs.existsSync(certsSource)) {
  copyDir(certsSource, certsDest);
}

stripBundledTauriEnvSecrets();

console.log("[tauri:prepare:no-build] Bundle staged successfully.");
console.log("[tauri:prepare:no-build] Standalone server:", standaloneServer);
console.log("[tauri:prepare:no-build] Bundled resources:", bundleRoot);
console.log("[tauri:prepare:no-build] Runtime env bundle:", runtimeBundleDest);
console.log(
  "[tauri:prepare:no-build] Note: packaged builds prefer the bundled encrypted env payload plus the obfuscated key bundle. You can still override with STARCHILD_ENV_FILE or STARCHILD_ENC_ENV_FILE.",
);
