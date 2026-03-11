// File: apps/desktop/electron/prepare-package.js

const fs = require("fs");
const path = require("path");

/**
 * @typedef {Object} PathConfig
 * @property {string} rootDir - Root directory of the project
 * @property {string} standaloneDir - Standalone output directory
 * @property {string} staticSource - Source directory for static files
 * @property {string} staticDest - Destination directory for static files
 * @property {string} publicSource - Source directory for public files
 * @property {string} publicDest - Destination directory for public files
 */

console.log("[Prepare] Preparing standalone package for Electron...\n");

const rootDir = path.resolve(__dirname, "../../..");
const standaloneDir = path.join(rootDir, ".next", "standalone");
const standaloneServerCandidates = [
  path.join(standaloneDir, "server.js"),
  path.join(standaloneDir, "apps", "web", "server.js"),
];
const standalonePackageCandidates = [
  path.join(standaloneDir, "package.json"),
  path.join(standaloneDir, "apps", "web", "package.json"),
];

// Ensure Next.js standalone output includes installed packages and server (fail early if not)
const standaloneNodeModules = path.join(standaloneDir, "node_modules");
const standaloneServerJs = standaloneServerCandidates.find((candidate) =>
  fs.existsSync(candidate),
);
const standalonePackageJson = standalonePackageCandidates.find((candidate) =>
  fs.existsSync(candidate),
);
if (
  !fs.existsSync(standaloneNodeModules) ||
  !standaloneServerJs ||
  !standalonePackageJson
) {
  console.error("[Prepare] ERROR: .next/standalone is incomplete. Required: node_modules and server.js.");
  console.error("[Prepare] Run 'next build' with ELECTRON_BUILD=true first. Standalone dir:", standaloneDir);
  process.exit(1);
}
console.log("[Prepare] Verified .next/standalone has node_modules and server.js");
console.log("[Prepare] Server entry:", standaloneServerJs);
console.log("[Prepare] Package entry:", standalonePackageJson, "\n");
const staticSource = path.join(rootDir, ".next", "static");
const staticDest = path.join(standaloneDir, ".next", "static");
const publicSource = path.join(rootDir, "apps", "web", "public");
const publicDest = path.join(standaloneDir, "public");
const certsSource = path.join(rootDir, "certs");
const certsDest = path.join(standaloneDir, "certs");

/**
 * Helper function to copy directory recursively
 * @param {string} src - Source directory path
 * @param {string} dest - Destination directory path
 * @returns {void}
 */
function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`[Prepare] Warning: Source directory not found: ${src}`);
    return;
  }

    fs.mkdirSync(dest, { recursive: true });

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Replace symlinked modules with real directories/files.
 * This covers both pnpm-linked packages under `node_modules` and optional
 * Turbopack alias entries under `.next/node_modules`.
 *
 * @param {string} modulesDir
 * @param {string} label
 * @returns {number}
 */
function materializeSymlinkModules(modulesDir, label) {
  if (!fs.existsSync(modulesDir)) return 0;

  let replaced = 0;

  /**
   * @param {string} currentDir
   * @returns {void}
   */
  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(currentDir, entry.name);

      if (entry.isSymbolicLink()) {
        const targetPath = fs.realpathSync(entryPath);
        const targetStat = fs.statSync(targetPath);

        fs.rmSync(entryPath, { recursive: true, force: true });

        if (targetStat.isDirectory()) {
          fs.cpSync(targetPath, entryPath, { recursive: true, dereference: true });
          walk(entryPath);
        } else {
          fs.copyFileSync(targetPath, entryPath);
        }

        replaced += 1;
        console.log(
          `[Prepare] Materialized symlink in ${label}: ${path.relative(modulesDir, entryPath)} -> ${targetPath}`,
        );
        continue;
      }

      if (entry.isDirectory()) {
        walk(entryPath);
      }
    }
  }

  walk(modulesDir);
  return replaced;
}

try {
  const materializedStandaloneNodeModules = materializeSymlinkModules(
    standaloneNodeModules,
    "node_modules",
  );
  if (materializedStandaloneNodeModules > 0) {
    console.log(
      `[Prepare] ✓ Materialized ${materializedStandaloneNodeModules} symlink(s) in standalone node_modules`,
    );
  } else {
    console.log("[Prepare] No symlinked packages detected in standalone node_modules");
  }

  const standaloneAliasedNodeModules = path.join(
    standaloneDir,
    ".next",
    "node_modules",
  );
  const materializedAliases = materializeSymlinkModules(
    standaloneAliasedNodeModules,
    ".next/node_modules",
  );
  if (materializedAliases > 0) {
    console.log(
      `[Prepare] ✓ Materialized ${materializedAliases} symlink(s) in standalone .next/node_modules`,
    );
  } else {
    console.log("[Prepare] No aliased module symlinks detected in standalone output");
  }

    console.log("[Prepare] Copying .next/static...");
  copyDir(staticSource, staticDest);
  console.log("[Prepare] ✓ Static files copied");

    console.log("[Prepare] Copying public...");
  copyDir(publicSource, publicDest);
  console.log("[Prepare] ✓ Public files copied");

    console.log("[Prepare] Generating database CA certificate...");
  const caCertPath = path.join(rootDir, "certs", "ca.pem");

  if (process.env.DB_SSL_CA) {
        fs.mkdirSync(path.join(rootDir, "certs"), { recursive: true });

        fs.writeFileSync(caCertPath, process.env.DB_SSL_CA);
    console.log("[Prepare] ✓ Generated ca.pem from DB_SSL_CA environment variable");
  } else if (!fs.existsSync(caCertPath)) {
    console.warn("[Prepare] ⚠️  Warning: DB_SSL_CA not set and certs/ca.pem doesn't exist");
    console.warn("[Prepare] ⚠️  Database SSL connections may fail in packaged app");
  } else {
    console.log("[Prepare] ✓ Using existing certs/ca.pem");
  }

    console.log("[Prepare] Copying certs to standalone directory...");
  copyDir(certsSource, certsDest);
  console.log("[Prepare] ✓ Certificate files copied to standalone");

  const envLocalSource = path.join(rootDir, ".env.local");
  const envLocalDest = path.join(standaloneDir, ".env.local");
  const envDest = path.join(standaloneDir, ".env");
  const includeBundledEnv = process.env.ELECTRON_INCLUDE_ENV === "true";

  // Never ship stale env files by default.
  for (const bundledEnvPath of [envLocalDest, envDest]) {
    if (fs.existsSync(bundledEnvPath)) {
      fs.rmSync(bundledEnvPath, { force: true });
      console.log(`[Prepare] Removed bundled env file: ${bundledEnvPath}`);
    }
  }

  if (includeBundledEnv) {
    if (fs.existsSync(envLocalSource)) {
      console.log("[Prepare] ELECTRON_INCLUDE_ENV=true, copying .env.local...");
      fs.copyFileSync(envLocalSource, envLocalDest);
      console.log("[Prepare] ✓ Environment configuration copied");
    } else {
      console.warn(
        "[Prepare] ⚠️  Warning: ELECTRON_INCLUDE_ENV=true but .env.local not found",
      );
    }
  } else {
    console.log(
      "[Prepare] Skipping bundled env copy (ELECTRON_INCLUDE_ENV is not true).",
    );
    console.log(
      "[Prepare] Runtime should use STARCHILD_ENV_FILE or OS environment variables.",
    );
  }

  if (process.env.ELECTRON_DEV_TOOLS === "true") {
    if (!includeBundledEnv || !fs.existsSync(envLocalDest)) {
      console.warn(
        "[Prepare] ELECTRON_DEV_TOOLS=true but no bundled env file exists; set ELECTRON_DEV_TOOLS in external env.",
      );
    } else {
      console.log("[Prepare] Adding dev tools flag to .env.local...");
      const envContent = fs.readFileSync(envLocalDest, "utf8");
      if (!envContent.includes("ELECTRON_DEV_TOOLS=true")) {
        fs.appendFileSync(envLocalDest, "ELECTRON_DEV_TOOLS=true\n");
        console.log("[Prepare] ✓ Added ELECTRON_DEV_TOOLS=true");
      } else {
        console.log("[Prepare] ✓ ELECTRON_DEV_TOOLS already present");
      }
    }
  }

  console.log("\n[Prepare] Package preparation complete!\n");
} catch (error) {
  console.error("[Prepare] Error preparing package:", error);
  process.exit(1);
}
