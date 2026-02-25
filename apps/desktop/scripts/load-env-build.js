#!/usr/bin/env node
// File: apps/desktop/scripts/load-env-build.js

import { execSync } from "child_process";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");

dotenv.config({ path: path.resolve(repoRoot, ".env.local") });

const command = process.argv.slice(2).join(" ");
const localBinPath = path.resolve(repoRoot, "node_modules/.bin");
const delimiter = path.delimiter;
const existingPath = process.env.PATH ?? process.env.Path ?? "";
const mergedPath = existingPath
  ? `${localBinPath}${delimiter}${existingPath}`
  : localBinPath;

const childEnv = {
  ...process.env,
  PATH: mergedPath,
};

if ("Path" in process.env) {
  childEnv.Path = mergedPath;
}

if (!command) {
  console.error("❌ No command provided");
  console.log("Usage: node load-env-build.js <command>");
  process.exit(1);
}

console.log(`🔧 Loading environment from .env.local only`);
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
