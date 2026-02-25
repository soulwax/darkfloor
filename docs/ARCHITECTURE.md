# Architecture

Last updated: 2026-02-22

Starchild Music is a Turborepo-style monorepo centered on a Next.js App Router runtime (`apps/web`) with shared workspace packages and an Electron shell.

## System scope

This repository provides:

- Web UI and server runtime in one Next.js app
- Internal typed API via tRPC for app-owned data
- Auth/session handling via NextAuth + Postgres
- Proxy transport routes to upstream music/auth services
- Shared playback/runtime libraries under `packages/*`

It does not host the upstream Songbird/Bluesix API service itself.

## Monorepo topology

### Apps

- `apps/web` - primary runtime (Next.js App Router, tRPC, NextAuth, Drizzle/Postgres)
- `apps/desktop` - Electron wrapper and packaging pipeline
- `apps/mobile` - minimal scaffold/runtime placeholder

### Shared packages

- Runtime/data: `packages/api-client`, `packages/auth`, `packages/config`, `packages/types`
- Playback stack: `packages/player-core`, `packages/player-react`, `packages/audio-adapters`
- UI/visual: `packages/ui`, `packages/visualizers`

## Runtime entrypoints

### Server wrappers

- Root server wrapper: `scripts/server.js`
- App server implementation: `apps/web/scripts/server.js`

Execution model:

- `pnpm dev` -> `node scripts/server.js` -> Next dev (`--turbo`)
- `pnpm start` -> `node scripts/server.js` -> Next start

### Environment loading

`apps/web/scripts/server.js` environment load order:

- Development: `.env` only (override enabled)
- Production: `.env.local`, `.env.production`, `.env` (first value wins)

## Request and data flows

### High-level flow map

```mermaid
flowchart LR
  User[User] --> UI[Next.js UI\napps/web/src/app]

  UI --> TRPCClient[@starchild/api-client\ntRPC React client]
  TRPCClient --> TRPCEndpoint[/api/trpc]
  TRPCEndpoint --> Routers[apps/web/src/server/api/routers/*]
  Routers --> DB[(Postgres via Drizzle)]

  UI --> RouteHandlers[/api/* route handlers]
  RouteHandlers --> V2[Songbird/Bluesix V2]
  RouteHandlers --> Deezer[Deezer API]

  UI --> Auth[/api/auth/*]
  Auth --> NextAuth[NextAuth config]
  NextAuth --> DB

  Desktop[Electron shell] --> UI
```

### Internal app data (tRPC)

Primary path:

- UI components -> `@starchild/api-client/trpc/react`
- `/api/trpc` route -> `apps/web/src/server/api/root.ts`
- Domain routers -> `apps/web/src/server/api/routers/*`
- Drizzle + pg pool -> `apps/web/src/server/db/*`

Use tRPC for first-party, DB-backed user/application state.

### Upstream integration (route handlers)

Primary transport boundary:

- Next.js handlers: `apps/web/src/app/api/**/route.ts`
- Shared helper modules:
  - `apps/web/src/app/api/v2/_lib.ts`
  - `apps/web/src/app/api/auth/_lib.ts`
  - `apps/web/src/app/api/songbird/_lib.ts`
  - `apps/web/src/app/api/music/_lib.ts`

Use route handlers for upstream transport concerns (headers, retries, auth forwarding, shape normalization).

### Auth/session flow

- NextAuth config/helpers: `apps/web/src/server/auth/*`
- Endpoint: `apps/web/src/app/api/auth/[...nextauth]/route.ts`
- Persistence: Postgres via Drizzle adapter

For split-origin Spotify auth setups, login must begin on the canonical auth API origin to issue callback cookies on the correct domain.

## Subsystem deep dives

### Playback subsystem

Core ownership:

- React provider and hooks: `packages/player-react/src/*`
- Core engine/domain logic: `packages/player-core/src/*`
- Adapter utilities: `packages/audio-adapters/src/*`
- App integration contexts/components: `apps/web/src/contexts/*`, `apps/web/src/components/*`

Queue model semantics:

- `queue[0]` = current track
- `queue[1+]` = upcoming tracks
- history is tracked separately
- authenticated users sync queue state through tRPC; anonymous users rely on local persistence

Playback chain:

```text
Track selection -> /api/stream -> upstream stream -> HTMLAudioElement -> Web Audio API (EQ/analyzer) -> output + visualizers
```

### Database and persistence

- Runtime DB client: `apps/web/src/server/db/index.ts`
- Schema: `apps/web/src/server/db/schema.ts`
- Migrations: `apps/web/drizzle/*.sql`

Persistent domains include auth/session data, playlists, favorites, listening history, queue state, and user preferences.

### Desktop runtime

- Main process: `apps/desktop/electron/main.cjs`
- Preload: `apps/desktop/electron/preload.cjs`
- Packaging helpers: `apps/desktop/scripts/*`, plus `electron-builder` config in root `package.json`

In development, Electron loads the local web runtime (`http://localhost:3222`).

## Boundary and ownership rules

- In `apps/web`, import app-local code via `@/` and shared code via `@starchild/*`.
- In `packages/*`, do not import from app runtime paths.
- Keep UI components free of data-layer business logic; place business rules in routers/services/helpers.
- Prefer existing shared `_lib.ts` transport helpers before adding new fetch logic.

## Deployment surfaces

- Vercel: `vercel.json`
- Docker: `Dockerfile`, `docker-compose.yml`, `ecosystem.docker.cjs`
- PM2: `ecosystem.config.cjs`

Operational runbooks live in `docs/DEPLOYMENT.md`.

## Related docs

- `docs/SETUP.md` - onboarding and local bootstrap
- `docs/DEPLOYMENT.md` - deployment and operations runbooks
- `docs/TROUBLESHOOTING.md` - failure diagnosis and fixes
- `docs/API_ROUTE_USE.md` - route-to-upstream mapping
- `docs/API_USE.md` - external services and env expectations
- `docs/API_V2_SWAGGER.yaml` - upstream API contract reference
