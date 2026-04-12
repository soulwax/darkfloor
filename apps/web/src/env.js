// File: apps/web/src/env.js

import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    AUTH_SECRET: z
      .string()
      .min(32, "AUTH_SECRET must be at least 32 characters"),
    AUTH_TRUST_HOST: z
      .string()
      .optional()
      .transform((val) => val === "true"),
    AUTH_DISCORD_ID: z.string(),
    AUTH_DISCORD_SECRET: z.string(),
    AUTH_GITHUB_ID: z.string().optional(),
    AUTH_GITHUB_SECRET: z.string().optional(),
    AUTH_SPOTIFY_ENABLED: z
      .string()
      .optional()
      .transform((val) => val === "true"),
    AUTH_DB_DISABLED: z
      .string()
      .optional()
      .transform((val) => val === "true"),
    DB_ANALYTICS_DISABLED: z
      .string()
      .optional()
      .transform((val) => val === "true"),
    DB_WRITE_DISABLED: z
      .string()
      .optional()
      .transform((val) => val === "true"),
    AUTH_DEBUG_OAUTH: z
      .string()
      .optional()
      .transform((val) => val === "true"),
    AUTH_DEBUG_TOKEN: z.string().optional(),
    SPOTIFY_CLIENT_ID: z.string().optional(),
    SPOTIFY_CLIENT_SECRET: z.string().optional(),
    NEXTAUTH_URL: z.string().url().optional(),
    DATABASE_URL: z.string().url().optional(),
    REPO_ROOT: z.string().optional(),
    ADMIN_DB_CONFIG_FRONTEND_RELOAD_HINT: z.string().optional(),
    ADMIN_DB_CONFIG_API_RELOAD_HINT: z.string().optional(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    SONGBIRD_API_URL: z.string().url().optional(),
    SONGBIRD_API_HEALTH_URI: z.string().optional(),
    UNIVERSAL_KEY: z.string().optional(),
    BLUESIX_API_KEY: z.string().optional(),
    API_V2_URL: z.string().url().optional(),
    API_V2_URLS: z.string().optional(),
    API_V2_READ_URLS: z.string().optional(),
    API_V2_WRITE_URLS: z.string().optional(),
    API_V2_STREAM_URLS: z.string().optional(),
    ELECTRON_BUILD: z
      .string()
      .optional()
      .transform((val) => val === "true"),
  },
  client: {
    NEXT_PUBLIC_APP_VERSION: z.string().optional(),
    NEXT_PUBLIC_AUTH_API_BASE: z.string().url().optional(),
    NEXT_PUBLIC_AUTH_SPOTIFY_ENABLED: z
      .string()
      .optional()
      .transform((val) => val === "true"),
    NEXT_PUBLIC_AUTH_DEBUG: z.string().optional(),
    NEXT_PUBLIC_AUTH_DEBUG_OAUTH: z
      .string()
      .optional()
      .transform((val) => val === "true"),
    NEXT_PUBLIC_DB_OPTIONAL_READS_DISABLED: z
      .string()
      .optional()
      .transform((val) => val === "true"),
    NEXT_PUBLIC_DB_OPTIONAL_WRITES_DISABLED: z
      .string()
      .optional()
      .transform((val) => val === "true"),
  },
  runtimeEnv: {
    NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION,
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST,
    AUTH_DISCORD_ID: process.env.AUTH_DISCORD_ID,
    AUTH_DISCORD_SECRET: process.env.AUTH_DISCORD_SECRET,
    AUTH_GITHUB_ID: process.env.AUTH_GITHUB_ID,
    AUTH_GITHUB_SECRET: process.env.AUTH_GITHUB_SECRET,
    AUTH_SPOTIFY_ENABLED: process.env.AUTH_SPOTIFY_ENABLED,
    AUTH_DB_DISABLED: process.env.AUTH_DB_DISABLED,
    DB_ANALYTICS_DISABLED: process.env.DB_ANALYTICS_DISABLED,
    DB_WRITE_DISABLED: process.env.DB_WRITE_DISABLED,
    AUTH_DEBUG_OAUTH: process.env.AUTH_DEBUG_OAUTH,
    AUTH_DEBUG_TOKEN: process.env.AUTH_DEBUG_TOKEN,
    SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID,
    SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    DATABASE_URL: process.env.DATABASE_URL,
    REPO_ROOT: process.env.REPO_ROOT,
    ADMIN_DB_CONFIG_FRONTEND_RELOAD_HINT:
      process.env.ADMIN_DB_CONFIG_FRONTEND_RELOAD_HINT,
    ADMIN_DB_CONFIG_API_RELOAD_HINT:
      process.env.ADMIN_DB_CONFIG_API_RELOAD_HINT,
    NODE_ENV: process.env.NODE_ENV,
    SONGBIRD_API_URL:
      process.env.SONGBIRD_API_URL ??
      process.env.API_V2_URL ??
      process.env.NEXT_PUBLIC_AUTH_API_BASE,
    SONGBIRD_API_HEALTH_URI:
      process.env.SONGBIRD_API_HEALTH_URI ?? "/api/health",
    UNIVERSAL_KEY: process.env.UNIVERSAL_KEY,
    API_V2_URL: process.env.API_V2_URL ?? process.env.SONGBIRD_API_URL,
    API_V2_URLS: process.env.API_V2_URLS,
    API_V2_READ_URLS: process.env.API_V2_READ_URLS,
    API_V2_WRITE_URLS: process.env.API_V2_WRITE_URLS,
    API_V2_STREAM_URLS: process.env.API_V2_STREAM_URLS,
    NEXT_PUBLIC_AUTH_API_BASE:
      process.env.NEXT_PUBLIC_AUTH_API_BASE ??
      process.env.API_V2_URL ??
      process.env.SONGBIRD_API_URL,
    NEXT_PUBLIC_AUTH_SPOTIFY_ENABLED:
      process.env.NEXT_PUBLIC_AUTH_SPOTIFY_ENABLED,
    NEXT_PUBLIC_AUTH_DEBUG: process.env.NEXT_PUBLIC_AUTH_DEBUG,
    NEXT_PUBLIC_AUTH_DEBUG_OAUTH:
      process.env.NEXT_PUBLIC_AUTH_DEBUG_OAUTH,
    NEXT_PUBLIC_DB_OPTIONAL_READS_DISABLED:
      process.env.NEXT_PUBLIC_DB_OPTIONAL_READS_DISABLED,
    NEXT_PUBLIC_DB_OPTIONAL_WRITES_DISABLED:
      process.env.NEXT_PUBLIC_DB_OPTIONAL_WRITES_DISABLED,
    BLUESIX_API_KEY:
      process.env.BLUESIX_API_KEY ??
      process.env.UNIVERSAL_KEY,
    ELECTRON_BUILD: process.env.ELECTRON_BUILD,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
