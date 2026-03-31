// File: apps/desktop/electron/builder/afterPack.cjs

const fs = require("fs");
const path = require("path");

/**
 * electron-builder afterPack hook.
 *
 * Ensures Next.js standalone output is shipped exactly as emitted by Next.
 * Some builds also include `.next/node_modules` alias entries; when present,
 * materialize them so packaged runtimes don't keep broken absolute symlinks.
 *
 * @param {import("electron-builder").AfterPackContext} context
 */
module.exports = async function afterPack(context) {
  const projectDir = context?.packager?.info?.projectDir;
  const appOutDir = context?.appOutDir;

  if (!projectDir || !appOutDir) return;

  const srcStandalone = path.join(projectDir, ".next", "standalone");
  const standaloneDestinations = [
    {
      dir: path.join(appOutDir, ".next", "standalone"),
      label: "app directory",
    },
  ];

  if (process.platform === "win32") {
    standaloneDestinations.unshift({
      dir: path.join(appOutDir, "resources", ".next", "standalone"),
      label: "resources directory",
    });
  }

  if (!fs.existsSync(srcStandalone)) {
    console.warn("[afterPack] Next standalone output missing:", srcStandalone);
    return;
  }

  /**
   * Materialize symlinked modules so packaged runtimes don't keep absolute
   * links back to the build machine's pnpm store or workspace.
   *
   * @param {string} modulesDir
   * @param {string} label
   * @returns {number}
   */
  const materializeSymlinkModules = (modulesDir, label) => {
    if (!fs.existsSync(modulesDir)) return 0;

    let replaced = 0;

    /**
     * @param {string} currentDir
     * @returns {void}
     */
    const walk = (currentDir) => {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = path.join(currentDir, entry.name);

        if (entry.isSymbolicLink()) {
          const targetPath = fs.realpathSync(entryPath);
          const targetStat = fs.statSync(targetPath);

          fs.rmSync(entryPath, { recursive: true, force: true });

          if (targetStat.isDirectory()) {
            fs.cpSync(targetPath, entryPath, {
              recursive: true,
              dereference: true,
            });
            walk(entryPath);
          } else {
            fs.copyFileSync(targetPath, entryPath);
          }

          replaced += 1;
          console.log(
            `[afterPack] Materialized symlink in ${label}: ${path.relative(modulesDir, entryPath)} -> ${targetPath}`,
          );
          continue;
        }

        if (entry.isDirectory()) {
          walk(entryPath);
        }
      }
    };

    walk(modulesDir);
    return replaced;
  };

  /**
   * Hoist traced pnpm packages into the packaged top-level node_modules so
   * isolated runtimes can resolve bare imports used by Next internals.
   *
   * @param {string} modulesDir
   * @returns {number}
   */
  const hoistPnpmPackages = (modulesDir) => {
    const pnpmDir = path.join(modulesDir, ".pnpm");
    if (!fs.existsSync(pnpmDir)) return 0;

    let hoisted = 0;

    /**
     * @param {string} packageName
     * @param {string} sourcePath
     * @returns {void}
     */
    const hoistPackage = (packageName, sourcePath) => {
      const repoPackagePath = path.join(
        projectDir,
        "node_modules",
        ...packageName.split("/"),
      );
      const targetPath = path.join(modulesDir, ...packageName.split("/"));
      if (fs.existsSync(targetPath)) return;

      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      const preferredSourcePath = fs.existsSync(repoPackagePath)
        ? repoPackagePath
        : sourcePath;
      fs.cpSync(preferredSourcePath, targetPath, {
        recursive: true,
        dereference: true,
      });
      hoisted += 1;
      console.log(
        `[afterPack] Hoisted package into packaged standalone node_modules: ${packageName}`,
      );
    };

    /**
     * @param {string} packageNodeModulesDir
     * @returns {void}
     */
    const scanPackageNodeModules = (packageNodeModulesDir) => {
      if (!fs.existsSync(packageNodeModulesDir)) return;

      const entries = fs.readdirSync(packageNodeModulesDir, {
        withFileTypes: true,
      });
      for (const entry of entries) {
        if (entry.name === ".bin") continue;

        const entryPath = path.join(packageNodeModulesDir, entry.name);
        if (entry.name.startsWith("@")) {
          if (!entry.isDirectory()) continue;
          const scopedEntries = fs.readdirSync(entryPath, {
            withFileTypes: true,
          });
          for (const scopedEntry of scopedEntries) {
            const scopedPath = path.join(entryPath, scopedEntry.name);
            if (!scopedEntry.isDirectory() && !scopedEntry.isSymbolicLink()) {
              continue;
            }
            hoistPackage(`${entry.name}/${scopedEntry.name}`, scopedPath);
          }
          continue;
        }

        if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
        hoistPackage(entry.name, entryPath);
      }
    };

    const pnpmEntries = fs.readdirSync(pnpmDir, { withFileTypes: true });
    for (const entry of pnpmEntries) {
      if (!entry.isDirectory()) continue;
      scanPackageNodeModules(path.join(pnpmDir, entry.name, "node_modules"));
    }

    return hoisted;
  };

  /**
   * @param {string} standaloneDir
   * @returns {string | undefined}
   */
  const resolveStandaloneServerPath = (standaloneDir) => {
    const candidates = [
      path.join(standaloneDir, "server.js"),
      path.join(standaloneDir, "apps", "web", "server.js"),
    ];
    return candidates.find((candidate) => fs.existsSync(candidate));
  };

  /**
   * @param {string} destStandalone
   * @param {string} label
   * @returns {void}
   */
  const verifyStandaloneBundle = (destStandalone, label) => {
    const destNodeModules = path.join(destStandalone, "node_modules");
    const materializedStandaloneNodeModules = materializeSymlinkModules(
      destNodeModules,
      `${label} node_modules`,
    );
    if (materializedStandaloneNodeModules > 0) {
      console.log(
        `[afterPack] Materialized ${materializedStandaloneNodeModules} symlink(s) in ${label} standalone node_modules.`,
      );
    }

    const hoistedStandalonePackages = hoistPnpmPackages(destNodeModules);
    if (hoistedStandalonePackages > 0) {
      console.log(
        `[afterPack] Hoisted ${hoistedStandalonePackages} traced package(s) into ${label} standalone node_modules.`,
      );
    }

    const aliasedNodeModules = path.join(
      destStandalone,
      ".next",
      "node_modules",
    );
    const hasAliasedNodeModules = fs.existsSync(aliasedNodeModules);
    if (hasAliasedNodeModules) {
      const materializedAliases = materializeSymlinkModules(
        aliasedNodeModules,
        `${label} .next/node_modules`,
      );
      if (materializedAliases > 0) {
        console.log(
          `[afterPack] Materialized ${materializedAliases} symlink(s) in ${label} standalone .next/node_modules.`,
        );
      }
    } else {
      console.log(
        `[afterPack] No .next/node_modules alias directory found in ${label} standalone output; skipping alias materialization.`,
      );
    }

    const destServerJs = resolveStandaloneServerPath(destStandalone);
    const destBuildId = path.join(destStandalone, ".next", "BUILD_ID");
    const destStaticDir = path.join(destStandalone, ".next", "static");
    const missing = [];
    if (!fs.existsSync(destNodeModules)) missing.push("node_modules");
    if (!destServerJs) missing.push("server.js");
    if (!fs.existsSync(destBuildId)) missing.push(".next/BUILD_ID");
    if (!fs.existsSync(destStaticDir)) missing.push(".next/static");

    const turbopackRuntimePath = path.join(
      destStandalone,
      ".next",
      "server",
      "chunks",
      "[turbopack]_runtime.js",
    );
    if (fs.existsSync(turbopackRuntimePath)) {
      const runtimeSource = fs.readFileSync(turbopackRuntimePath, "utf8");
      const matches = runtimeSource.match(/\bpg-[a-f0-9]{8,}\b/g) ?? [];
      const requiredPgAliases = Array.from(new Set(matches));

      if (requiredPgAliases.length > 0 && !hasAliasedNodeModules) {
        missing.push(".next/node_modules");
      } else {
        for (const alias of requiredPgAliases) {
          const aliasPath = path.join(aliasedNodeModules, alias);
          if (!fs.existsSync(aliasPath)) {
            missing.push(`.next/node_modules/${alias}`);
          }
        }
      }
    }

    if (missing.length > 0) {
      const msg = `[afterPack] ${label} standalone bundle is missing required files: ${missing.join(", ")}. Packaged app would be broken.`;

      console.error(msg);
      throw new Error(msg);
    }

    console.log(
      `[afterPack] Verified ${label} standalone bundle includes node_modules, server.js, .next/BUILD_ID, and .next/static.`,
    );
  };

  for (const destination of standaloneDestinations) {
    console.log(
      `[afterPack] Copying Next standalone output to ${destination.label}:`,
      destination.dir,
    );

    fs.rmSync(destination.dir, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(destination.dir), { recursive: true });
    fs.cpSync(srcStandalone, destination.dir, {
      recursive: true,
      dereference: true,
    });

    verifyStandaloneBundle(destination.dir, destination.label);
  }

  // Ensure bundled Node.js runtime is present so the installed app can run the server without system Node
  const resourcesNode = path.join(appOutDir, "resources", "node");
  const nodeBinary = path.join(
    resourcesNode,
    process.platform === "win32" ? "node.exe" : "bin/node",
  );
  if (!fs.existsSync(nodeBinary)) {
    const msg = `[afterPack] Bundled Node.js not found at ${nodeBinary}. Run "npm run electron:download-node" before building.`;

    console.error(msg);
    throw new Error(msg);
  }

  console.log(
    "[afterPack] Verified bundled Node.js runtime is present in packaged app.",
  );
};
