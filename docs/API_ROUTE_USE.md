# API Route Use (Next.js)

This repo uses **Next.js route handlers** under `src/app/api/**` for two purposes:

1. **Internal API** (tRPC, NextAuth, health checks)
2. **Proxy API** to external services (Bluesix V2 / Deezer) to avoid CORS issues and keep secrets server-side

> If you add or change environment variables used by these routes, update both `.env.example` and `src/env.js`.

Upstream OpenAPI reference for the `API_V2_URL` service: `docs/API_V2_SWAGGER.json` (vendored copy; this repo’s API is the Next.js routes listed below). The OpenAPI `servers` entry may list a production base URL, but this app uses `API_V2_URL`.

## Route map

| Route | Method(s) | Source | Upstream / Behavior | Env required |
|---|---:|---|---|---|
| `/api/music/search` | GET | `src/app/api/music/search/route.ts` | Proxies to Bluesix V2 `music/search` (V2-only; no Deezer fallback). | `API_V2_URL`, `BLUESIX_API_KEY` |
| `/api/stream` | GET | `src/app/api/stream/route.ts` | Proxies to Bluesix V2 `music/stream/direct`, including `Range` passthrough for seeking (V2-only). | `API_V2_URL`, `BLUESIX_API_KEY` |
| `/api/track/[id]` | GET | `src/app/api/track/[id]/route.ts` | Tries Bluesix V2 `music/tracks/batch?ids=...` (header `X-API-Key`), falls back to Deezer `track/:id`. | Optional: `API_V2_URL`, `BLUESIX_API_KEY` |
| `/api/og` | GET | `src/app/api/og/route.tsx` | Redirects to Bluesix V2 preview endpoints; supports `trackId` and `q` flows; falls back to `/og-image.png` if V2 not configured. | Optional: `API_V2_URL` |
| `/api/music/releases/latest` | GET | `src/app/api/music/releases/latest/route.ts` | Proxies latest release catalog entries from the upstream discovery service. | `API_V2_URL` |
| `/api/music/playlists/popular` | GET | `src/app/api/music/playlists/popular/route.ts` | Proxies popular curated playlists from the upstream discovery service. | `API_V2_URL` |
| `/api/music/playlists/by-genre-id` | GET | `src/app/api/music/playlists/by-genre-id/route.ts` | Proxies genre-scoped playlists using numeric `genreId` with optional bounded `limit`. | `API_V2_URL` |
| `/api/music/playlists/by-genre` | GET | `src/app/api/music/playlists/by-genre/route.ts` | Proxies genre-scoped playlists using text `genre` as a fallback selector. | `API_V2_URL` |
| `/api/music/genres` | GET | `src/app/api/music/genres/route.ts` | Proxies genre taxonomy for discovery and personalization selectors. | `API_V2_URL` |
| `/api/playlist/[id]` | GET | `src/app/api/playlist/[id]/route.ts` | Proxies discovered playlist tracks from Bluesix V2 `api/music/playlists/{id}` for UI playback pages. | `API_V2_URL` |
| `/api/album/[id]` | GET | `src/app/api/album/[id]/route.ts` | Proxies to Deezer `album/:id`. | none |
| `/api/album/[id]/tracks` | GET | `src/app/api/album/[id]/tracks/route.ts` | Proxies to Deezer `album/:id/tracks` (also fetches album info to enrich track payload). | none |
| `/api/artist/[id]` | GET | `src/app/api/artist/[id]/route.ts` | Proxies to Deezer `artist/:id`. | none |
| `/api/artist/[id]/tracks` | GET | `src/app/api/artist/[id]/tracks/route.ts` | Proxies to Deezer `artist/:id/top?limit=50`. | none |
| `/api/v2/status` | GET | `src/app/api/v2/status/route.ts` | Proxies Bluesix V2 liveness endpoint `/status`; used for lightweight UI health checks. | `API_V2_URL` |
| `/api/v2/version` | GET | `src/app/api/v2/version/route.ts` | Proxies Bluesix V2 diagnostics endpoint `/version` (`name`, `version`, `commitSha`, `buildTime`). | `API_V2_URL` |
| `/api/v2/health` | GET | `src/app/api/v2/health/route.ts` | Proxies Bluesix V2 `/health` endpoint (legacy compatibility fallback for client checks). | `API_V2_URL` |
| `/api/v2/health/ready` | GET | `src/app/api/v2/health/ready/route.ts` | Proxies Bluesix V2 readiness endpoint `/health/ready` (DB/cache/external dependency checks). | `API_V2_URL` |
| `/api/v2/auth/me` | GET | `src/app/api/v2/auth/me/route.ts` | Proxies upstream session/user identity endpoint `/auth/me`. | `API_V2_URL` |
| `/api/v2/auth/refresh` | GET | `src/app/api/v2/auth/refresh/route.ts` | Proxies upstream token/session refresh endpoint `/auth/refresh`. | `API_V2_URL` |
| `/api/auth/spotify` | GET | `src/app/api/auth/spotify/route.ts` | Proxies Spotify OAuth initiation endpoint `/api/auth/spotify` (supports `frontend_redirect_uri`). | `API_V2_URL` |
| `/api/auth/spotify/callback` | GET | `src/app/api/auth/spotify/callback/route.ts` | Proxies Spotify OAuth callback endpoint `/api/auth/spotify/callback` and forwards redirect/cookies. | `API_V2_URL` |
| `/api/auth/spotify/refresh` | POST | `src/app/api/auth/spotify/refresh/route.ts` | Proxies app-token refresh endpoint `/api/auth/spotify/refresh`; forwards `X-CSRF-Token` and cookies. | `API_V2_URL` |
| `/api/auth/me` | GET | `src/app/api/auth/me/route.ts` | Proxies bearer-authenticated profile endpoint `/api/auth/me`. | `API_V2_URL` |
| `/api/auth/signin/spotify` | GET, POST | `src/app/api/auth/signin/spotify/route.ts` | Compatibility shim for legacy NextAuth Spotify sign-in URLs; redirects to canonical `/api/auth/spotify?frontend_redirect_uri=...`. | none (redirect only) |
| `/api/v2/config/public` | GET | `src/app/api/v2/config/public/route.ts` | Proxies upstream non-secret runtime flags endpoint `/config/public`. | `API_V2_URL` |
| `/api/v2/rate-limits` | GET | `src/app/api/v2/rate-limits/route.ts` | Proxies upstream rate-limit policy/status endpoint `/rate-limits`. | `API_V2_URL` |
| `/api/v2/docs/openapi` | GET | `src/app/api/v2/docs/openapi/route.ts` | Proxies upstream OpenAPI alias endpoint `/docs/openapi`. | `API_V2_URL` |
| `/api/v2/cache/stats` | GET | `src/app/api/v2/cache/stats/route.ts` | Proxies upstream cache statistics endpoint `/cache/stats`. Local route requires an admin session. | `API_V2_URL` (+ admin session) |
| `/api/v2/cache/clear` | POST | `src/app/api/v2/cache/clear/route.ts` | Proxies upstream cache invalidation endpoint `/cache/clear`. Local route requires an admin session. | `API_V2_URL` (+ admin session) |
| `/api/v2/music/stream/capabilities` | GET | `src/app/api/v2/music/stream/capabilities/route.ts` | Proxies upstream stream capability endpoint `/music/stream/capabilities`. | `API_V2_URL` |
| `/api/v2/music/tracks/[id]/metadata` | GET | `src/app/api/v2/music/tracks/[id]/metadata/route.ts` | Proxies upstream track metadata endpoint `/music/tracks/:id/metadata`. | `API_V2_URL` |
| `/api/v2/metrics` | GET | `src/app/api/v2/metrics/route.ts` | Proxies upstream Prometheus metrics endpoint `/metrics`. Local route requires an admin session. | `API_V2_URL` (+ admin session) |
| `/api/health` | GET, OPTIONS | `src/app/api/health/route.ts` | Local health endpoint; optionally checks DB connectivity (`@/server/db`). | Optional: `DATABASE_URL` |
| `/api/auth/[...nextauth]` | GET, POST | `src/app/api/auth/[...nextauth]/route.ts` | NextAuth handlers (Discord OAuth). | `AUTH_SECRET`, `AUTH_DISCORD_ID`, `AUTH_DISCORD_SECRET`, `DATABASE_URL` (+ URLs) |
| `/api/trpc/[trpc]` | GET, POST | `src/app/api/trpc/[trpc]/route.ts` | tRPC fetch adapter → `appRouter` (`src/server/api/root.ts`). | Typically: `DATABASE_URL` (+ auth vars if using protected procedures) |

## Bluesix V2 authentication notes

Bluesix V2 is called in two slightly different ways:

- `/api/music/search` and `/api/stream` pass the key as a **query param** named `key`.
- `/api/track/[id]` passes the key via **header** `X-API-Key`.

`API_V2_URL` is normalized by stripping trailing slashes, so a trailing slash is optional.

For upstream endpoint names/parameters, use `docs/API_V2_SWAGGER.json` as the source of truth.

## OG preview query encoding

The upstream preview endpoint (`/api/preview?q=...`) may reject unencoded special characters before they reach the handler. When constructing URLs, always URL-encode the query (e.g. `encodeURIComponent`).

## Spotify OAuth (cross-origin) insights

When frontend and auth API run on different origins (for example `darkfloor.org` frontend and `darkfloor.one` API), use these guardrails:

1. **Prefer canonical auth routes**: use `GET /api/auth/spotify`, `GET /api/auth/spotify/callback`, `POST /api/auth/spotify/refresh`, and `GET /api/auth/me`.
2. **Allow callback frontend origin in backend config**: backend must include the frontend origin in `AUTH_FRONTEND_ORIGINS` when using `frontend_redirect_uri` in production.
3. **Avoid browser-visible redirect chains for auth hydration**: either follow redirects server-side in proxy handlers or fetch the auth API origin directly from callback logic.
4. **Keep CSP aligned with effective request origin(s)**: `connect-src` must include every host used for auth/profile/refresh calls, including canonical host variants.
5. **Refresh requires cookie + CSRF pairing**: send `credentials: 'include'` and `X-CSRF-Token` (`sb_csrf_token`) for `POST /api/auth/spotify/refresh`.
