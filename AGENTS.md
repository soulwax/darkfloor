# Agent Guide (songbird-frontend / Starchild Monorepo)

Last updated: 2026-02-22

This is the primary project context for coding agents in this repository. Read this file before making changes.

## Read Order

1. `AGENTS.md` (this file)
2. `CONTEXT.md`
3. `README.md`
4. `docs/README.md`
5. `docs/SETUP.md`
6. `docs/DEPLOYMENT.md`
7. `docs/TROUBLESHOOTING.md`
8. `docs/ARCHITECTURE.md`
9. `docs/API_ROUTE_USE.md`
10. `docs/API_V2_SWAGGER.yaml` (upstream API contract, not this repo API surface)

## Required Engineering Standards

Contributors and coding agents should demonstrate:

1. Advanced React architecture (App Router, server/client separation, render optimization)
2. Gesture and animation engineering (precise drag thresholds, mobile-first interactions)
3. Strict TypeScript discipline (no `any`, strong typing, clear contracts)
4. State isolation and hook design (UI state vs playback engine boundaries)
5. Monorepo boundary discipline (respect app/package import boundaries)

## High-Level Architecture

This repo is a Turborepo-style monorepo with app runtimes under `apps/` and shared code under `packages/`.

- Apps:
  - `apps/web`: primary Next.js App Router runtime (tRPC + NextAuth + Drizzle/Postgres)
  - `apps/desktop`: Electron wrapper and packaging scripts
  - `apps/mobile`: mobile shell scaffold (currently minimal runtime wiring)
- Shared packages:
  - Runtime packages: `packages/api-client`, `packages/auth`, `packages/config`, `packages/types`
  - Playback packages: `packages/player-core`, `packages/player-react`, `packages/audio-adapters`
  - UI/visual packages: `packages/ui`, `packages/visualizers`
  - Config placeholders: `packages/eslint-config`, `packages/tsconfig`
  - Package imports in app code (`@starchild/*`) resolve to `packages/*/src` via TypeScript path aliases
- Infra/runtime config:
  - Root runtime/build config in `package.json`, `turbo.json`, `vercel.json`, `Dockerfile`, `ecosystem*.cjs`
  - DB migrations in `apps/web/drizzle`

Note on upstream APIs:

- This repo does not host NestJS services in-repo.
- Upstream integrations (documented by `docs/API_V2_SWAGGER.yaml`) are exposed through Next.js route handlers under `apps/web/src/app/api/**`.

## Where Core Logic Lives

- Auth/session:
  - NextAuth configuration: `apps/web/src/server/auth/*`
  - NextAuth route handler: `apps/web/src/app/api/auth/[...nextauth]/route.ts`
  - Auth proxy helpers/routes: `apps/web/src/app/api/auth/*`
- Playback:
  - React context/hook: `packages/player-react/src/AudioPlayerContext.tsx`, `packages/player-react/src/useAudioPlayer.ts`
  - Core playback logic: `packages/player-core/src/*`
  - Audio adapters: `packages/audio-adapters/src/*`
- Streaming/proxy:
  - Stream endpoint: `apps/web/src/app/api/stream/route.ts`
  - Songbird token helpers: `apps/web/src/lib/server/songbird-token.ts`
  - Proxy helper modules: `apps/web/src/app/api/v2/_lib.ts`, `apps/web/src/app/api/songbird/_lib.ts`, `apps/web/src/app/api/music/_lib.ts`
  - Client REST helpers: `packages/api-client/src/rest.ts`
- tRPC/data:
  - tRPC base/context/procedures: `apps/web/src/server/api/trpc.ts`
  - Router composition: `apps/web/src/server/api/root.ts`
  - Active routers in `appRouter`: `admin`, `post`, `music`, `equalizer`
  - Other router modules may exist in `apps/web/src/server/api/routers/*` but are not active until registered in `root.ts`
- Database:
  - Drizzle schema: `apps/web/src/server/db/schema.ts`
  - DB runtime/pool: `apps/web/src/server/db/index.ts`
  - Migrations: `apps/web/drizzle/*`
  - Drizzle CLI source config: `apps/web/drizzle.config.cjs`
  - TypeScript mirror config: `apps/web/drizzle.config.ts`
  - Root Drizzle passthrough config: `drizzle.config.ts`
- Shared types/config:
  - Types: `packages/types/src/*`
  - Config/constants/storage keys: `packages/config/src/*`
  - Auth helpers/logging/provider factories: `packages/auth/src/*`
  - App-local utilities: `apps/web/src/utils/*`

## Routing, tRPC, and API Module Conventions

- Next.js routing:
  - UI pages/layouts: `apps/web/src/app/**/page.tsx`, `apps/web/src/app/**/layout.tsx`
  - API handlers: `apps/web/src/app/api/**/route.ts` and `route.tsx`
- tRPC:
  - Use `createTRPCRouter`, `publicProcedure`, `protectedProcedure` from `apps/web/src/server/api/trpc.ts`
  - Register active routers in `apps/web/src/server/api/root.ts`
  - Keep business logic in routers/services, not in React components
- API modules:
  - Prefer tRPC for first-party app data and DB-backed user state
  - Keep `apps/web/src/app/api/*` focused on proxying/upstream transport concerns
  - Reuse existing `_lib.ts` helpers instead of duplicating fetch/header/timeout behavior

## Environment and Config Rules

- Use `apps/web/src/env.js` for validated env access.
- Do not add new direct `process.env` usage in app/server code when `env` is available.
- When adding/changing env vars, update both:
  - `.env.example`
  - `apps/web/src/env.js`
- URL/env conventions:
  - Use `NEXTAUTH_URL` as the single app/auth base URL env.
  - Runtime supports both `SONGBIRD_API_URL` and `API_V2_URL`; do not remove aliases without migration planning.
  - `API_V2_HEALTH_URL` remains a legacy fallback only; prefer route-based checks (`/api/v2/status`, `/api/v2/health`, `/api/health`).
  - For user-scoped upstream calls, forward caller-provided `Authorization` headers.
- Server wrapper/env loading:
  - Root `scripts/server.js` delegates to `apps/web/scripts/server.js`.
  - Dev mode loads only `.env` with override.
  - Production loads `.env.local`, then `.env.production`, then `.env`.
- Package manager:
  - `pnpm-lock.yaml` is the canonical lockfile; default install flow is `pnpm install --frozen-lockfile`.
  - Root scripts may call `npm --prefix ...` internally; preserve script behavior unless explicitly changing it.
  - Current pnpm recursive/workspace scope is root package only; cross-package imports are handled by TS path aliases.

## Navigation and Indexing Expectations

- Work with whole-repo context, not single-file context.
- Prefer cross-file navigation and existing implementations over duplication.
- Before multi-module edits, identify key files and each file's role.
- Search for existing patterns first (router style, proxy style, error/logging style, DB handling) and follow them.

## Repo-Specific Patterns to Reuse

- Boundary-first typing with shared types from `@starchild/types`.
- Existing tRPC auth/error procedure style in `apps/web/src/server/api/trpc.ts`.
- Existing route-handler logging/error format (structured logs, no secret leakage).
- Existing DB conflict handling/retry behavior (sequence sync where needed).
- Existing player/provider patterns from `packages/player-react` and `apps/web/src/contexts/*`.
- For Spotify OAuth in cross-origin setups (`NEXT_PUBLIC_AUTH_API_ORIGIN` differs from frontend origin), initiate browser login on the canonical auth API origin (`${NEXT_PUBLIC_AUTH_API_ORIGIN}/api/auth/spotify?...`) so PKCE/session cookies are issued on the callback origin.

## Change Behavior for Future Tasks

- Before implementation, summarize:
  - files to touch
  - existing patterns being followed
- Keep changes minimal and localized.
- Avoid global architecture/config changes unless explicitly requested.
- Add concise comments only where logic is non-obvious.
- Validate with targeted checks/tests relevant to edited modules.

## Maintenance Rule

- Treat `AGENTS.md` as the source of truth for repository workflow guidance.
- Update this file whenever architectural details or working conventions change.
