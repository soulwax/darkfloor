# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Canonical guidance lives in `AGENTS.md` and `AI_TOOLING.md`. This file expands on those for Claude Code specifically.

## Commands

All commands run from repo root unless noted.

| Command | Purpose |
|---|---|
| `pnpm install --frozen-lockfile` | Install deps (runs `install:api` for the `api/` submodule via postinstall) |
| `pnpm dev` | Start web runtime via custom server wrapper (auto-generates SSL) |
| `pnpm dev:next` | Plain Next.js dev server on port 3222 (no SSL, no custom server) |
| `pnpm build` | Build web app + `api/` submodule |
| `pnpm check` | Boundary check + web lint + typecheck |
| `pnpm test` | Run Vitest suite for `apps/web` |
| `pnpm test:watch` | Vitest in watch mode |
| `pnpm test:e2e` | Playwright end-to-end tests |
| `pnpm format:write` | Prettier format all TS/TSX/JS/MDX |
| `pnpm ws:check` | Turborepo-wide check across all workspaces |
| `pnpm electron:dev` | Run web dev server + Electron together |
| `pnpm tauri:dev` | Start experimental Tauri shell |
| `pnpm dev:mobile` | Start Expo web shell |
| `pnpm mobile:check` | Type-check mobile workspace |
| `pnpm db:generate` | Generate Drizzle migration from schema changes |
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm db:studio` | Open Drizzle Studio |

Production (PM2):
- `pnpm pm2:logs` — tail frontend prod logs
- `pnpm deploy` — build + pm2 reload (zero-downtime)
- `pnpm pub` — build + pm2 restart

## Architecture

**Turborepo monorepo** — `apps/` for runtimes, `packages/` for shared libraries.

### Apps

- `apps/web` — primary Next.js App Router runtime (tRPC + NextAuth v5 + Drizzle/Postgres). **Default implementation target.**
- `apps/desktop` — Electron shell (main path) + experimental Tauri parallel track
- `apps/mobile` — Expo React Native Web shell; durable state in `src/mobile-shell/*`
- `api/` — Git submodule for the external Darkfloor API V2 backend. **Only enter for explicit backend/full-stack work.**

### Shared Packages (imported as `@starchild/*`)

- `packages/types` — shared TypeScript contracts (use these before creating local types)
- `packages/config` — constants, storage keys, visualizer config
- `packages/api-client` — REST + tRPC client helpers
- `packages/auth` — auth logging + provider helpers
- `packages/player-core` — playback engine primitives
- `packages/player-react` — React player context (`AudioPlayerContext.tsx`) + `useAudioPlayer` hook
- `packages/audio-adapters` — runtime audio adapters
- `packages/ui` — shared UI primitives and motion helpers
- `packages/visualizers` — flow-field canvas and visualizer patterns

### Key Source Paths in `apps/web`

- `src/app/` — pages, layouts, route handlers
- `src/app/api/trpc/[trpc]/route.ts` — tRPC endpoint
- `src/app/api/auth/[...nextauth]/route.ts` — NextAuth endpoint
- `src/app/api/v2/_lib.ts` — generic V2 proxy helper (reuse this for new proxy endpoints)
- `src/app/api/songbird/_lib.ts` — token-based Songbird proxy helper
- `src/server/api/trpc.ts` — tRPC base, context, `publicProcedure`, `protectedProcedure`
- `src/server/api/root.ts` — active `appRouter` (registers: `admin`, `post`, `music`, `equalizer`)
- `src/server/api/routers/` — router modules (`preferences.ts` exists but is **not registered**)
- `src/server/auth/` — NextAuth configuration and helpers
- `src/server/db/schema.ts` — Drizzle schema (source of truth)
- `src/server/db/index.ts` — DB pool (throws if `DATABASE_URL` missing)
- `src/env.js` — validated env schema via `@t3-oss/env-nextjs` (**use this, not `process.env` directly**)
- `src/lib/server/songbird-token.ts` — Songbird token fetch/refresh

## Boundaries and Rules

**Frontend-first:** Default all work to `apps/web`. Only enter `api/` when a task explicitly requires backend or coordinated full-stack behavior. Call this out before implementing.

**Import aliases:**
- Within `apps/web`: use `@/` for app-local imports, `@starchild/*` for shared packages
- Within `packages/*`: never import from `apps/web`
- Boundary check: `pnpm check:boundaries`

**tRPC vs route handlers:**
- First-party app data + DB-backed state → tRPC routers in `src/server/api/routers/`, registered in `root.ts`
- External proxy/transport (Songbird, Spotify, Deezer, V2 API) → route handlers in `src/app/api/`
- New routers must be registered in `root.ts` to become active

**Auth:**
- Frontend auth (NextAuth, OAuth callbacks, session cookies) lives in `apps/web`
- Do not infer frontend Auth.js behavior from backend env vars
- For Spotify OAuth in cross-origin setups: initiate login on `${NEXT_PUBLIC_AUTH_API_ORIGIN}/api/auth/spotify?...` (PKCE cookies must be on the callback origin)

**Env vars:**
- Add new vars to both `.env.example` and `apps/web/src/env.js`
- `DATABASE_URL` — canonical DB key
- `API_V2_URL` — canonical upstream API base (alias: `SONGBIRD_API_URL` still supported)
- `NEXTAUTH_URL` — single app/auth base URL

**Production:**
- PM2 process: `bluesix-frontend-prod`
- Debug frontend incidents via PM2 logs, not Vercel tooling
- Default local frontend: `http://127.0.0.1:3222`

## Before Implementing

Summarize: files to touch + existing patterns being followed. For auth/OAuth, state explicitly whether the change is frontend (`apps/web`) or backend (`api/`) or coordinated.

For user-visible changes, bump version in `package.json` and update `CHANGELOG.md`.
