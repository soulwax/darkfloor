# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Package Manager

**This project uses pnpm** (version 10.30.0). Do NOT use npm commands - they will fail or create conflicts.

## Commands

All commands run from the **repo root** unless noted.

**Development:**

```bash
pnpm install              # Install dependencies
pnpm dev                  # Dev server (custom server at scripts/server.js, loads only .env)
pnpm dev:next             # Next.js dev only (port 3222, turbopack, no custom server)
pnpm test                 # Vitest (jsdom environment)
pnpm test:watch           # Vitest watch mode
```

**Build & Production:**

```bash
pnpm build                # Full production build
pnpm start                # Production custom server
pnpm preview              # Build then start (test production locally)
```

**Code Quality (run before committing):**

```bash
```bash
pnpm check                # Package boundaries + ESLint + TypeScript (run this!)
pnpm lint                 # ESLint only
pnpm lint:fix             # ESLint with auto-fix
pnpm typecheck            # TypeScript only
pnpm format:check         # Prettier check
pnpm format:write         # Prettier (auto-fix)
pnpm check:boundaries     # Enforce package import boundaries
```

**Database (Drizzle):**

```bash
pnpm db:generate          # Generate migration from schema changes
pnpm db:migrate           # Run pending migrations
pnpm db:push              # Push schema directly (dev only)
pnpm db:studio            # Drizzle Studio GUI
pnpm db:mark-applied      # Mark migrations as applied (utility)
```

**Workspace (Turborepo - runs tasks across all apps + packages):**

```bash
pnpm ws:build             # Build all packages + apps (respects dependency graph)
pnpm ws:dev               # Dev all packages + apps in parallel
pnpm ws:check             # Lint + typecheck across workspace
pnpm ws:lint              # Lint all packages
pnpm ws:typecheck         # Typecheck all packages
pnpm ws:test              # Test all packages
pnpm ws:format:check      # Prettier check across workspace
pnpm ws:format:write      # Prettier format across workspace
```

**PM2 (Production Deployment):**

```bash
pnpm pm2:start            # Start production server with PM2
pnpm pm2:dev              # Start dev server with PM2
pnpm pm2:reload           # Graceful reload (zero-downtime)
pnpm pm2:restart          # Hard restart
pnpm pm2:stop             # Stop server
pnpm pm2:delete           # Remove from PM2
pnpm pm2:logs             # View production logs
pnpm pm2:logs:dev         # View dev logs
pnpm pm2:logs:error       # View error logs only
pnpm pm2:status           # Check PM2 status
pnpm pm2:monit            # Real-time monitoring
pnpm deploy               # Build + reload (prod deployment)
pnpm pub                  # Build + restart (alternative)
```

**Electron:**

```bash
pnpm electron:dev         # Run app + Electron in dev mode
pnpm electron:build       # Build for current platform
pnpm electron:build:win   # Build Windows installer + portable
pnpm electron:build:mac   # Build macOS DMG (x64 + arm64)
pnpm electron:build:linux # Build Linux AppImage + DEB
pnpm electron:prod        # Build and run production Electron
```

**Utilities:**

```bash
pnpm generate:ssl         # Generate SSL certificate for dev
pnpm env:keypair          # Create RSA keypair for env encryption
pnpm env:encrypt          # Encrypt env file with certificate
pnpm clean                # Remove build artifacts (Unix)
pnpm clean:win            # Remove build artifacts (Windows)
pnpm build:analyzer       # Build with bundle analyzer
```

**Run a single test file:**

```bash
pnpm exec vitest run apps/web/src/__tests__/example.test.ts
```

## Architecture

**Monorepo**: Turborepo with `apps/web` (Next.js), `apps/desktop` (Electron), and `packages/*` (shared libs).

### Runtime data flow

```text
UI → @starchild/api-client/trpc/react → /api/trpc → src/server/api/routers/* → Postgres (Drizzle)
UI → /api/** proxy routes → Bluesix V2 / Deezer external APIs
Auth → /api/auth/** → NextAuth v5 → DB-backed sessions
Electron → loads http://localhost:3222 (dev) / bundled standalone build (prod)
```

### Packages (`packages/`)

Import via `@starchild/*` alias — never import from `apps/web` inside packages.

| Package | Purpose |
| --- | --- |
| `@starchild/api-client` | tRPC React provider + REST helpers. Subpath exports: `./trpc/react`, `./trpc/server`, `./rest` |
| `@starchild/player-react` | `AudioPlayerContext`, `useAudioPlayer` hook, queue persistence |
| `@starchild/player-core` | Core audio engine, queue logic, Web Audio API primitives |
| `@starchild/audio-adapters` | Web Audio Context manager |
| `@starchild/visualizers` | 80+ canvas visualizers (`FlowFieldRenderer`, `FlowFieldCanvas`) |
| `@starchild/ui` | Shared components (Button, Toast, SmoothSlider) + `cn()` utility |
| `@starchild/types` | Domain types for music, player state, search, settings |
| `@starchild/config` | App-wide constants, localStorage keys, visualizer config |
| `@starchild/auth` | NextAuth helpers, Discord/Spotify OAuth providers |

### Key app directories (`apps/web/src/`)

- `app/` — Next.js App Router pages and API route handlers
- `app/api/v2/**` — Proxy routes to Bluesix V2 upstream (see `docs/API_ROUTE_USE.md`)
- `app/api/trpc/[trpc]/route.ts` — tRPC endpoint
- `server/api/routers/` — tRPC routers: `music`, `equalizer`, `preferences`, `admin`
- `server/api/root.ts` — Router registration
- `server/auth/` — NextAuth configuration
- `server/db/schema.ts` — Drizzle table definitions (19KB)
- `server/db/index.ts` — pg Pool init (throws if `DATABASE_URL` missing)
- `proxy.ts` — Rate-limit and CSP/security headers
- `env.js` — Zod env schema (`@t3-oss/env-nextjs`); all env vars go here

## Working conventions

**API boundaries:**

- First-party app data → tRPC (`server/api/routers/`). Register new routers in `server/api/root.ts`.
- External upstream calls → proxy route handlers in `app/api/**/route.ts`.

**Import aliases:**

- `@/` — app-local imports within `apps/web`
- `@starchild/*` — shared workspace packages

**Adding env vars:** Update both `.env.example` and `apps/web/src/env.js`. Never read `process.env` directly in server code; go through `env`.

**Env loading** (custom server `apps/web/scripts/server.js`):

- `NODE_ENV=development`: loads only `.env` with override
- production: loads `.env.local` → `.env.production` → `.env` (no override)

**Server vs. client components:**

- `@starchild/api-client/rest` uses `window.location.origin` — **throws on the server** unless `baseUrl` is provided. Use `getRequestBaseUrl()` from `@/utils/getBaseUrl` for server-side fetches.
- Keep client: Web Audio API, Canvas, `requestAnimationFrame`, `useGlobalPlayer()`, `useSession()`, `framer-motion`, `@dnd-kit`, gesture handlers.

**DB schema changes:** Edit `apps/web/src/server/db/schema.ts`, then run `pnpm db:generate` + `pnpm db:migrate`.

**Playback changes:** Edit `packages/player-react/` and/or `packages/player-core/`.

**Linting:** ESLint 9 flat config. `drizzle/enforce-delete-with-where` and `drizzle/enforce-update-with-where` are errors — always include `.where()` on destructive Drizzle queries.

## Documentation

- `CONTEXT.md` — Short orientation + key paths (read first)
- `docs/architecture.md` — System architecture diagram and data flows
- `docs/API_ROUTE_USE.md` — How proxy routes map to upstream backends
- `docs/API_V2_SWAGGER.yaml` — OpenAPI spec for the upstream Bluesix API (`API_V2_URL`), not this repo's surface
