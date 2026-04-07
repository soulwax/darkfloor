#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const [, , submoduleName, ...pnpmArgs] = process.argv;

if (!submoduleName || pnpmArgs.length === 0) {
  console.error(
    "Usage: node scripts/run-submodule-pnpm.mjs <submodule-dir> <pnpm-args...>",
  );
  process.exit(1);
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const submoduleDir = path.resolve(repoRoot, submoduleName);
const submodulePackageJson = path.join(submoduleDir, "package.json");
const isVercel =
  process.env.VERCEL === "1" || process.env.VERCEL_ENV !== undefined;
const allowMissingSubmodule =
  isVercel || process.env.ALLOW_MISSING_SUBMODULE === "1";

if (!fs.existsSync(submodulePackageJson)) {
  const message = `Missing ${submoduleName}/package.json. Ensure the submodule is checked out before running this command.`;

  if (allowMissingSubmodule) {
    console.warn(
      `${message} Skipping because missing submodules are allowed in this environment.`,
    );
    process.exit(0);
  }

  console.error(message);
  process.exit(1);
}

const result = spawnSync("pnpm", ["--dir", submoduleDir, ...pnpmArgs], {
  cwd: repoRoot,
  stdio: "inherit",
  env: process.env,
});

if (result.error) {
  if (result.error.code === "ENOENT") {
    console.error("pnpm is not available in PATH.");
  } else {
    console.error(result.error.message);
  }
  process.exit(1);
}

process.exit(result.status ?? 1);
