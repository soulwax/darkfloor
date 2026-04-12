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

function getPnpmInvocations() {
  const invocations = [];
  const seen = new Set();

  const pushInvocation = (command, args = []) => {
    const key = `${command}\0${args.join("\0")}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    invocations.push({ command, args });
  };

  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath && /pnpm/i.test(path.basename(npmExecPath))) {
    pushInvocation(process.execPath, [npmExecPath]);
  }

  const bundledCorepackPnpm = path.join(
    path.dirname(process.execPath),
    "node_modules",
    "corepack",
    "dist",
    "pnpm.js",
  );

  if (fs.existsSync(bundledCorepackPnpm)) {
    pushInvocation(process.execPath, [bundledCorepackPnpm]);
  }

  if (process.platform === "win32") {
    pushInvocation("pnpm.cmd");
  }

  pushInvocation("pnpm");
  return invocations;
}

let lastError = null;

for (const invocation of getPnpmInvocations()) {
  const result = spawnSync(
    invocation.command,
    [...invocation.args, "--dir", submoduleDir, ...pnpmArgs],
    {
      cwd: repoRoot,
      stdio: "inherit",
      env: process.env,
    },
  );

  if (!result.error) {
    process.exit(result.status ?? 1);
  }

  lastError = result.error;
  if (result.error.code !== "ENOENT") {
    console.error(result.error.message);
    process.exit(1);
  }
}

console.error(
  lastError?.code === "ENOENT"
    ? "pnpm is not available via PATH, npm_execpath, or the bundled Corepack runtime."
    : lastError?.message ?? "Unable to start pnpm.",
);
process.exit(1);
