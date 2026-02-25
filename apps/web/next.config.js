// File: apps/web/next.config.js

import { config as dotenvConfig } from "dotenv";
import { readFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const nodeEnv = process.env.NODE_ENV ?? "development";

// When running Next from apps/web, load env vars from the repo root.
dotenvConfig({ path: join(repoRoot, ".env.local"), override: false });
if (nodeEnv === "production") {
  dotenvConfig({ path: join(repoRoot, ".env.production"), override: false });
}
dotenvConfig({ path: join(repoRoot, ".env"), override: false });

await import("./src/env.js");

const pkg = JSON.parse(
  readFileSync(join(repoRoot, "package.json"), "utf-8"),
);
const appVersion = typeof pkg.version === "string" ? pkg.version : "0.0.0";

if (typeof process !== "undefined") {
  const originalEmit = /** @type {(...args: any[]) => any} */ (
    process.emit.bind(process)
  );
  process.emit = /** @type {typeof process.emit} */ (
    function (event, ...args) {
      if (event === "unhandledRejection") {
        const reason = args[0];
        if (
          reason &&
          typeof reason === "object" &&
          "code" in reason &&
          reason.code === "ENOENT"
        ) {
          const message = "message" in reason ? String(reason.message) : "";
          const type = "type" in reason ? String(reason.type) : "";
          const errorText = message || type || "";
          if (
            errorText.includes("_document") ||
            errorText.includes("_error") ||
            errorText.includes("PageNotFoundError")
          ) {
            return false;
          }
        }
      }
      return originalEmit(event, ...args);
    }
  );

  process.on("unhandledRejection", (reason, promise) => {
    if (
      reason &&
      typeof reason === "object" &&
      "code" in reason &&
      reason.code === "ENOENT"
    ) {
      const message = "message" in reason ? String(reason.message) : "";
      const type = "type" in reason ? String(reason.type) : "";
      const errorText = message || type || "";
      if (
        errorText.includes("_document") ||
        errorText.includes("_error") ||
        errorText.includes("PageNotFoundError")
      ) {
        return;
      }
    }
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
  });
}

/** @type {import("next").NextConfig} */
const config = {
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
  },
  reactStrictMode: true,

  output: "standalone",
  distDir: "../../.next",

  // Explicitly set the workspace root to avoid lockfile confusion
  outputFileTracingRoot: repoRoot,

  poweredByHeader: false,
  compress: true,

  typescript: {
    ignoreBuildErrors: true,
  },

  productionBrowserSourceMaps: false,

  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production"
        ? {
            exclude: ["error", "warn"],
          }
        : false,
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, max-age=0",
          },
        ],
      },
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },

  experimental: {
    externalDir: true,
    optimizePackageImports: [
      "lucide-react",
      "framer-motion",
      "@tanstack/react-query",
      "@trpc/client",
      "@trpc/react-query",
      "@dnd-kit/core",
      "@dnd-kit/sortable",
      "next-auth",
    ],
    webpackBuildWorker: true,
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },

  turbopack: {},

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn-images.dzcdn.net",
        pathname: "/images/**",
      },
      {
        protocol: "https",
        hostname: "api.deezer.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "cdn.discordapp.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "media.discordapp.net",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "discord.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "discordapp.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "i.scdn.co",
        pathname: "/image/**",
      },
    ],
    unoptimized: process.env.ELECTRON_BUILD === "true",
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
  },

  webpack: (config, { isServer }) => {
    if (isServer) {
      config.ignoreWarnings = [
        ...(config.ignoreWarnings || []),
        {
          module: /[\\/]node_modules[\\/]next[\\/]/,
          message: /Cannot find module for page: \/_(document|error)/,
        },
        {
          module: /[\\/]node_modules[\\/]next[\\/]/,
          message: /PageNotFoundError/,
        },
      ];
    }

    config.optimization = {
      ...config.optimization,
      moduleIds: "deterministic",
    };

    return config;
  },

  onDemandEntries: {
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 5,
  },
};

export default config;
