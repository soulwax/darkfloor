#!/usr/bin/env node
// File: apps/desktop/scripts/run-tauri-cli.cjs

const path = require("path");
const { spawnSync } = require("child_process");

const desktopDir = path.resolve(__dirname, "..");
const repoRoot = path.resolve(desktopDir, "../..");

function resolveTauriCliPath() {
  for (const searchRoot of [desktopDir, repoRoot]) {
    try {
      return require.resolve("@tauri-apps/cli/tauri.js", {
        paths: [searchRoot],
      });
    } catch {}
  }

  return null;
}

function runTauriCli(args, options = {}) {
  const tauriCliPath = resolveTauriCliPath();
  if (!tauriCliPath) {
    console.error(
      "[tauri:cli] Tauri CLI entrypoint was not found. Run `pnpm install --frozen-lockfile` from the repo root so `@tauri-apps/cli` is available.",
    );
    return 1;
  }

  const result = spawnSync(process.execPath, [tauriCliPath, ...args], {
    cwd: options.cwd ?? desktopDir,
    env: options.env ?? process.env,
    stdio: options.stdio ?? "inherit",
  });

  return typeof result.status === "number" ? result.status : 1;
}

if (require.main === module) {
  process.exit(runTauriCli(process.argv.slice(2)));
}

module.exports = {
  resolveTauriCliPath,
  runTauriCli,
};
