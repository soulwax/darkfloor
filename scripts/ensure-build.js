#!/usr/bin/env node
// File: scripts/ensure-build.js

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const buildIdPath = path.resolve(__dirname, '../.next/BUILD_ID');
const nextDirPath = path.resolve(__dirname, '../.next');

const buildExists = existsSync(buildIdPath) && existsSync(nextDirPath);

if (!buildExists) {
  console.log('[Build Check] Production build not found. Building...');
  try {
    execSync('npm run build', {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'production' },
    });
    console.log('[Build Check] Build completed successfully');
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Build Check] Build failed:', message);
    process.exit(1);
  }
} else {
  console.log('[Build Check] Production build exists');
  process.exit(0);
}
