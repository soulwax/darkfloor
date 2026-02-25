// File: apps/web/drizzle.env.ts

import { config as dotenvConfig } from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "../..");

dotenvConfig({ path: resolve(repoRoot, ".env.local"), override: true });
dotenvConfig({ path: resolve(repoRoot, ".env"), override: false });

const useConnectionString = !!process.env.DATABASE_URL;

const required = (key: string) => {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
};

const optional = (key: string) => {
  const val = process.env[key];
  return val && val.trim() !== "" ? val : undefined;
};

const config = {
  DB_HOST: useConnectionString ? optional("DB_HOST") : required("DB_HOST"),
  DB_PORT: useConnectionString ? optional("DB_PORT") : required("DB_PORT"),
  DB_ADMIN_USER: useConnectionString ? optional("DB_ADMIN_USER") : required("DB_ADMIN_USER"),
  DB_ADMIN_PASSWORD: useConnectionString ? optional("DB_ADMIN_PASSWORD") : required("DB_ADMIN_PASSWORD"),
  DB_NAME: useConnectionString ? optional("DB_NAME") : required("DB_NAME"),
};

export default config;
