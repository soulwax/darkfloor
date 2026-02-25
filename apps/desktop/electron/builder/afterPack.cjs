// File: apps/desktop/electron/builder/afterPack.cjs

const fs = require("fs");
const path = require("path");

/**
 * electron-builder afterPack hook.
 *
 * Ensures Next.js standalone output is shipped exactly as emitted by Next,
 * including `.next/standalone/node_modules`, which electron-builder may
 * otherwise exclude when copying `extraResources`.
 *
 * @param {import("electron-builder").AfterPackContext} context
 */
module.exports = async function afterPack(context) {
  const projectDir = context?.packager?.info?.projectDir;
  const appOutDir = context?.appOutDir;

  if (!projectDir || !appOutDir) return;

  const srcStandalone = path.join(projectDir, ".next", "standalone");
  // Ship standalone next to the app (extraFiles) so NSIS installer includes it
  // including node_modules. extraResources can omit files in the installed app.
  const destStandalone = path.join(appOutDir, ".next", "standalone");

  if (!fs.existsSync(srcStandalone)) {
    console.warn("[afterPack] Next standalone output missing:", srcStandalone);
    return;
  }

  console.log("[afterPack] Copying Next standalone output to:", destStandalone);

  fs.rmSync(destStandalone, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(destStandalone), { recursive: true });
  fs.cpSync(srcStandalone, destStandalone, {
    recursive: true,
    dereference: true,
  });

  /**
   * Materialize symlinked module aliases that can otherwise become absolute
   * links to build-machine paths inside linux-unpacked/AppImage.
   *
   * @param {string} modulesDir
   * @returns {number}
   */
  const materializeSymlinkModules = (modulesDir) => {
    if (!fs.existsSync(modulesDir)) return 0;

    const entries = fs.readdirSync(modulesDir, { withFileTypes: true });
    let replaced = 0;

    for (const entry of entries) {
      if (!entry.isSymbolicLink()) continue;

      const entryPath = path.join(modulesDir, entry.name);
      const targetPath = fs.realpathSync(entryPath);
      const targetStat = fs.statSync(targetPath);

      fs.rmSync(entryPath, { recursive: true, force: true });

      if (targetStat.isDirectory()) {
        fs.cpSync(targetPath, entryPath, { recursive: true, dereference: true });
      } else {
        fs.copyFileSync(targetPath, entryPath);
      }

      replaced += 1;
      console.log(
        `[afterPack] Materialized symlink module alias: ${entry.name} -> ${targetPath}`,
      );
    }

    return replaced;
  };

  const aliasedNodeModules = path.join(destStandalone, ".next", "node_modules");
  const materializedAliases = materializeSymlinkModules(aliasedNodeModules);
  if (materializedAliases > 0) {
    console.log(
      `[afterPack] Materialized ${materializedAliases} aliased module symlink(s) in packaged standalone output.`,
    );
  }

  // Ensure installed packages, server, and static assets are delivered in the built app
  const destNodeModules = path.join(destStandalone, "node_modules");
  const destServerCandidates = [
    path.join(destStandalone, "server.js"),
    path.join(destStandalone, "apps", "web", "server.js"),
  ];
  const destServerJs = destServerCandidates.find((candidate) =>
    fs.existsSync(candidate),
  );
  const destStaticDir = path.join(destStandalone, ".next", "static");
  const missing = [];
  if (!fs.existsSync(destNodeModules)) missing.push("node_modules");
  if (!destServerJs) missing.push("server.js");
  if (!fs.existsSync(destStaticDir)) missing.push(".next/static");
  if (!fs.existsSync(aliasedNodeModules)) missing.push(".next/node_modules");

  const turbopackRuntimePath = path.join(
    destStandalone,
    ".next",
    "server",
    "chunks",
    "[turbopack]_runtime.js",
  );
  if (fs.existsSync(turbopackRuntimePath) && fs.existsSync(aliasedNodeModules)) {
    const runtimeSource = fs.readFileSync(turbopackRuntimePath, "utf8");
    const matches = runtimeSource.match(/\bpg-[a-f0-9]{8,}\b/g) ?? [];
    const requiredPgAliases = Array.from(new Set(matches));
    for (const alias of requiredPgAliases) {
      const aliasPath = path.join(aliasedNodeModules, alias);
      if (!fs.existsSync(aliasPath)) {
        missing.push(`.next/node_modules/${alias}`);
      }
    }
  }
  if (missing.length > 0) {
    const msg = `[afterPack] Packaged app missing required standalone files: ${missing.join(", ")}. Installer would be broken.`;

    console.error(msg);
    throw new Error(msg);
  }

  console.log(
    "[afterPack] Verified standalone node_modules, server.js, and .next/static are present in packaged app.",
  );

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
