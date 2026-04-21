# Starchild Music Frontend

Frontend-first monorepo for the Starchild / Darkfloor music product.

The primary runtime is `apps/web`, a Next.js App Router application backed by tRPC, NextAuth, and Drizzle/Postgres. Desktop shells live in `apps/desktop` with Electron as the main path and Tauri as an experimental parallel track. `apps/mobile` is an Expo-based React Native Web shell that already uses a durable mobile controller architecture.

The Darkfloor API V2 backend is consumed through `API_V2_URL`. The `api/` directory remains a Git submodule for explicit backend or coordinated full-stack work, not the default frontend implementation path.

## Current Snapshot

- Root package: `darkfloor-player@1.15.21`
- Default local frontend URL: `http://127.0.0.1:3222`
- Default backend submodule URL when run locally: `http://127.0.0.1:3333`
- Production frontend runtime: PM2 on Ubuntu (`bluesix-frontend-prod`)
- Active tRPC routers in `apps/web/src/server/api/root.ts`: `admin`, `post`, `music`, `equalizer`
- Additional router module present but not registered: `preferences`
- Current web route groups include:
  - UI pages such as `/`, `/about`, `/library`, `/playlists`, `/settings`, `/signin`, `/spotify`, `/admin`
  - Music detail routes for albums, artists, tracks, playlists, and discovery playlists
  - Route handlers under `/api/**` for auth, Songbird, Spotify, music discovery, V2 health/config/metrics, streaming, OG image generation, and admin diagnostics

## Repository Layout

### Apps

- `apps/web`: primary Next.js App Router product
- `apps/desktop`: Electron desktop shell, packaging helpers, and experimental Tauri runtime
- `apps/mobile`: Expo React Native Web shell with state and persistence in `src/mobile-shell/*`

### Shared packages

- `packages/api-client`: REST and tRPC client helpers
- `packages/auth`: auth logging and provider helpers
- `packages/config`: constants, storage keys, visualizer config
- `packages/types`: shared TypeScript contracts
- `packages/player-core`: playback engine primitives
- `packages/player-react`: React player context and hooks
- `packages/audio-adapters`: runtime audio adapters
- `packages/ui`: shared UI primitives and motion helpers
- `packages/visualizers`: flow-field canvas and visualizer patterns
- `packages/eslint-config`, `packages/tsconfig`: workspace config packages

## First-Time Setup

Run these commands from the repo root.

1. Initialize the backend submodule. Root install runs `install:api` during `postinstall`, so the submodule must exist unless you are intentionally using the missing-submodule escape hatch:

   ```bash
   git submodule update --init --recursive
   ```

2. Install dependencies:

   ```bash
   pnpm install --frozen-lockfile
   ```

3. Create a local env file. The custom server reads `.env` and `.env.local`; prefer `.env.local` for machine-specific overrides:

   ```powershell
   Copy-Item .env.example .env.local
   ```

4. Fill in the required values:
   - `PORT`
   - `AUTH_SECRET`
   - `AUTH_DISCORD_ID`
   - `AUTH_DISCORD_SECRET`
   - `DATABASE_URL`
   - `API_V2_URL`
   - `UNIVERSAL_KEY`

5. Run database commands if your local schema needs to be generated or applied:

   ```bash
   pnpm db:generate
   pnpm db:migrate
   ```

6. Start the frontend only:

   ```bash
   pnpm dev
   ```

7. Open `http://127.0.0.1:3222`.

## Prerequisites

- Node.js 20+
- pnpm 10+
- PostgreSQL for web/auth data
- Git submodules enabled for normal root installs
- Rust only if you plan to use the experimental Tauri path

## Environment Notes

The typed env schema lives in [`apps/web/src/env.js`](./apps/web/src/env.js). The starter template lives in [`.env.example`](./.env.example).

Important current behavior:

- `DATABASE_URL` is the canonical frontend database key used by the web runtime and frontend DB utilities.
- `API_V2_URL` is the canonical upstream API base URL.
- `SONGBIRD_API_URL` remains supported as a compatibility alias.
- The custom server loads `.env`, then `.env.local` in development, and `.env.local`, `.env.production`, then `.env` in production with file values overriding inherited process env.
- New env keys should be added to both `.env.example` and `apps/web/src/env.js`.

## Common Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the main web runtime through the custom server wrapper without launching the `api/` submodule |
| `pnpm dev:api` | Start the backend `api/` submodule explicitly when coordinated backend work is needed |
| `pnpm dev:next` | Run plain Next.js dev server on port `3222` |
| `pnpm build` | Build the web app and the `api/` submodule |
| `pnpm start` | Start the production custom server |
| `pnpm check` | Boundary check plus web lint/typecheck |
| `pnpm test` | Run the web Vitest suite |
| `pnpm mobile:check` | Type-check the Expo mobile workspace |
| `pnpm dev:mobile` | Start the Expo web shell |
| `pnpm electron:dev` | Run the web dev server and Electron together |
| `pnpm tauri:dev` | Start the experimental Tauri shell |
| `pnpm ws:check` | Run workspace checks with Turborepo |

## Key Source Paths

### Web runtime

- [`apps/web/src/app`](./apps/web/src/app)
- [`apps/web/src/server/api`](./apps/web/src/server/api)
- [`apps/web/src/server/auth`](./apps/web/src/server/auth)
- [`apps/web/src/server/db`](./apps/web/src/server/db)
- [`apps/web/scripts/server.js`](./apps/web/scripts/server.js)

### Mobile runtime

- [`apps/mobile/App.tsx`](./apps/mobile/App.tsx)
- [`apps/mobile/src/mobile-shell`](./apps/mobile/src/mobile-shell)
- [`apps/mobile/README.md`](./apps/mobile/README.md)

### Desktop runtime

- [`apps/desktop/electron`](./apps/desktop/electron)
- [`apps/desktop/src-tauri`](./apps/desktop/src-tauri)
- [`apps/desktop/scripts`](./apps/desktop/scripts)

### Shared packages

- [`packages/api-client/src`](./packages/api-client/src)
- [`packages/player-core/src`](./packages/player-core/src)
- [`packages/player-react/src`](./packages/player-react/src)
- [`packages/types/src`](./packages/types/src)
- [`packages/visualizers/src`](./packages/visualizers/src)

## Assistant Entry Points

The canonical repo guidance is:

1. [`AGENTS.md`](./AGENTS.md)
2. [`CONTEXT.md`](./CONTEXT.md)
3. [`README.md`](./README.md)
4. [`AI_TOOLING.md`](./AI_TOOLING.md)
5. [`.codex/prompt.md`](./.codex/prompt.md)
6. [`.codex/tasks.md`](./.codex/tasks.md)
7. [`.codex/acceptance.md`](./.codex/acceptance.md)

Thin compatibility files now exist for common assistants:

- [`CODEX.md`](./CODEX.md)
- [`CLAUDE.md`](./CLAUDE.md)
- [`.cursor/rules/starchild-repo.mdc`](./.cursor/rules/starchild-repo.mdc)
- [`.github/copilot-instructions.md`](./.github/copilot-instructions.md)

Those files intentionally stay short and route back to `AGENTS.md` plus `AI_TOOLING.md`.

## Deployment Notes

- PM2 is the default production context for the frontend.
- Docker is available through [`Dockerfile`](./Dockerfile) and [`docker-compose.yml`](./docker-compose.yml).
- `vercel.json` exists for compatible builds and replica scenarios, but it is not the default production assumption for the main frontend.

## Additional Documentation

- [`AI_TOOLING.md`](./AI_TOOLING.md)
- [`CHANGELOG.md`](./CHANGELOG.md)
- [`apps/web/README.md`](./apps/web/README.md)
- [`apps/desktop/README.md`](./apps/desktop/README.md)
- [`apps/mobile/README.md`](./apps/mobile/README.md)
- [`packages/README.md`](./packages/README.md)

## License

GPLv3. See [`LICENSE.md`](./LICENSE.md).
