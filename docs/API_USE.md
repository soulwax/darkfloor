# External APIs

This document summarizes the external services Starchild Music integrates with and how they’re used in the frontend.

Upstream OpenAPI reference (not this repo’s API): `docs/API_V2_SWAGGER.yaml` (service base URL is configured via `API_V2_URL`).

## Bluesix V2 (Darkfloor)

**Purpose:** search, streaming, metadata enrichment, and OG preview images.

**Configured by:**

- `API_V2_URL` (server-side base URL)
- `UNIVERSAL_KEY` (optional server-side universal key for service-level integrations)
- `BLUESIX_API_KEY` (server-side key)
- Health checks use internal app routes (`/api/v2/status`, `/api/v2/health`, `/api/health`) and do not require a dedicated env variable.

**Used by:**

- Search proxy: `src/app/api/music/search/route.ts`
- Stream proxy: `src/app/api/stream/route.ts`
- Track metadata (preferred): `src/app/api/track/[id]/route.ts`
- OG previews: `src/app/api/og/route.tsx`

**Upstream contract:** `docs/API_V2_SWAGGER.yaml` (OpenAPI 3.0; contains many more endpoints than this frontend uses).

## Deezer API

**Purpose:** public metadata fallback/augmentation for albums, artists, and tracks.

**Auth:** none (public API endpoints).

**Used by:**

- Track fallback: `src/app/api/track/[id]/route.ts`
- Album routes: `src/app/api/album/[id]/*`
- Artist routes: `src/app/api/artist/[id]/*`

## Discord OAuth (NextAuth)

**Purpose:** user login and session management.

**Configured by:**

- `AUTH_SECRET`
- `AUTH_DISCORD_ID`
- `AUTH_DISCORD_SECRET`
- `NEXTAUTH_URL` (single canonical app/auth base URL env)

**Used by:**

- `src/server/auth/*`
- `src/app/api/auth/[...nextauth]/route.ts`

## Database (Postgres)

**Purpose:** persistence for auth sessions and user data (playlists, favorites, preferences, etc.).

**Configured by:**

- `DATABASE_URL` (required at runtime; see `src/server/db/index.ts`)

**Schema/migrations:**

- `src/server/db/schema.ts`
- `drizzle/*.sql`
