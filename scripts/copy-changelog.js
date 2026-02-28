#!/usr/bin/env node
// File: scripts/copy-changelog.js

import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const source = resolve(repoRoot, "CHANGELOG.md");
const target = resolve(repoRoot, "apps", "web", "public", "CHANGELOG.md");

mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
console.log(`Copied ${source} -> ${target}`);
