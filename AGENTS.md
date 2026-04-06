# Agent Guide (songbird-frontend / Starchild Monorepo)

Last updated: 2026-04-06

This is the primary project context for coding agents in this repository. Read this file before making changes.

## Read Order

1. `AGENTS.md` (this file)
2. `CONTEXT.md`
3. `README.md`
4. `AI_TOOLING.md`
5. `apps/mobile/README.md` when the task touches the mobile runtime
6. `.codex/prompt.md` for current workspace state and boundary reminders
7. `.codex/tasks.md` for recurring task checklists and auth/frontend ownership rules
8. `.codex/acceptance.md` for definition-of-done guidance
9. External Darkfloor API V2 repo or contract docs when the task touches backend behavior
10. `api/AGENTS.md` and `api/.codex` only when full-stack/backend work is explicitly required
11. `CHANGELOG.md` when the task is user-visible or release-sensitive
12. `tree.txt` only as a rough snapshot; verify the live filesystem before trusting it

## Required Engineering Standards

Contributors and coding agents should demonstrate:

1. Advanced React architecture (App Router, server/client separation, render optimization)
2. Gesture and animation engineering (precise drag thresholds, mobile-first interactions)
3. Strict TypeScript discipline (no `any`, strong typing, clear contracts)
4. State isolation and hook design (UI state vs playback engine boundaries)
5. Monorepo boundary discipline (respect app/package import boundaries)

## Documentation Reality Check

- The root repo may not always contain the optional `docs/` tree referenced by older snapshots.
- Tool-specific files should stay thin and point back to `AGENTS.md` plus `AI_TOOLING.md`.
- Verify actual files in the working tree before assuming `CLAUDE.md`, `.cursor/`, `.claude/`, or similar helper folders exist.

## High-Level Architecture

This repo is a Turborepo-style frontend monorepo with app runtimes under `apps/` and shared code under `packages/`. The Darkfloor API V2 backend is consumed as an external service via `API_V2_URL`; it is no longer vendored in this repository.

Important boundary:

- Treat this repository as frontend-first. Normal auth, OAuth, routing, cookie, tRPC, and Next.js work should stay in `apps/web` unless the user explicitly asks for coordinated full-stack changes.
- The `api/` directory is a Git submodule for the external backend service. Do not treat it as part of the normal frontend implementation path.
- Do not infer frontend auth behavior from backend auth env vars. Frontend Auth.js/NextAuth behavior is owned by the web runtime unless a task explicitly spans both systems.

- Apps:
  - `apps/web`: primary Next.js App Router runtime (tRPC + NextAuth + Drizzle/Postgres)
  - `apps/desktop`: Electron wrapper and packaging scripts
  - `apps/mobile`: Expo-based React Native Web app with a future path to iOS and Android
- Shared packages:
  - Runtime packages: `packages/api-client`, `packages/auth`, `packages/config`, `packages/types`
  - Playback packages: `packages/player-core`, `packages/player-react`, `packages/audio-adapters`
  - UI and visual packages: `packages/ui`, `packages/visualizers`
  - Config placeholders: `packages/eslint-config`, `packages/tsconfig`
  - Package imports in app code (`@starchild/*`) resolve to `packages/*/src` via TypeScript path aliases
- Infra and runtime config:
  - Root runtime/build config in `package.json`, `turbo.json`, `vercel.json`, `Dockerfile`, `ecosystem*.cjs`
  - DB migrations in `apps/web/drizzle`
Note on upstream APIs:

- The frontend still consumes the backend through route handlers under `apps/web/src/app/api/**`.
- The backend source is maintained outside this repo; consult the external backend repository or contract docs when behavior-level backend work is required.
- `docs/API_V2_SWAGGER.yaml` may exist as a vendored contract copy in some checkouts.

## Where Core Logic Lives

- Auth/session:
  - NextAuth configuration: `apps/web/src/server/auth/*`
  - NextAuth route handler: `apps/web/src/app/api/auth/[...nextauth]/route.ts`
  - Auth proxy helpers/routes: `apps/web/src/app/api/auth/*`
- Playback:
  - React context/hook: `packages/player-react/src/AudioPlayerContext.tsx`, `packages/player-react/src/useAudioPlayer.ts`
  - Core playback logic: `packages/player-core/src/*`
  - Audio adapters: `packages/audio-adapters/src/*`
- Mobile runtime:
  - Expo entrypoints: `apps/mobile/App.tsx`, `apps/mobile/index.ts`
  - Mobile shell composition/state: `apps/mobile/src/mobile-shell/*`
  - Mobile runtime metadata: `apps/mobile/src/index.ts`
  - Mobile workspace guidance: `apps/mobile/README.md`
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
  - Dev mode loads `.env`, then `.env.local` with override so local machine settings win.
  - Production loads `.env.local`, then `.env.production`, then `.env`, with file values overriding inherited process env so stale PM2/shell variables do not win.
- Package manager:
  - `pnpm-lock.yaml` is the canonical lockfile; default install flow is `pnpm install --frozen-lockfile`.
  - Root scripts may call `npm --prefix ...` internally; preserve script behavior unless explicitly changing it.

## Navigation and Indexing Expectations

- Work with whole-repo context, not single-file context.
- Prefer cross-file navigation and existing implementations over duplication.
- Before multi-module edits, identify key files and each file's role.
- Search for existing patterns first (router style, proxy style, error/logging style, DB handling) and follow them.
- Default to the frontend workspace first. Only inspect `api/` when the task explicitly requires backend behavior, contracts, or coordinated full-stack changes.
- If a task spans frontend and backend behavior, inspect the root docs first and then consult the external backend repository or contract docs as needed.

## Repo-Specific Patterns to Reuse

- Boundary-first typing with shared types from `@starchild/types`.
- Existing tRPC auth/error procedure style in `apps/web/src/server/api/trpc.ts`.
- Existing route-handler logging/error format (structured logs, no secret leakage).
- Existing DB conflict handling/retry behavior (sequence sync where needed).
- Existing player/provider patterns from `packages/player-react` and `apps/web/src/contexts/*`.
- Existing mobile-shell split in `apps/mobile/src/mobile-shell/*` instead of a single-file Expo app.
- For Spotify OAuth in cross-origin setups (`NEXT_PUBLIC_AUTH_API_ORIGIN` differs from frontend origin), initiate browser login on the canonical auth API origin (`${NEXT_PUBLIC_AUTH_API_ORIGIN}/api/auth/spotify?...`) so PKCE/session cookies are issued on the callback origin.

## Change Behavior for Future Tasks

- Before implementation, summarize:
  - files to touch
  - existing patterns being followed
- For auth/OAuth work, explicitly state whether the change is:
  - frontend Auth.js / Next.js behavior in `apps/web`
  - backend API/submodule behavior in `api/`
  - coordinated full-stack behavior across both
- If a task also requires backend changes, call out that the implementation lives in a separate repository/service.
- Keep changes minimal and localized.
- Avoid global architecture/config changes unless explicitly requested.
- Add concise comments only where logic is non-obvious.
- Validate with targeted checks/tests relevant to edited modules.
- For user-visible changes, update version metadata and `CHANGELOG.md`.

## Maintenance Rule

- Treat `AGENTS.md` as the source of truth for repository workflow guidance.
- Update this file whenever architectural details or working conventions change.
