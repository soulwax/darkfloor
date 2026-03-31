// File: apps/desktop/electron/verify-build.js

const fs = require("fs");
const path = require("path");
const repoRoot = path.resolve(__dirname, "../../..");
const webNextDir = path.join(repoRoot, "apps", "web", ".next");

console.log("🔍 Checking Next.js build output...\n");

const resolveFirstExisting = (paths) => {
  for (const candidate of paths) {
    const fullPath = path.join(repoRoot, candidate);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }
  return path.join(repoRoot, paths[0]);
};

const checks = [
  {
    name: "Standalone server",
    path: resolveFirstExisting([
      "apps/web/.next/standalone/server.js",
      "apps/web/.next/standalone/apps/web/server.js",
    ]),
    required: true,
  },
  {
    name: "Standalone package.json",
    path: resolveFirstExisting([
      "apps/web/.next/standalone/package.json",
      "apps/web/.next/standalone/apps/web/package.json",
    ]),
    required: true,
  },
  {
    name: "Static files",
    path: path.join(webNextDir, "static"),
    required: true,
  },
  {
    name: "Build manifest",
    path: path.join(webNextDir, "build-manifest.json"),
    required: false,
  },
];

let allGood = true;

checks.forEach((check) => {
  const fullPath = check.path;
  const exists = fs.existsSync(fullPath);

  const icon = exists ? "✅" : check.required ? "❌" : "⚠️";
  console.log(`${icon} ${check.name}`);
  console.log(`   ${fullPath}`);

  if (!exists && check.required) {
    allGood = false;
  }

  if (exists) {
    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
      const files = fs.readdirSync(fullPath);
      console.log(`   (${files.length} files/folders)`);
    } else {
      console.log(`   (${(stats.size / 1024).toFixed(2)} KB)`);
    }
  }
  console.log("");
});

if (allGood) {
  console.log("✅ All required files present! Build looks good.\n");
  console.log("Next steps:");
  console.log("  1. Run: npm run electron:build:win");
  console.log("  2. Check: dist/win-unpacked/Starchild.exe");
  console.log("  3. Runtime logs: app.getPath('userData')/logs/electron-main.log\n");
} else {
  console.log("❌ Build verification failed!\n");
  console.log("The standalone server was not created. This means:");
  console.log("  1. Next.js build may have failed");
  console.log("  2. The output mode in next.config.js may be wrong\n");
  console.log("To fix:");
  console.log('  1. Check next.config.js has: output: "standalone"');
  console.log("  2. Run: npm run electron:build (or electron:build:win etc.)");
  console.log("  3. Run this script again: node electron/verify-build.js\n");
}

process.exit(allGood ? 0 : 1);
