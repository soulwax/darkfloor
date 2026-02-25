// File: ecosystem.docker.cjs

/**
 * PM2 ecosystem configuration for running the app inside a Docker container.
 *
 * Key points:
 * - This file is meant to be used as the PM2 config when the app runs under Docker.
 * - The working directory is `/app` (see `cwd`), which should match the container's
 *   application directory.
 * - `error_file` and `out_file` are set to `/dev/stderr` and `/dev/stdout` so that
 *   all PM2 logs are forwarded to Docker's logging system instead of local files.
 * - `NODE_ENV` is set to `"production"` by default to ensure production behavior.
 * - `PORT` is read from `process.env.PORT` when provided by the Docker runtime
 *   (e.g., via `docker run -e PORT=...` or a compose file); it falls back to
 *   `"3222"` if no port is specified.
 * - `HOSTNAME` is set to `"0.0.0.0"` so the server listens on all interfaces inside
 *   the container and is reachable from the host / other containers.
 *
 * Adjust this file if you change how the container is built or how environment
 * variables are passed into the runtime.
 */

module.exports = {
  apps: [
    {
      name: "app",
      script: "server.js",
      cwd: "/app",
      interpreter: "node",

      instances: 1,
      exec_mode: "fork",

      max_memory_restart: "768M",
      min_uptime: "10s",

      autorestart: true,
      max_restarts: 15,
      restart_delay: 3000,
      exp_backoff_restart_delay: 100,

      kill_timeout: 8000,
      listen_timeout: 15000,

      watch: false,

      combine_logs: true,
      merge_logs: true,
      time: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",

      error_file: "/dev/stderr",
      out_file: "/dev/stdout",

      env: {
        NODE_ENV: "production",
        PORT: process.env.PORT || "3222",
        HOSTNAME: "0.0.0.0",
      },
    },
  ],
};
