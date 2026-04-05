// File: ecosystem.config.cjs

const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.resolve(__dirname, ".env") });
const PORT = process.env.PORT || "3222";
const HOSTNAME = process.env.HOSTNAME || "0.0.0.0";

module.exports = {
  apps: [
    {
      name: "bluesix-frontend-prod",
      script: "scripts/server.js",
      args: "",
      interpreter: "node",

      instances: 1,
      exec_mode: "fork",

      max_memory_restart: "2560M",
      min_uptime: "30s",

      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      wait_ready: true,

      exp_backoff_restart_delay: 100,

      pre_start: "node scripts/ensure-build.js",
      env: {
        NODE_ENV: "production",
        PORT: PORT,
        HOSTNAME: HOSTNAME,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: PORT,
        HOSTNAME: HOSTNAME,
      },
      combine_logs: true,
      merge_logs: true,

      error_file: "./logs/pm2/error.log",
      out_file: "./logs/pm2/out.log",
      log_file: "./logs/pm2/combined.log",

      time: true, 
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",

      watch: false,
      ignore_watch: ["node_modules", "logs", ".next"],

      shutdown_with_message: true,

      source_map_support: true,

      instance_var: "INSTANCE_ID",
      increment_var: "INSTANCE_NUMBER",

      kill_timeout: 5000,
      listen_timeout: 10000,

      node_args: "--max-old-space-size=2560",
      health_check_grace_period: 5000,
      health_check_fatal_exceptions: true,
      health_check_url: `http://localhost:${PORT}/api/health`,
    },
    {
      name: "bluesix-frontend-dev",
      script: "scripts/server.js",
      args: "",
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "2G",
      min_uptime: "30s",

      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      kill_timeout: 5000,
      listen_timeout: 10000,
      wait_ready: true,

      exp_backoff_restart_delay: 100,
      env: {
        NODE_ENV: "development",
        PORT: PORT,
        HOSTNAME: HOSTNAME,
      },
      env_development: {
        NODE_ENV: "development",
        PORT: PORT,
        HOSTNAME: HOSTNAME,
      },

      combine_logs: true,
      merge_logs: true,

      error_file: "./logs/pm2/dev-error.log",
      out_file: "./logs/pm2/dev-out.log",
      log_file: "./logs/pm2/dev-combined.log",

      time: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",

      watch: true,
      ignore_watch: ["node_modules", "logs", ".next", "dist", "drizzle"],

      shutdown_with_message: true,
      source_map_support: true,
      instance_var: "INSTANCE_ID",

      health_check_grace_period: 5000,
      health_check_fatal_exceptions: true,
      health_check_url: `http://localhost:${PORT}/api/health`,
    },
  ],
  deploy: {
    production: {
      user: "node",
      host: ["starchildmusic.com"],
      ref: "origin/main",
      repo: "git@gitlab.com:soulwax/darkfloor-player.git",
      path: "/home/soulwax/workspace/Web/Frontends/starchild-music-frontend",
      "post-deploy":
        "pnpm install --frozen-lockfile && pnpm run build && pnpm run pm2:reload",
      "pre-setup": "",
      env: {
        NODE_ENV: "production",
      },
    },
  },
};
