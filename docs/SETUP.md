# Setup and Onboarding

This guide is the long-form setup companion to the root `README.md`. Use it when you need full local bootstrap and contributor onboarding details.

## Prerequisites

- Node.js 20+
- pnpm 10+
- PostgreSQL (local or hosted)

Commands below are run from the repository root.

## 1. Install dependencies

```bash
pnpm install --frozen-lockfile
```

`pnpm-lock.yaml` is the canonical lockfile for this monorepo.

## 2. Create local environment file

```bash
cp .env.example .env
```

The server wrapper (`scripts/server.js` -> `apps/web/scripts/server.js`) loads:

- development: `.env` only (override enabled)
- production: `.env.local`, then `.env.production`, then `.env`

For local development, put your values in `.env`.

## 3. Fill required environment variables

The typed schema is defined in `apps/web/src/env.js`.

Minimum required values for a functional local app:

| Variable | Why it is needed |
| --- | --- |
| `AUTH_SECRET` | Required by NextAuth (`min(32)` enforced). |
| `AUTH_DISCORD_ID` | Required by Discord provider config. |
| `AUTH_DISCORD_SECRET` | Required by Discord provider config. |
| `DATABASE_URL` | Required at runtime by `apps/web/src/server/db/index.ts`. |
| `API_V2_URL` | Base URL for Bluesix/Songbird V2 proxy routes. |
| `BLUESIX_API_KEY` (or `UNIVERSAL_KEY`) | Auth key used by stream/search and other upstream calls. |

Useful optional values:

- `NEXTAUTH_URL` (recommended canonical app/auth URL)
- `AUTH_SPOTIFY_ENABLED` + `NEXT_PUBLIC_AUTH_SPOTIFY_ENABLED`
- `SPOTIFY_CLIENT_ID` + `SPOTIFY_CLIENT_SECRET` (required when Spotify auth is enabled)
- `NEXT_PUBLIC_AUTH_API_ORIGIN` (for split frontend/auth origins)

Generate an auth secret (any strong 32+ char value works):

```bash
openssl rand -base64 32
```

## 4. Initialize database schema

Run migrations with Drizzle:

```bash
pnpm db:generate
pnpm db:migrate
```

Useful alternatives:

```bash
pnpm db:push   # development convenience, applies schema directly
pnpm db:studio # Drizzle Studio UI
```

## 5. Start development runtime

```bash
pnpm dev
```

Other runtime options:

```bash
pnpm dev:next      # Next.js only
pnpm electron:dev  # web server + Electron shell
```

App URL: `http://localhost:3222`

## 6. Verify health

```bash
curl http://localhost:3222/api/health
```

Expected shape:

- `status: "ok"` when server is healthy
- `checks.database: "ok"` when DB connectivity is available
- `checks.database: "skipped"` when DB is intentionally missing in a non-critical context

After local validation, continue with deployment runbooks in `docs/DEPLOYMENT.md`.

## First-day contributor checklist

- Read `AGENTS.md` for repo workflow and boundaries.
- Read `CONTEXT.md` for quick path mapping.
- Read `docs/ARCHITECTURE.md` for runtime/data flow context.
- Run quality checks before opening a PR:

```bash
pnpm check
pnpm test
```

## Cross-origin Spotify OAuth note

When frontend and auth API run on different origins, initiate login on the canonical auth origin:

- `${NEXT_PUBLIC_AUTH_API_ORIGIN}/api/auth/spotify?...`

This ensures PKCE/session cookies are minted on the callback origin.

## Common setup pitfalls

### Startup fails with missing env errors

- Re-check `.env` against `apps/web/src/env.js` and `.env.example`.
- Ensure values are non-empty and valid URLs where required.

### Database errors on startup

- Confirm `DATABASE_URL` is set and reachable.
- Verify SSL mode for your provider (cloud DBs usually require SSL).

### Stream/search requests fail

- Confirm `API_V2_URL` and `BLUESIX_API_KEY` (or `UNIVERSAL_KEY`) are set.
- Check `/api/v2/status` and `/api/health` for local diagnostics.
