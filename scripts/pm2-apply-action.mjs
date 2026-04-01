#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const validActions = new Set(["restart", "reload"]);
const [, , action, envName = "production", ...appNames] = process.argv;

if (!validActions.has(action) || appNames.length === 0) {
  console.error(
    "Usage: node scripts/pm2-apply-action.mjs <restart|reload> <env> <app-name> [app-name...]",
  );
  process.exit(1);
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const ecosystemConfigPath = path.join(repoRoot, "ecosystem.config.cjs");
const pm2Command =
  action === "reload" ? "startOrReload" : "startOrRestart";

function runPm2(args, appName) {
  const result = spawnSync("pm2", args, {
    cwd: repoRoot,
    encoding: "utf8",
  });

  if (result.error) {
    if (result.error.code === "ENOENT") {
      console.error(
        "PM2 is not available in PATH. Install PM2 or run this command in the deployment environment where PM2 is installed.",
      );
    } else {
      console.error(`Failed to run PM2 for ${appName}: ${result.error.message}`);
    }
    process.exit(1);
  }

  if (result.stdout.trim()) {
    process.stdout.write(result.stdout);
  }

  if (result.stderr.trim()) {
    process.stderr.write(result.stderr);
  }

  if (result.status !== 0) {
    console.error(
      `PM2 ${pm2Command} failed for ${appName} with exit code ${result.status ?? 1}.`,
    );
    process.exit(result.status ?? 1);
  }
}

for (const appName of appNames) {
  console.log(`Applying PM2 ${pm2Command} for ${appName} (${envName})...`);
  runPm2(
    [
      pm2Command,
      ecosystemConfigPath,
      "--only",
      appName,
      "--env",
      envName,
      "--update-env",
    ],
    appName,
  );
}
