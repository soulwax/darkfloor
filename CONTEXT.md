# Context (songbird-frontend / Starchild Music)

Last updated: 2026-02-22

## What This Repo Is

- Turborepo-style monorepo with a Next.js web runtime and an Electron desktop wrapper.
- Primary product: `apps/web` (App Router + tRPC + NextAuth + Drizzle/Postgres).
- Desktop runtime: `apps/desktop/electron` (legacy compatibility wrappers also exist under root `electron/`).
- Mobile runtime: `apps/mobile` scaffold (minimal runtime wiring, mostly type-check coverage).
- API model:
  - Internal app data: tRPC at `/api/trpc`.
  - External integrations: Next.js route handlers under `apps/web/src/app/api/**` (Songbird/Bluesix V2 + Deezer).

## Read First

1. `AGENTS.md`
2. `CONTEXT.md`
3. `README.md`
4. `docs/README.md`
5. `docs/SETUP.md`
6. `docs/DEPLOYMENT.md`
7. `docs/TROUBLESHOOTING.md`
8. `docs/ARCHITECTURE.md`
9. `docs/API_ROUTE_USE.md`
10. `docs/API_V2_SWAGGER.yaml`

## Workspace Map

- `apps/web/` main Next.js runtime
  - `apps/web/src/app/` pages, layouts, route handlers
  - `apps/web/src/app/api/trpc/[trpc]/route.ts` tRPC endpoint
  - `apps/web/src/app/api/auth/[...nextauth]/route.ts` NextAuth endpoint
  - `apps/web/src/app/api/v2/_lib.ts` generic V2 proxy helper
  - `apps/web/src/app/api/auth/_lib.ts` auth proxy helper
  - `apps/web/src/app/api/songbird/_lib.ts` token-based Songbird proxy helper
  - `apps/web/src/server/api/root.ts` active `appRouter` registration (`admin`, `post`, `music`, `equalizer`)
  - `apps/web/src/server/api/routers/*` router modules (for example `preferences.ts` exists but is currently unregistered)
  - `apps/web/src/server/auth/*` NextAuth configuration/helpers
  - `apps/web/src/server/db/*` Drizzle schema + `pg` pool
  - `apps/web/drizzle.config.cjs` Drizzle CLI source-of-truth config
  - `apps/web/drizzle.config.ts` TypeScript mirror for in-app/runtime use
  - `drizzle.config.ts` root passthrough config
  - `apps/web/src/lib/server/songbird-token.ts` Songbird token fetch/refresh logic
  - `apps/web/src/services/smartQueue.ts` client smart queue calls
  - `apps/web/src/proxy.ts` security headers and middleware behavior
  - `apps/web/src/env.js` env schema validation (`@t3-oss/env-nextjs`)
  - `apps/web/drizzle/` SQL migrations
- `apps/desktop/electron/` Electron main/preload + builder helpers
- `packages/*` shared workspace libraries (import via `@starchild/*`)
  - `api-client`, `types`, `config`, `auth`
  - `player-core`, `player-react`, `audio-adapters`
  - `ui`, `visualizers`

Player internals live in shared packages:

- `packages/player-react/src/AudioPlayerContext.tsx`
- `packages/player-react/src/useAudioPlayer.ts`
- `packages/player-core/src/index.ts`

## Runtime Flow (Mental Model)

- UI -> `@starchild/api-client/trpc/react` -> `/api/trpc` -> `apps/web/src/server/api/*` -> Postgres (Drizzle).
- UI -> `/api/*` proxy routes -> Songbird/Bluesix V2 and Deezer.
- Auth -> `/api/auth/*` -> NextAuth -> DB-backed sessions.
- Electron -> loads the local web server (default `http://localhost:3222` in dev).

## Commands (Run From Repo Root)

- Install deps: `pnpm install --frozen-lockfile`
- Dev (custom server wrapper): `pnpm dev`
- Dev (Next.js only): `pnpm dev:next`
- Build: `pnpm build`
- Start (prod custom server): `pnpm start`
- Lint + types: `pnpm check`
- Tests: `pnpm test`
- Format: `pnpm format:write`
- Electron dev: `pnpm electron:dev`
- Workspace tasks: `pnpm ws:build`, `pnpm ws:check`, `pnpm ws:test`

## Env + Config Rules

- When adding/changing env vars, update both:
  - `.env.example`
  - `apps/web/src/env.js`
- Runtime DB code requires `DATABASE_URL` (`apps/web/src/server/db/index.ts` throws if missing).
- Server env loading is defined in `apps/web/scripts/server.js`:
  - `NODE_ENV=development`: load only `.env` with override.
  - production: load `.env.local`, then `.env.production`, then `.env` (no override).
- Root `scripts/server.js` is a thin wrapper that imports `apps/web/scripts/server.js`.

## Change Guide (Where To Edit)

- Add first-party app data API: update/add tRPC router in `apps/web/src/server/api/routers/*`, then register in `apps/web/src/server/api/root.ts`.
- Add external proxy endpoint: create route handler in `apps/web/src/app/api/**/route.ts` and reuse the relevant `_lib.ts` helper.
- Change DB schema: edit `apps/web/src/server/db/schema.ts`, then run Drizzle commands.
- Change playback behavior: edit `packages/player-react/*` and/or `packages/player-core/*`.
- Change shared types: edit `packages/types/src/*`.
- Change shared constants/config: edit `packages/config/src/*`.

## Import and Boundary Rules

- In `apps/web`, use:
  - `@/` for app-local imports
  - `@starchild/*` for shared package imports (resolved via `apps/web/tsconfig.json` path aliases into `../../packages/*/src`)
- In `packages/*`, do not import from `apps/web`; keep package boundaries clean.
- Boundary checks: `pnpm check:boundaries`.

## Notes

- Upstream Swagger files (`docs/API_V2_SWAGGER.yaml` / `.json`) describe the service configured via `API_V2_URL`, not this repo's direct API surface.
- Vercel config (`vercel.json`) uses pnpm commands (`pnpm install --frozen-lockfile`, `pnpm run build`).
- Current pnpm recursive/workspace scope is root package only; package code sharing is handled through TS path alias resolution.
