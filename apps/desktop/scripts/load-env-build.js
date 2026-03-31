#!/usr/bin/env node
// File: apps/desktop/scripts/load-env-build.js

import { execSync } from "child_process";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");

dotenv.config({ path: path.resolve(repoRoot, ".env.local"), quiet: true });

const command = process.argv.slice(2).join(" ");
const localBinPath = path.resolve(repoRoot, "node_modules/.bin");
const currentNodeBinPath = path.dirname(process.execPath);
const currentCorepackShimPath = path.resolve(
  currentNodeBinPath,
  "node_modules",
  "corepack",
  "shims",
);
const delimiter = path.delimiter;
const existingPath = process.env.PATH ?? process.env.Path ?? "";
const pathEntries = [
  localBinPath,
  currentNodeBinPath,
  currentCorepackShimPath,
];
if (existingPath) {
  pathEntries.push(existingPath);
}
const mergedPath = pathEntries.filter(Boolean).join(delimiter);

const childEnv = {
  ...process.env,
  PATH: mergedPath,
};

const electronBuildRequested =
  process.env.ELECTRON_BUILD === "true" || command.includes("ELECTRON_BUILD=true");

if (electronBuildRequested) {
  // Electron packaging only needs these values to satisfy Next.js env validation
  // during compilation. The packaged runtime still reads real values from .env.local.
  childEnv.AUTH_SECRET ??= "electron-build-placeholder-secret-1234567890";
  childEnv.AUTH_DISCORD_ID ??= "electron-build-placeholder-discord-id";
  childEnv.AUTH_DISCORD_SECRET ??=
    "electron-build-placeholder-discord-secret";
}

if ("Path" in process.env) {
  childEnv.Path = mergedPath;
}

if (!command) {
  console.error("❌ No command provided");
  console.log("Usage: node load-env-build.js <command>");
  process.exit(1);
}

console.log(`🔧 Loading environment from .env.local only`);
if (electronBuildRequested) {
  const placeholderKeys = [
    "AUTH_SECRET",
    "AUTH_DISCORD_ID",
    "AUTH_DISCORD_SECRET",
  ].filter((key) => !(key in process.env) || !process.env[key]);
  if (placeholderKeys.length > 0) {
    console.log(
      `🧱 Using Electron build placeholder env for: ${placeholderKeys.join(", ")}`,
    );
  }
}
console.log(`📦 Running: ${command}`);

try {
  execSync(command, {
    stdio: "inherit",
    env: childEnv,
    cwd: repoRoot,
  });
  console.log("✅ Command completed successfully");
} catch (error) {
  console.error("❌ Command failed");
  let exitCode = 1;
  if (error && typeof error === "object" && "status" in error) {
    exitCode = typeof error.status === "number" ? error.status : 1;
  }
  process.exit(exitCode);
}
