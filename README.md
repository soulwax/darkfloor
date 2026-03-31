# Starchild Music Frontend

Starchild Music is a monorepo for a Next.js music application with shared playback libraries and an Electron desktop runtime.
The backend API now also lives in this workspace as the Git submodule at `./api`, so frontend and API work can be reasoned about together from one checkout.
This README is intentionally concise; use `AGENTS.md`, `CONTEXT.md`, and `AI_TOOLING.md` for the current repo map.

## Repository Overview

This repository is organized as app runtimes plus shared packages:

- `apps/web`: primary Next.js App Router product
  - tRPC API (`/api/trpc`)
  - NextAuth (`/api/auth/[...nextauth]`)
  - Route-handler proxies for Songbird/Bluesix V2 and Deezer (`/api/**`)
- `apps/desktop`: Electron wrapper and packaging scripts
- `apps/mobile`: Expo-based React Native Web app with a persisted mobile shell and a future path to native targets
- `packages/*`: shared runtime libraries (`@starchild/*`)
  - `api-client`, `auth`, `config`, `types`
  - `player-core`, `player-react`, `audio-adapters`
  - `ui`, `visualizers`
- `api/`: Darkfloor API V2 NestJS backend as a Git submodule
  - independently versioned backend repository
  - intentionally editable from this workspace when a task spans frontend and backend
  - has its own local guidance in `api/AGENTS.md`, `api/CONTEXT.md`, and `api/CODEX.md`

## Architecture Snapshot

- UI routing and rendering: Next.js App Router (`apps/web/src/app`)
- Internal first-party data API: tRPC routers (`apps/web/src/server/api/routers`)
- Auth/session: NextAuth + Drizzle adapter (`apps/web/src/server/auth`)
- Database: Postgres + Drizzle (`apps/web/src/server/db`, `apps/web/drizzle`)
- Upstream integrations and backend contract consumption: route handlers under `apps/web/src/app/api/**`
- Source backend implementation for that contract: `api/` NestJS service
- Player internals:
  - `packages/player-react/src/AudioPlayerContext.tsx`
  - `packages/player-react/src/useAudioPlayer.ts`
  - `packages/player-core/src/index.ts`

For fast repo orientation, start with `CONTEXT.md`, `AGENTS.md`, and `AI_TOOLING.md`.

## Required Engineering Standards

Contributors and coding agents should demonstrate:

1. Advanced React architecture (App Router, server/client separation, render optimization)
2. Gesture and animation engineering (precise drag thresholds, mobile-first interactions)
3. Strict TypeScript discipline (no `any`, strong typing, clear contracts)
4. State isolation and hook design (UI state vs playback engine boundaries)
5. Monorepo boundary discipline (respect app/package import boundaries)

## Prerequisites

- Node.js 20+
- pnpm 10+
- PostgreSQL (local or hosted)

## Quick Start

Commands below are run from the repo root.

1. Install dependencies:

```bash
pnpm install --frozen-lockfile
```

That root install also covers the checked-out `api/` submodule through the pnpm workspace.

If you also need the backend submodule locally, initialize it after cloning:

```bash
git submodule update --init --recursive
```

1. Create local environment file:

```bash
cp .env.example .env
```

1. Populate required env values (details below), especially:
   - `AUTH_SECRET`
   - `AUTH_DISCORD_ID`
   - `AUTH_DISCORD_SECRET`
   - `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` if GitHub login should be enabled
   - `DATABASE_URL`
   - `API_V2_URL`

2. Run database commands as needed:

```bash
pnpm db:generate
pnpm db:migrate
```

1. Start development server:

```bash
pnpm dev
```

1. Open `http://localhost:3222`.

For the mobile runtime specifically, use `apps/mobile/README.md` after the root docs.

## Environment Variables

The typed env schema lives in `apps/web/src/env.js`. When adding/changing env vars, update both `apps/web/src/env.js` and `.env.example`.

Common variables:

| Variable                                                    | Status                                | Purpose                                                                                                                |
| ----------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `AUTH_SECRET`                                               | required                              | NextAuth secret (min length enforced)                                                                                  |
| `AUTH_DISCORD_ID`                                           | required                              | Discord OAuth client id                                                                                                |
| `AUTH_DISCORD_SECRET`                                       | required                              | Discord OAuth client secret                                                                                            |
| `AUTH_GITHUB_ID` + `AUTH_GITHUB_SECRET`                     | optional                              | GitHub OAuth credentials; when present, GitHub sign-in is enabled                                                     |
| `DATABASE_URL`                                              | required at runtime                   | Postgres connection string                                                                                             |
| `NEXTAUTH_URL`                                              | recommended                           | Canonical app/auth base URL                                                                                            |
| `API_V2_URL`                                                | required for V2 proxy routes          | Upstream API base URL                                                                                                  |
| `NEXT_PUBLIC_AUTH_API_BASE`                                 | optional                              | Client-side override for backend auth/API host when it differs from the frontend origin                               |
| `SONGBIRD_API_HEALTH_URI`                                   | optional                              | Path override for upstream health checks when the API uses something other than `/api/health`                         |
| `UNIVERSAL_KEY`                                             | recommended                           | Canonical upstream auth key used for service token exchange and default proxy auth                                     |
| `BLUESIX_API_KEY`                                           | optional                              | Override only when the upstream x-api-key should differ from `UNIVERSAL_KEY`                                           |
| `SONGBIRD_API_URL`                                          | optional                              | Override only when Songbird token routes live on a different host than `API_V2_URL`                                   |
| `AUTH_SPOTIFY_ENABLED` + `NEXT_PUBLIC_AUTH_SPOTIFY_ENABLED` | optional                              | Spotify auth feature flag pair                                                                                         |
| `SPOTIFY_CLIENT_ID` + `SPOTIFY_CLIENT_SECRET`               | required when Spotify auth is enabled | Spotify OAuth credentials                                                                                              |

Notes:

- Runtime aliases in `apps/web/src/env.js` still exist for compatibility, but new env files should use the canonical keys shown here.
- `apps/web/src/server/db/index.ts` throws if `DATABASE_URL` is missing.

## Development Commands

| Command             | Description                                           |
| ------------------- | ----------------------------------------------------- |
| `pnpm dev`          | Start custom dev server wrapper (`scripts/server.js`) |
| `pnpm dev:next`     | Start plain Next.js dev server on port `3222`         |
| `pnpm dev:api`      | Start the NestJS API in watch mode from `api/`        |
| `pnpm dev:mobile`   | Start the Expo React Native Web app                   |
| `pnpm dev:mobile:native` | Start Expo for native targets                    |
| `pnpm dev:mobile:ios` | Start the Expo iOS target                           |
| `pnpm dev:mobile:android` | Start the Expo Android target                   |
| `pnpm build`        | Build both the web app and the `api/` submodule       |
| `pnpm mobile:build` | Export the mobile app for web to `apps/mobile/dist`   |
| `pnpm start`        | Start production server via custom wrapper            |
| `pnpm start:api`    | Start the built API from `api/dist`                   |
| `pnpm check`        | Boundary check + lint + typecheck                     |
| `pnpm mobile:check` | Type-check the Expo mobile app                        |
| `pnpm test`         | Run Vitest suite in `apps/web`                        |
| `pnpm format:write` | Format repository code                                |
| `pnpm electron:dev` | Run dev server and Electron together                  |
| `pnpm ws:build`     | Build all workspaces with Turborepo                   |
| `pnpm ws:check`     | Run workspace checks with Turborepo                   |
| `pnpm ws:test`      | Run workspace tests with Turborepo                    |

## Key Paths

- App runtime:
  - `apps/web/src/app`
  - `apps/web/src/components`
  - `apps/web/src/hooks`
  - `apps/web/src/contexts`
- Server/data:
  - `apps/web/src/server/api/trpc.ts`
  - `apps/web/src/server/api/root.ts`
  - `apps/web/src/server/api/routers`
  - `apps/web/src/server/auth`
  - `apps/web/src/server/db`
- Proxy helper modules:
  - `apps/web/src/app/api/v2/_lib.ts`
  - `apps/web/src/app/api/auth/_lib.ts`
  - `apps/web/src/app/api/songbird/_lib.ts`
  - `apps/web/src/app/api/music/_lib.ts`
- Shared packages:
  - `packages/api-client/src`
  - `packages/player-react/src`
  - `packages/player-core/src`
  - `packages/types/src`
- Backend submodule:
  - `api/src`
  - `api/src/modules`
  - `api/prisma/schema.prisma`
  - `api/README.md`
  - `api/AGENTS.md`

## API Surface Summary

| Surface            | Path                                               | Role                                       |
| ------------------ | -------------------------------------------------- | ------------------------------------------ |
| tRPC endpoint      | `apps/web/src/app/api/trpc/[trpc]/route.ts`        | Internal app API for DB-backed features    |
| NextAuth endpoint  | `apps/web/src/app/api/auth/[...nextauth]/route.ts` | Session + OAuth flow handling              |
| Health endpoint    | `apps/web/src/app/api/health/route.ts`             | Local health checks                        |
| V2 proxy routes    | `apps/web/src/app/api/v2/**/route.ts`              | Generic upstream V2 proxy endpoints        |
| Music proxy routes | `apps/web/src/app/api/music/**/route.ts`           | Discovery/search/playlists proxy endpoints |
| Songbird routes    | `apps/web/src/app/api/songbird/**/route.ts`        | Token-authenticated Songbird endpoints     |

For route-level behavior, inspect the route handlers under `apps/web/src/app/api/**` and the backend implementation in `api/src/modules/**`.

## Runtime and Env Loading Behavior

- Root server entrypoint: `scripts/server.js` (delegates to `apps/web/scripts/server.js`)
- Dev mode (`NODE_ENV=development`): loads `.env`, then `.env.local` with override
- Production mode: loads `.env.local`, then `.env.production`, then `.env`, with file values overriding inherited process env
- Default app port: `3222` (set by `PORT`)

## AI And Automation

- `AGENTS.md` is the canonical repository workflow guide for coding agents.
- `AI_TOOLING.md` is the tool-neutral quick-start for Codex, Claude Code, Cursor, Copilot, and similar assistants.
- `apps/mobile/README.md` covers the current mobile shell architecture and validation flow.
- Tool-specific compatibility files stay thin:
  - `CLAUDE.md`
  - `.github/copilot-instructions.md`
- Verify the live filesystem before trusting older repo snapshots like `tree.txt`.

## Deployment Modes

- Vercel:
  - Configured in `vercel.json`
  - Uses pnpm install/build commands
- Docker:
  - `Dockerfile` + `docker-compose.yml`
  - App health checks call `/api/health`
- PM2:
  - `ecosystem.config.cjs` and `ecosystem.docker.cjs`

For deployment behavior, inspect `vercel.json`, `Dockerfile`, `docker-compose.yml`, and the PM2 config files at the repo root.

## Additional Documentation

- `AI_TOOLING.md` (tool-neutral AI assistant quick-start)
- `AGENTS.md` (agent workflow and repository conventions)
- `CONTEXT.md` (fast technical map)
- `apps/mobile/README.md` (mobile runtime architecture and validation flow)
- `CLAUDE.md` (thin compatibility file that points back to the canonical docs)
- `.github/copilot-instructions.md` (Copilot compatibility wrapper around the same guidance)
- `api/README.md` (backend overview and runtime usage)
- `api/AGENTS.md` / `api/CONTEXT.md` / `api/CODEX.md` (backend agent guidance)
- `CHANGELOG.md` (release history and user-visible milestones)
- `tree.txt` (rough repository snapshot; verify against the live filesystem before relying on it)

## License

GPLv3. See `LICENSE.md`.
