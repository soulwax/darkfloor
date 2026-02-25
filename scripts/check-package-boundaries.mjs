#!/usr/bin/env node
// File: scripts/check-package-boundaries.mjs

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

const repoRoot = process.cwd();
const packagesDir = path.join(repoRoot, "packages");
const supportedExtensions = new Set([".ts", ".tsx", ".js", ".jsx"]);

/**
 * Resolve script kind based on file extension so TypeScript can parse imports reliably.
 * @param {string} filePath
 */
function getScriptKind(filePath) {
  const ext = path.extname(filePath);
  if (ext === ".tsx") return ts.ScriptKind.TSX;
  if (ext === ".ts") return ts.ScriptKind.TS;
  if (ext === ".jsx") return ts.ScriptKind.JSX;
  return ts.ScriptKind.JS;
}

/**
 * @param {string} specifier
 */
function getViolationReason(specifier) {
  if (specifier.startsWith("@/")) {
    return "uses app-local alias '@/...'";
  }

  const isPathLike =
    specifier.startsWith(".") ||
    specifier.startsWith("/") ||
    /^[A-Za-z]:[\\/]/.test(specifier);

  if (isPathLike && /(?:^|\/)apps\//.test(specifier)) {
    return "references app-internal path from a package";
  }

  return null;
}

/**
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
async function collectSourceFiles(dir) {
  /** @type {string[]} */
  const files = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === "dist") {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(fullPath)));
      continue;
    }

    if (supportedExtensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * @typedef {{ file: string; line: number; column: number; specifier: string; reason: string }} Violation
 */

/**
 * @param {string} filePath
 * @returns {Promise<Violation[]>}
 */
async function checkFile(filePath) {
  const content = await fs.readFile(filePath, "utf8");
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    getScriptKind(filePath),
  );

  /** @type {Violation[]} */
  const violations = [];

  /**
   * @param {string} specifier
   * @param {ts.Node} node
   */
  const maybeRecordViolation = (specifier, node) => {
    const reason = getViolationReason(specifier);
    if (!reason) return;

    const pos = sourceFile.getLineAndCharacterOfPosition(
      node.getStart(sourceFile),
    );
    violations.push({
      file: path.relative(repoRoot, filePath),
      line: pos.line + 1,
      column: pos.character + 1,
      specifier,
      reason,
    });
  };

  /**
   * @param {ts.Node} node
   */
  const visit = (node) => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      maybeRecordViolation(node.moduleSpecifier.text, node.moduleSpecifier);
    }

    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      maybeRecordViolation(node.moduleSpecifier.text, node.moduleSpecifier);
    }

    if (ts.isCallExpression(node) && node.arguments.length > 0) {
      const firstArg = node.arguments[0];
      if (!ts.isStringLiteral(firstArg)) {
        ts.forEachChild(node, visit);
        return;
      }

      const isDynamicImport =
        node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const isRequireCall =
        ts.isIdentifier(node.expression) && node.expression.text === "require";

      if (isDynamicImport || isRequireCall) {
        maybeRecordViolation(firstArg.text, firstArg);
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return violations;
}

async function main() {
  const files = await collectSourceFiles(packagesDir);
  /** @type {Violation[]} */
  const violations = [];

  for (const file of files) {
    violations.push(...(await checkFile(file)));
  }

  if (violations.length === 0) {
    console.log(
      "Boundary check passed: no package imports reference app internals.",
    );
    return;
  }

  console.error(
    `Boundary check failed: found ${violations.length} disallowed package import${violations.length === 1 ? "" : "s"}.`,
  );
  for (const violation of violations) {
    console.error(
      `- ${violation.file}:${violation.line}:${violation.column} (${violation.reason}) -> "${violation.specifier}"`,
    );
  }
  process.exit(1);
}

void main();
