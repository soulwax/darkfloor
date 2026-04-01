import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const repoRoot = process.cwd();
const requireFromRepo = createRequire(path.join(repoRoot, "package.json"));
const args = new Set(process.argv.slice(2));
const productionOnly = args.has("--production");
const strict = args.has("--strict");

const MANIFESTS = [
  {
    id: "root",
    relPath: "package.json",
    scanRoots: ["scripts", "apps", "packages"],
    scriptManifestPaths: [
      "package.json",
      "apps/web/package.json",
      "apps/mobile/package.json",
      "apps/desktop/package.json",
    ],
    implicitDependencies: [],
  },
  {
    id: "apps/web",
    relPath: "apps/web/package.json",
    scanRoots: ["apps/web"],
    scriptManifestPaths: ["apps/web/package.json"],
    implicitDependencies: [],
  },
  {
    id: "apps/mobile",
    relPath: "apps/mobile/package.json",
    scanRoots: ["apps/mobile"],
    scriptManifestPaths: ["apps/mobile/package.json"],
    implicitDependencies: ["react-dom", "react-native-web"],
  },
  {
    id: "apps/desktop",
    relPath: "apps/desktop/package.json",
    scanRoots: ["apps/desktop"],
    scriptManifestPaths: ["apps/desktop/package.json"],
    implicitDependencies: [],
  },
];

const SKIP_DIRS = new Set([
  ".git",
  ".next",
  ".turbo",
  ".tauri-bundle",
  ".tb",
  "coverage",
  "dist",
  "node_modules",
]);

const SCAN_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".cjs", ".mjs"]);
const IMPORT_PATTERNS = [
  /\bimport\s+(?:[^"'()]*?\s+from\s+)?["']([^"']+)["']/g,
  /\bexport\s+(?:[^"'()]*?\s+from\s+)?["']([^"']+)["']/g,
  /\brequire\(\s*["']([^"']+)["']\s*\)/g,
  /\bimport\(\s*["']([^"']+)["']\s*\)/g,
];

const implicitTypePackages = new Set(["@types/node", "@types/react", "@types/react-dom"]);

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relPath), "utf8"));
}

function isExcluded(relPath) {
  const normalized = relPath.split(path.sep).join("/");
  if (
    normalized.startsWith("api/") ||
    normalized.startsWith("apps/desktop/src-tauri/b/") ||
    normalized.startsWith("apps/desktop/src-tauri/gen/") ||
    normalized.startsWith("apps/desktop/src-tauri/target/") ||
    normalized === "apps/desktop/src-tauri/tauri.no-prepare.generated.json"
  ) {
    return true;
  }

  return normalized.split("/").some((segment) => SKIP_DIRS.has(segment));
}

function collectFilesFromRoot(relRoot, results) {
  const absRoot = path.join(repoRoot, relRoot);

  if (!fs.existsSync(absRoot)) {
    return;
  }

  const entries = fs.readdirSync(absRoot, { withFileTypes: true });
  for (const entry of entries) {
    const absPath = path.join(absRoot, entry.name);
    const relPath = path.relative(repoRoot, absPath);

    if (isExcluded(relPath)) {
      continue;
    }

    if (entry.isDirectory()) {
      collectFilesFromRoot(relPath, results);
      continue;
    }

    if (entry.name === "app.json") {
      results.push(relPath);
      continue;
    }

    if (SCAN_EXTENSIONS.has(path.extname(entry.name))) {
      results.push(relPath);
    }
  }
}

function normalizePackageSpecifier(specifier) {
  if (
    !specifier ||
    specifier.startsWith(".") ||
    specifier.startsWith("/") ||
    specifier.startsWith("@/") ||
    specifier.startsWith("~/") ||
    specifier.startsWith("#") ||
    specifier.startsWith("node:") ||
    specifier.includes("://")
  ) {
    return null;
  }

  if (specifier.startsWith("@")) {
    const [scope, name] = specifier.split("/");
    return scope && name ? `${scope}/${name}` : specifier;
  }

  return specifier.split("/")[0] ?? null;
}

function collectImportsFromCode(content) {
  const packages = new Set();

  for (const pattern of IMPORT_PATTERNS) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const pkg = normalizePackageSpecifier(match[1]);
      if (pkg) {
        packages.add(pkg);
      }
    }
  }

  return packages;
}

function collectStringPackagesFromConfig(content) {
  const packages = new Set();
  const pattern = /["']([^"'\\]+)["']/g;

  let match;
  while ((match = pattern.exec(content)) !== null) {
    const pkg = normalizePackageSpecifier(match[1]);
    if (pkg) {
      packages.add(pkg);
    }
  }

  return packages;
}

function collectStringsFromJson(value, results) {
  if (typeof value === "string") {
    results.add(value);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectStringsFromJson(item, results);
    }
    return;
  }

  if (value && typeof value === "object") {
    for (const nestedValue of Object.values(value)) {
      collectStringsFromJson(nestedValue, results);
    }
  }
}

function getDependencySections(manifest) {
  return {
    dependencies: manifest.dependencies ?? {},
    devDependencies: productionOnly ? {} : manifest.devDependencies ?? {},
    optionalDependencies: manifest.optionalDependencies ?? {},
  };
}

function looksLikeConfigFile(relPath) {
  const baseName = path.basename(relPath).toLowerCase();
  return baseName.includes("config") || baseName.endsWith(".rc.js") || baseName.endsWith(".rc.ts");
}

function getDeclaredDependencyNames(sections) {
  return new Set(
    Object.values(sections).flatMap((entries) => Object.keys(entries)),
  );
}

function resolveBinaryNames(depName, manifestDir) {
  const fallback = new Set([depName, depName.split("/").pop() ?? depName]);

  try {
    const packageJsonPath = requireFromRepo.resolve(`${depName}/package.json`, {
      paths: [manifestDir, repoRoot],
    });
    const depPackageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    const bins = depPackageJson.bin;

    if (!bins) {
      return [...fallback];
    }

    if (typeof bins === "string") {
      return [...fallback];
    }

    return [...new Set([...fallback, ...Object.keys(bins)])];
  } catch {
    return [...fallback];
  }
}

function scriptUsesBinary(script, binaryName) {
  const escaped = binaryName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(^|[\\s"';&|()])${escaped}(?=($|[\\s"';&|()]))`);
  return pattern.test(script);
}

function collectUsedDependencies(config, manifest, sections) {
  const declaredNames = getDeclaredDependencyNames(sections);
  const used = new Set(config.implicitDependencies);

  for (const relRoot of config.scanRoots) {
    const files = [];
    collectFilesFromRoot(relRoot, files);

    for (const relPath of files) {
      const absPath = path.join(repoRoot, relPath);

      if (path.basename(relPath) === "app.json") {
        const strings = new Set();
        collectStringsFromJson(JSON.parse(fs.readFileSync(absPath, "utf8")), strings);
        for (const depName of declaredNames) {
          if (strings.has(depName)) {
            used.add(depName);
          }
        }
        continue;
      }

      const content = fs.readFileSync(absPath, "utf8");
      for (const pkg of collectImportsFromCode(content)) {
        if (declaredNames.has(pkg)) {
          used.add(pkg);
        }
      }

      if (looksLikeConfigFile(relPath)) {
        for (const pkg of collectStringPackagesFromConfig(content)) {
          if (declaredNames.has(pkg)) {
            used.add(pkg);
          }
        }
      }
    }
  }

  const manifestDir = path.dirname(path.join(repoRoot, config.relPath));
  const scripts = [];
  for (const scriptManifestPath of config.scriptManifestPaths) {
    const scriptManifest = readJson(scriptManifestPath);
    scripts.push(...Object.values(scriptManifest.scripts ?? {}));
  }

  for (const depName of declaredNames) {
    const binaries = resolveBinaryNames(depName, manifestDir);
    if (scripts.some((script) => binaries.some((bin) => scriptUsesBinary(script, bin)))) {
      used.add(depName);
    }
  }

  return used;
}

function formatCandidateSection(title, entries) {
  if (entries.length === 0) {
    return [];
  }

  return [title, ...entries.map((name) => `  - ${name}`)];
}

const manifests = MANIFESTS.map((config) => {
  const manifest = readJson(config.relPath);
  const sections = getDependencySections(manifest);
  const usedDependencies = collectUsedDependencies(config, manifest, sections);

  const candidates = Object.fromEntries(
    Object.entries(sections).map(([section, entries]) => [
      section,
      Object.keys(entries)
        .filter((name) => strict || !implicitTypePackages.has(name))
        .filter((name) => !usedDependencies.has(name))
        .sort(),
    ]),
  );

  return {
    id: config.id,
    relPath: config.relPath,
    candidates,
    declared: sections,
  };
});

const duplicateMap = new Map();
for (const result of manifests) {
  for (const [section, entries] of Object.entries(result.declared)) {
    for (const depName of Object.keys(entries)) {
      const current = duplicateMap.get(depName) ?? [];
      current.push(`${result.id} (${section})`);
      duplicateMap.set(depName, current);
    }
  }
}

const duplicateLines = [...duplicateMap.entries()]
  .filter(([, owners]) => owners.length > 1)
  .sort((a, b) => a[0].localeCompare(b[0]))
  .map(([depName, owners]) => `  - ${depName}: ${owners.join(", ")}`);

const output = [];
output.push("Dependency audit candidates");
output.push("");

for (const result of manifests) {
  const sections = [
    ...formatCandidateSection("unused dependencies", result.candidates.dependencies),
    ...formatCandidateSection("unused devDependencies", result.candidates.devDependencies),
    ...formatCandidateSection("unused optionalDependencies", result.candidates.optionalDependencies),
  ];

  if (sections.length === 0) {
    continue;
  }

  output.push(`${result.id} (${result.relPath})`);
  output.push(...sections);
  output.push("");
}

if (duplicateLines.length > 0) {
  output.push("duplicate declarations");
  output.push(...duplicateLines);
  output.push("");
}

if (output.length === 2) {
  output.push("No dependency candidates found.");
}

output.push("Notes:");
output.push("  - This repo audit is static and best-effort; verify each candidate before removal.");
output.push("  - Script-only packages are treated as used when their binary appears in package.json scripts.");
output.push("  - `check:deps:full` enables stricter reporting, including implicit type packages.");

console.log(output.join("\n"));

const hasCandidates = manifests.some((result) =>
  Object.values(result.candidates).some((entries) => entries.length > 0),
);

if (hasCandidates || duplicateLines.length > 0) {
  process.exitCode = 1;
}
