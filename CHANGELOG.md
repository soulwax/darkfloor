# Changelog

All notable changes to Starchild Music will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.7] - 2026-02-22

### Added

- **Mobile player drag-decision utility with thresholded dismiss logic**: Added reusable drag helpers that clamp upward offsets and dismiss only when downward drag reaches 50% of panel height. Locations: `apps/web/src/components/mobilePlayerDrag.ts`, `apps/web/src/__tests__/mobilePlayerDrag.test.ts`.
- **Extracted mobile footer action component**: Added `MobilePlayerFooterActions` to encapsulate queue, playlist, and favorite controls (including playlist selector overlay) with drag-exempt annotations. Location: `apps/web/src/components/MobilePlayerFooterActions.tsx`.
- **Dedicated setup/deployment/troubleshooting docs**: Added long-form operational guides to keep root README concise while preserving onboarding and runbook depth. Locations: `docs/SETUP.md`, `docs/DEPLOYMENT.md`, `docs/TROUBLESHOOTING.md`.

### Changed

- **Expanded mobile player drag behavior hardened**: Reworked expanded-sheet drag handling to use explicit drag controls, panel-height measurement (`ResizeObserver`), 50% dismiss threshold decisions, reduced-motion snap-back, and interaction guards that avoid accidental dismissal while using controls/inputs or scrolled content. Location: `apps/web/src/components/MobilePlayer.tsx`.
- **Expanded mobile player layout restructured**: Converted the expanded sheet body to a scrollable content region with pinned footer actions; consolidated close behavior via shared callback; queue toggles now collapse playlist selector to prevent overlapping surfaces. Location: `apps/web/src/components/MobilePlayer.tsx`.
- **Integrated mobile player tests aligned with new footer architecture**: Updated queue badge/action assertions to target extracted footer actions, updated playlist id typing to numeric IDs, and refreshed icon/class assertions for DOM attribute access. Location: `apps/web/src/__tests__/MobilePlayer.integrated-controls.test.tsx`.
- **Vitest package alias map expanded for workspace imports**: Added direct aliases for `@starchild/ui`, `@starchild/config`, `@starchild/types`, `@starchild/player-react`, and `@starchild/api-client` in web test config. Location: `apps/web/vitest.config.ts`.
- **Repository guidance/docs refreshed for current monorepo conventions**: Updated agent/context guidance, condensed README framing, docs index coverage, architecture references, and tree snapshot to reflect pnpm-first workflows and current file layout. Locations: `AGENTS.md`, `CONTEXT.md`, `README.md`, `docs/README.md`, `docs/ARCHITECTURE.md`, `tree.txt`.
- **Ancillary file annotations refreshed**: Added/updated file header comments in config/type/context files. Locations: `apps/web/drizzle.config.ts`, `apps/web/src/contexts/GuestModalContext.tsx`, `ecosystem.docker.cjs`, `electron/types.d.ts`.
- **Local test runtime artifact updated**: Vitest cache results file changed during local test execution. Location: `apps/web/node_modules/.vite/vitest/da39a3ee5e6b4b0d3255bfef95601890afd80709/results.json`.

## [1.1.6] - 2026-02-22

### Added

- **Accessible dropdown menu primitives for keyboard-first actions**: Added a shared Radix-based dropdown menu UI primitive and migrated the Library header overflow actions to it for built-in roving focus, keyboard navigation, and escape/outside-close behavior. Locations: `apps/web/src/components/ui/dropdown-menu.tsx`, `apps/web/src/app/library/page.tsx`.

### Changed

- **Library bulk mutations now run with bounded concurrency**: `Save as Playlist`, bulk remove, and undo restore operations now use a shared concurrency-limited batch helper (`8` at a time) instead of sequential loops/fail-fast behavior, reducing latency on large libraries while preventing unbounded request bursts. Location: `apps/web/src/app/library/page.tsx`.
- **Partial bulk-operation failures now preserve useful progress**: Removal/restore flows now retain successful work, show warning-level counts for failed items, and keep failed undo entries available for retry within the undo window. Location: `apps/web/src/app/library/page.tsx`.
- **Selection affordance clarified under filters**: Selection mode now switches from `Select All` to `Select Visible` when a search filter is active, and card keyboard activation in selection mode toggles selection rather than playback. Location: `apps/web/src/app/library/page.tsx`.

## [1.1.5] - 2026-02-20

### Changed

- **Spotify auth endpoint origin resolution now runtime-safe**: Client auth requests now resolve their base origin from `NEXT_PUBLIC_AUTH_API_ORIGIN`, then browser origin, then fallback constant before building `/api/auth/*` URLs, preventing environment mismatch during OAuth bootstrap and refresh. Locations: `apps/web/src/services/spotifyAuthClient.ts`, `apps/web/src/__tests__/spotifyAuthClient.test.ts`.
- **Dialog primitives now clamp modal height to viewport**: Base dialog content now enforces viewport-relative `max-h` bounds and overflow clipping to reduce small-screen modal clipping/bleed. Location: `apps/web/src/components/ui/dialog.tsx`.
- **Web viewport metadata hardened for iOS behavior**: Updated Next.js viewport export for cover-fit and keyboard resize behavior consistency on mobile Safari. Location: `apps/web/src/app/layout.tsx`.

### Fixed

- **Greeter modal mobile displacement regression on iPhone**: The guest tuning modal now forces mobile sheet anchoring (`!left-0`, `!right-0`, `!translate-x-0`, `!w-full`), uses `90dvh` sizing, and keeps internal scroll safe-area aware so the sheet no longer shifts off-screen on narrow iOS viewports. Location: `apps/web/src/components/GuestModal.tsx`.

## [1.1.4] - 2026-02-20

### Added

- **Library overflow action menu**: Added a compact `More` menu in the Library header that groups tertiary actions (`Save as Playlist`, `Build Smart Queue`, and history cleanup actions) with keyboard-close support (`Escape`). Location: `apps/web/src/app/library/page.tsx`.
- **Library section grouping cues**: Added explicit section labeling and track count context above grid content, plus a direct `Playlists` navigation shortcut in the library header. Location: `apps/web/src/app/library/page.tsx`.

### Changed

- **Library header hierarchy redesign**: Reorganized `/library` controls around clear priority: section tabs, integrated search, and a prominent mobile-first `Play All` CTA, with secondary controls kept compact. Location: `apps/web/src/app/library/page.tsx`.
- **Library card interaction model**: Updated cards to a tighter layout with hover/focus overlay actions (`Play`, `Favorite`, context menu), stronger visual grouping, and consistent 200ms transitions for desktop and keyboard users. Location: `apps/web/src/app/library/page.tsx`.
- **Responsive grid density**: Tightened card spacing and updated breakpoints to keep mobile single-column readability while scaling to `2/3/4` columns on larger screens. Location: `apps/web/src/app/library/page.tsx`.

## [1.1.3] - 2026-02-20

### Added

- **Library conversion actions**: Added `Save As Playlist` and `Smart Queue` actions to the Library action bar, with selected tracks prioritized and visible filtered tracks used as fallback scope. Location: `apps/web/src/app/library/page.tsx`.
- **History cleanup mutations**: Added typed tRPC mutations for `clearHistory` and `clearNonFavoritesFromHistory` so the UI can execute one-click history cleanup safely server-side. Location: `apps/web/src/server/api/routers/music.ts`.

### Changed

- **Library convenience controls expanded**: Added sort controls (`Newest`, `Oldest`, `Artist`, `Album`, `Duration`) and selection-aware bulk actions (`Play Selected`, `Queue Selected`, `Remove Selected`) to speed up collection management. Location: `apps/web/src/app/library/page.tsx`.
- **History management UX**: Added explicit History-only actions for `Clear Non-Favorites` and `Clear History`, both with confirm prompts and post-action feedback.
- **Removal rollback flow**: Library remove operations now include timed undo restoration for favorites and history removals, preserving track context for fast recovery after bulk actions.

## [1.1.2] - 2026-02-20

### Added

- **OAuth diagnostics dump surfaces**: Added protected OAuth dump API routes and admin rendering for verbose Spotify/Discord auth traces (`fetch` timeline + auth logs) with refresh/clear controls. Locations: `apps/web/src/app/api/auth/oauth/fetch-dump/route.ts`, `apps/web/src/app/api/admin/auth/fetch-dump/route.ts`, `apps/web/src/app/admin/page.tsx`, `packages/auth/src/logging.ts`.
- **Sign-out helper for unified auth cleanup**: Added browser sign-out helper that clears Spotify auth artifacts before executing NextAuth sign-out. Location: `apps/web/src/services/authSignOut.ts`.

### Changed

- **Spotify OAuth logout behavior hardened**: UI sign-out actions now use the shared helper so in-memory/session Spotify token state and trace artifacts are cleared on logout. Locations: `apps/web/src/services/spotifyAuthClient.ts`, `apps/web/src/components/HamburgerMenu.tsx`, `apps/web/src/components/DesktopSidebar.tsx`, `apps/web/src/app/settings/page.tsx`.
- **OAuth debug tracing coverage expanded**: Added/updated test coverage for protected dump routes, Spotify proxy behavior, and provider configuration hardening. Locations: `apps/web/src/__tests__/api-auth-fetch-dump-routes.test.ts`, `apps/web/src/__tests__/api-auth-spotify-routes.test.ts`, `apps/web/src/__tests__/spotifyAuthClient.test.ts`, `apps/web/src/__tests__/spotify-provider.test.ts`.

### Security

- **Spotify debug proxy now requires admin session**: `GET /api/auth/spotify/debug` no longer proxies backend dumps for unauthenticated/non-admin callers. Location: `apps/web/src/app/api/auth/spotify/debug/route.ts`.
- **Explicit CSRF+PKCE checks on NextAuth Spotify provider**: Added explicit `checks: ["pkce", "state"]` to Spotify provider configuration for defense-in-depth. Location: `packages/auth/src/spotifyProvider.ts`.

## [1.1.1] - 2026-02-20

### Added

- **Server-only Songbird token exchange helper**: Added a server-only helper that exchanges `UNIVERSAL_KEY` via `POST /api/auth/token`, caches the bearer token in memory until `expiresAt - 30s`, and throws typed errors with status/message/details on token failures. Location: `apps/web/src/lib/server/songbird-token.ts`.
- **Internal Songbird proxy routes with retry + normalized errors**: Added `GET /api/songbird/auth-me` and `GET /api/songbird/cache-stats` routes that obtain server bearer tokens, retry once on upstream `401` with forced token refresh, and return UI-safe failures in `{ ok: false, status, message, details? }` format. Locations: `apps/web/src/app/api/songbird/_lib.ts`, `apps/web/src/app/api/songbird/auth-me/route.ts`, `apps/web/src/app/api/songbird/cache-stats/route.ts`.
- **Client Songbird hooks and verification pages**: Added `useSongbirdAuthMe()` and `useSongbirdCacheStats()` plus simple pages to render each endpoint through internal Next.js routes only. Locations: `apps/web/src/hooks/useSongbirdResource.ts`, `apps/web/src/hooks/useSongbirdAuthMe.ts`, `apps/web/src/hooks/useSongbirdCacheStats.ts`, `apps/web/src/app/songbird/auth-me/page.tsx`, `apps/web/src/app/songbird/cache-stats/page.tsx`.
- **Songbird regression coverage**: Added tests for token caching/error typing, proxy `401` refresh behavior, normalized route failures, and page-level internal-route fetch behavior. Locations: `apps/web/src/__tests__/songbird-token.test.ts`, `apps/web/src/__tests__/api-songbird-routes.test.ts`, `apps/web/src/__tests__/songbird-pages.test.tsx`.

### Changed

- **Env naming migration toward Songbird terminology**: Added canonical `SONGBIRD_API_URL` and `SONGBIRD_API_HEALTH_URI` in env validation/runtime wiring, while keeping compatibility fallbacks from legacy aliases where needed. Location: `apps/web/src/env.js`.
- **Health upstream path is now configurable and slash-agnostic**: `/api/v2/health` now composes its upstream path from `SONGBIRD_API_HEALTH_URI` (with `API_V2_HEALTH_URL` fallback) and supports either leading/trailing slash styles in env values. Location: `apps/web/src/app/api/v2/health/route.ts`.
- **Environment templates/startup diagnostics updated**: Updated `.env` templates to expose `SONGBIRD_API_URL` and `SONGBIRD_API_HEALTH_URI`, and updated startup banner output to prefer Songbird naming. Locations: `.env.example`, `apps/web/scripts/server.js`, `apps/web/src/test/setup.ts`.

### Security

- **`UNIVERSAL_KEY` kept server-side only by design**: Token issuance and bearer acquisition remain isolated to server-only code paths and are not referenced by client hooks/components.

## [1.1.0] - 2026-02-19

### Added

- **Configurable browser auth API origin for split-domain deployments**: Added `NEXT_PUBLIC_AUTH_API_ORIGIN` to client env validation/templates so Spotify callback profile hydration can target a dedicated auth/API origin when frontend and API are on different hosts. Locations: `apps/web/src/env.js`, `.env.example`, `apps/web/src/services/spotifyAuthClient.ts`.
- **Auth regression tests for redirect mode and re-auth behavior**: Added coverage validating proxy redirect policy (`manual` vs `follow`), direct callback profile fetch target, and auth-required signaling on refresh `401`. Locations: `apps/web/src/__tests__/api-auth-spotify-routes.test.ts`, `apps/web/src/__tests__/spotifyAuthClient.test.ts`.

### Changed

- **Spotify callback profile hydration now uses explicit auth API origin**: Callback hash handling keeps in-memory token flow but now requests `GET {auth-origin}/api/auth/me` with bearer auth and `credentials: include`, avoiding fragile browser-visible redirect chains. Location: `apps/web/src/services/spotifyAuthClient.ts`.
- **Auth proxy redirect strategy is route-aware**: Shared auth proxy now supports configurable redirect behavior; `/api/auth/me` and `/api/auth/spotify/refresh` follow upstream redirects server-side while OAuth initiation/callback retain manual redirect passthrough semantics. Locations: `apps/web/src/app/api/auth/_lib.ts`, `apps/web/src/app/api/auth/me/route.ts`, `apps/web/src/app/api/auth/spotify/refresh/route.ts`.
- **Session recovery UX now opens sign-in CTA on auth loss**: Refresh failures due to missing CSRF cookie or upstream `401` clear in-memory token state and dispatch an auth-required event consumed by the auth modal provider. Locations: `apps/web/src/services/spotifyAuthClient.ts`, `apps/web/src/contexts/AuthModalContext.tsx`.

### Fixed

- **Post-Spotify callback failure on `darkfloor.org`**: Eliminated CSP-blocked auth bootstrap paths by expanding `connect-src` to include `https://www.darkfloor.one` and `https://darkfloor.one`, while retaining websocket entries. Location: `apps/web/src/proxy.ts`.

## [1.0.5] - 2026-02-19

### Added

- **Canonical Bluesix auth proxy routes under `/api/auth/*`**: Added Next.js proxy handlers for `GET /api/auth/spotify`, `GET /api/auth/spotify/callback`, `POST /api/auth/spotify/refresh`, and `GET /api/auth/me`, backed by shared header/cookie forwarding logic bound to `API_V2_URL`. Locations: `apps/web/src/app/api/auth/_lib.ts`, `apps/web/src/app/api/auth/spotify/route.ts`, `apps/web/src/app/api/auth/spotify/callback/route.ts`, `apps/web/src/app/api/auth/spotify/refresh/route.ts`, `apps/web/src/app/api/auth/me/route.ts`.
- **Spotify OAuth client for hash-token callback flow**: Added browser auth client utilities for login URL construction, in-memory access token state, callback hash parsing/cleanup, CSRF-based refresh, and authenticated fetch with automatic token handling. Location: `apps/web/src/services/spotifyAuthClient.ts`.
- **Dedicated frontend callback routes for OAuth completion**: Added `/auth/callback` and `/auth/spotify/callback` pages with loading UI, redirect resolution, timeout/error fallback actions, and provider-aware messaging. Locations: `apps/web/src/app/auth/callback/page.tsx`, `apps/web/src/app/auth/spotify/callback/page.tsx`, `apps/web/src/utils/authRedirect.ts`.
- **Regression coverage for auth flow + loading UX**: Added tests covering canonical proxy routing, callback redirect logic, hash parsing/token refresh behavior, and callback loading/error states. Locations: `apps/web/src/__tests__/api-auth-spotify-routes.test.ts`, `apps/web/src/__tests__/spotifyAuthClient.test.ts`, `apps/web/src/__tests__/AuthCallbackPage.test.tsx`, `apps/web/src/__tests__/SpotifyAuthCallbackPage.test.tsx`, `apps/web/src/__tests__/authRedirect.test.ts`.

### Changed

- **Sign-in surfaces now use canonical Spotify login redirect**: Sign-in page and auth modal route Spotify through `/api/auth/spotify?frontend_redirect_uri=...`, disable duplicate submits during initiation, and show explicit spinner-based pending states with timeout cleanup. Locations: `apps/web/src/app/signin/page.tsx`, `apps/web/src/components/AuthModal.tsx`.
- **Smart Queue requests now use auth-aware fetch path**: Queue service now reads in-memory app access token first and sends requests via `authFetch`, improving compatibility with the new token lifecycle. Location: `apps/web/src/services/smartQueue.ts`.

## [1.0.4] - 2026-02-17

### Changed

- **Emily icon unified as canonical app icon**: Updated shell branding surfaces to use `/emily-the-strange.png` so sidebar/drawer icon rendering is consistent. Locations: `apps/web/src/components/DesktopSidebar.tsx`, `apps/web/src/components/HamburgerMenu.tsx`.
- **Web app icon metadata switched to Emily**: Root metadata now publishes `emily-the-strange.png` for browser/app icon + Apple touch icon, with `favicon.ico` retained as fallback. Location: `apps/web/src/app/layout.tsx`.
- **Electron/Linux icon resolution updated**: Main process now prefers `emily-the-strange.png` for window icon lookup, with legacy `icon.png` fallback preserved. Location: `apps/desktop/electron/main.cjs`.
- **Linux build icon source updated**: Electron Builder Linux icon path now points to Emily source art. Location: `package.json`.
- **Icon assets regenerated from Emily source**: Refreshed `icon.png`, `icon-192.png`, `icon-512.png`, `icon.ico`, and `favicon.ico` from `apps/web/public/emily-the-strange.png`. Locations: `apps/web/public/icon.png`, `apps/web/public/icon-192.png`, `apps/web/public/icon-512.png`, `apps/web/public/icon.ico`, `apps/web/public/favicon.ico`.
- **Proxy matcher hardened for static icon/PWA assets**: Excluded `manifest.json`, `sw.js`, and icon files (including Emily) from proxy middleware matching. Location: `apps/web/src/proxy.ts`.

### Removed

- **Obsolete icon placeholder note**: Deleted the temporary icon reminder file now that generated PWA icons are present. Location: `apps/web/public/icon-192.png.txt`.

## [1.0.2] - 2026-02-17

### Added

- **Queue item context menu in desktop right rail**: Added right-click context menu support for `Up Next` items with queue-aware actions (play now, move to next/end, remove from queue). Location: `apps/web/src/components/DesktopRightRail.tsx`.
- **Foreign playlist context menus**: Added context menu entry points for non-owned playlists in:
  - Home feed "Playlists for Your Taste" cards.
  - Public profile playlist cards.
    Locations: `apps/web/src/app/HomePageClient.tsx`, `apps/web/src/app/[userhash]/page.tsx`.

### Changed

- **Playlist context menu context model**: Extended playlist menu context to support owner/foreign modes plus menu options for `openPath`, `shareUrl`, and async track resolution hooks. Location: `apps/web/src/contexts/PlaylistContextMenuContext.tsx`.
- **Playlist menu behavior split by ownership**: `PlaylistContextMenu` now renders owner-only actions only for owned playlists, while foreign playlists expose safe actions (`Play`, `Queue`, `Share`, `Open`) and resolve tracks via provided resolver/public fallback. Location: `apps/web/src/components/PlaylistContextMenu.tsx`.

## [1.0.1] - 2026-02-17

### Added

- **Resizable desktop sidebar**: Added horizontal drag resizing with persisted expanded width to improve desktop layout control and cross-session consistency. Locations: `apps/web/src/components/DesktopSidebar.tsx`, `packages/config/src/storage.ts`.
- **Five new Firefox-friendly FlowField visuals**: Added `scanGrid`, `pulseColumns`, `radarSweep`, `cometTrails`, and `phaseBands` as new selectable patterns designed for low-overhead rendering and stable frame pacing. Locations: `packages/visualizers/src/FlowFieldRenderer.ts`, `packages/visualizers/src/flowfieldPatterns/patternIds.ts`, `packages/visualizers/src/FlowFieldCanvas.tsx`.

### Changed

- **Sidebar naming for cross-platform use**: Renamed the sidebar component from `ElectronSidebar` to `DesktopSidebar` to better reflect usage across desktop web, PWA, and Electron shells. Locations: `apps/web/src/components/DesktopShell.tsx`, `apps/web/src/components/DesktopSidebar.tsx`.
- **OAuth provider selection/styling consolidation**: Sign-in surfaces now use shared OAuth provider guards and style helpers, reducing duplicated provider filtering logic and improving type safety. Locations: `apps/web/src/config/oauthProviders.ts`, `apps/web/src/app/signin/page.tsx`, `apps/web/src/components/AuthModal.tsx`.
- **FlowField renderer pattern registry update**: Extended typed pattern unions, renderer switch routing, and runtime pattern validation to include the new visuals while preserving DRY/KISS structure and strict pattern typing. Locations: `packages/visualizers/src/flowfieldPatterns/patternIds.ts`, `packages/visualizers/src/FlowFieldRenderer.ts`, `packages/visualizers/src/FlowFieldCanvas.tsx`.

### Removed

- **Monorepo migration compatibility wrappers**: Deleted 22 single-line re-export shim files left over from the monorepo migration (across `apps/web/src/types/`, `contexts/`, `hooks/`, `trpc/`, `utils/`, `config/`, `components/`, and `components/visualizers/`). All consumers now import directly from `@starchild/*` packages.

### Fixed

- **`apiRequest` return type bug** (`apps/web/src/services/smartQueue.ts`): `response.json()` was cast to `Promise<T>` despite already being awaited — corrected to `as T`.
- **Unsafe `headers` spread** (`apps/web/src/services/smartQueue.ts`): Replaced `...(options.headers as Record<string, string>)` with `new Headers(options.headers).forEach(...)` to handle all three `HeadersInit` variants correctly without an unsafe cast.
- **Vercel function pattern deployment failure**: Removed unmatched `functions` path globs from `vercel.json` and moved execution time limits to route-level `maxDuration` exports for Next.js App Router handlers. Locations: `vercel.json`, `apps/web/src/app/api/stream/route.ts`, `apps/web/src/app/api/trpc/[trpc]/route.ts`.

### Refactored

- **Drizzle schema jsonb column types** (`apps/web/src/server/db/schema.ts`): Added `.$type<T>()` to all previously untyped `jsonb()` columns (`trackData`, `currentTrack`, `queue`, `history`, `originalQueueOrder`, `recommendedTrackIds`, `recommendedTracksData`, `seedTrackIds`, `seedTrackData`, `requestParams`). Columns now carry their actual TypeScript types (`Track`, `Track[]`, `number[]`, etc.) instead of defaulting to `Record<string, unknown>`.
- **Eliminated 11 unsafe DB insert casts** (`apps/web/src/server/api/routers/music.ts`): All `as unknown as Record<string, unknown>` casts on `trackData`, `queue`, `history`, `currentTrack`, `originalQueueOrder`, `recommendedTrackIds`, `recommendedTracksData`, `seedTrackData`, and `requestParams` columns removed — now that the schema carries the correct types, values can be passed directly.
- **DRY search URL building** (`packages/api-client/src/rest.ts`): Extracted private `fetchMusicSearch` helper shared by `searchTracks` and `searchTracksByArtist`, removing duplicated URL construction, fetch, and error-handling logic.

## [1.0.0] - 2026-02-16

### Added

- **Monorepo workspace orchestration (PR1)**: Added `pnpm-workspace.yaml` and `turbo.json`, plus app/package workspace manifests so web, desktop, mobile, and shared packages can be built and checked as coordinated workspaces.
- **App runtime separation (PR2/PR3/PR5)**: Introduced clear runtime boundaries under `apps/web`, `apps/desktop`, and `apps/mobile`, including dedicated READMEs and app-level package manifests.
- **Shared package surface (PR4)**: Established first-class shared libraries under `packages/*` for:
  - `@starchild/types`
  - `@starchild/config`
  - `@starchild/auth`
  - `@starchild/api-client`
  - `@starchild/player-core`
  - `@starchild/player-react`
  - `@starchild/audio-adapters`
  - `@starchild/visualizers`
  - `@starchild/ui`
- **Typed tRPC router registry for cross-app consumption (PR4)**: Added package-level router typing hooks (`@starchild/api-client/trpc/router`) and server helper factory wiring to remove hard package dependency on web-internal router file paths.
- **Mobile shell scaffold (PR5)**: Added typed mobile shell entrypoint and package alias wiring to validate shared package compatibility without introducing React Native runtime yet.

### Changed

- **Repository architecture (PR1-PR5)**: Transitioned from a single-root app layout to an apps+packages monorepo with a stable target shape documented in `docs/monorepo/MIGRATION_PLAN.md`.
- **Web app home moved to workspace (PR2)**: Next.js App Router runtime, public assets, Drizzle config/migrations, and web server wiring are now centered in `apps/web/*`.
- **Electron runtime moved to workspace (PR3)**: Electron main/preload/build pipeline and packaging helpers moved into `apps/desktop/*` and root Electron scripts were updated accordingly.
- **Command topology stabilized across root + workspaces (PR1/PR2/PR3)**:
  - Root scripts remain compatibility entrypoints.
  - App-scoped scripts are now available via `npm --prefix apps/<app> ...`.
  - Workspace scripts were added (`ws:*`) for Turbo-driven multi-package operations.
- **Import and alias strategy standardized (PR4)**: Large-scale migration from deep relative and app-local imports to package imports (`@starchild/*`) across web runtime, tests, and shared code.
- **Audio stack modularization (PR4)**:
  - `audioContextManager` moved from web app internals into `@starchild/audio-adapters`.
  - Player and visualizer consumers now import audio adapter utilities via package exports.
- **Auth package decoupling (PR4)**:
  - Spotify provider creation now receives explicit config from caller.
  - Package-level auth helpers no longer depend directly on web app env module paths.
- **Player package decoupling (PR4)**:
  - Added package-local storage/logger/media-query utilities in `@starchild/player-react`.
  - Provider-to-toast bridging introduced to avoid direct dependency on web toast context internals.
- **UI package decoupling (PR4)**:
  - Introduced package-local UI utilities (`cn`, haptics, spring presets) and exported them through `@starchild/ui`.
  - Added shared `SkeletonGrid` export and removed UI package dependence on web-only component paths.
- **API client boundary hardening (PR4 finish)**:
  - Replaced direct `apps/web/src/server/api/*` imports from `@starchild/api-client`.
  - Introduced app-provided router typing via module augmentation.

### Migration PR Breakdown

- **PR1 - Workspace bootstrap**
  - Added workspace/tooling foundation (`pnpm-workspace.yaml`, `turbo.json`).
  - Added workspace package manifests for `apps/*` and `packages/*`.
  - Preserved existing runtime behavior while preparing for physical moves.

- **PR2 - Move web app into `apps/web`**
  - Relocated web runtime and DB migration/config assets into `apps/web`.
  - Updated docs and app mapping references to reflect new runtime home.
  - Kept root-level command compatibility during transition.

- **PR3 - Move Electron into `apps/desktop`**
  - Relocated Electron runtime, preload, signing, verification, and packaging scripts into `apps/desktop`.
  - Updated root package metadata and build hooks to point to `apps/desktop/electron/*`.
  - Preserved desktop build behavior while changing directory ownership.

- **PR4 - Extract and decouple shared packages**
  - Extracted shared concerns into package boundaries and exported stable entrypoints.
  - Migrated broad import surfaces to `@starchild/*` aliases across app/runtime/test code.
  - Removed residual app-internal coupling in shared packages (auth, player-react, audio-adapters, UI, visualizers, api-client).
  - Added typed tRPC router registry pattern so API client package can remain app-agnostic.

- **PR5 - Add mobile app shell**
  - Added `apps/mobile` scaffold with typed entrypoint and package alias wiring.
  - Added mobile scripts (`dev`, `build`, `check`, `typecheck`) focused on compatibility validation.
  - Kept web/desktop production behavior unchanged while enabling future mobile iteration.

### Breaking Changes

- **Path and import topology**: Legacy single-root locations (`src/*`, `electron/*`, `drizzle/*`, and app-internal shared utility paths) are no longer the primary integration points for new code.
- **Shared-code consumption model**: Cross-runtime shared logic should now be consumed from `@starchild/*` packages rather than web app internals.
- **tRPC package typing contract**: `@starchild/api-client` now expects app runtime to provide router typing via `@starchild/api-client/trpc/router` augmentation for strict end-to-end typing.

### Notes

- This release marks the completion of the planned monorepo migration sequence (PR1-PR5) with app/runtime boundaries in place and shared package extraction established as the default development model.

## [0.16.1] - 2026-02-13

### Fixed

- **Spotify OAuth sign-in configuration error path**: Removed client-side manual `redirect_uri` overrides from OAuth initiation flows so Auth.js can generate provider callback parameters consistently, resolving the `error=Configuration` failure during `POST /api/auth/signin/spotify`. Locations: `src/app/signin/page.tsx`, `src/components/AuthModal.tsx`.

### Changed

- **Auth.js logger diagnostics**: Improved NextAuth logger payload keys to preserve readable internal Auth.js identifiers in logs (`authjsErrorId`, `authjsWarningId`, `authjsDebugId`) for faster OAuth failure triage. Location: `src/server/auth/config.ts`.

## [0.16.0] - 2026-02-13

### Added

- **Global keyboard shortcut provider**: Added app-wide media/control shortcuts by introducing a dedicated provider wired into the root layout, so playback/navigation shortcuts are no longer scoped to the player component. Locations: `src/contexts/KeyboardShortcutsProvider.tsx`, `src/app/layout.tsx`, `src/components/Player.tsx`.
- **Visualizer FPS diagnostics toggle**: Added `showFpsCounter` user setting and rendered real-time FPS/frame-time/quality metrics overlay for visualizer debugging. Locations: `src/types/settings.ts`, `src/app/settings/page.tsx`, `src/components/FlowFieldBackground.tsx`, `src/components/visualizers/FlowFieldCanvas.tsx`, `src/components/visualizers/FlowFieldRenderer.ts`.
- **Smart queue recommendation transparency**: Added smart-track metadata UI (sparkles indicator + tooltip) showing seed track, similarity score/method, and recommendation reason for auto-queued tracks. Location: `src/components/EnhancedQueue.tsx`.
- **Sidebar loading skeletons**: Replaced plain playlist loading text with animated skeleton placeholders in the Electron sidebar library section. Location: `src/components/ElectronSidebar.tsx`.

### Changed

- **Keyboard shortcut stability and safety**: Updated shortcut handling to use ref-backed handlers (avoids re-binding listeners on render churn) and ignore modified key combos (`Ctrl`/`Meta`/`Alt`) to reduce accidental interception. Location: `src/hooks/useKeyboardShortcuts.ts`.
- **Visualizer toggle/event plumbing**: Added a dedicated visualizer shortcut event bridge and runtime listener support in the persistent player so shortcut-triggered visualizer toggles work consistently across views. Locations: `src/contexts/KeyboardShortcutsProvider.tsx`, `src/components/PersistentPlayer.tsx`.
- **Settings synchronization eventing**: Settings storage now emits a window event on writes, enabling live synchronization of visualizer FPS preference without reload. Locations: `src/utils/settingsStorage.ts`, `src/components/PersistentPlayer.tsx`.
- **Collapsed sidebar tooltip consistency**: Added/normalized tooltip and accessibility labels for collapsed playlist items and playlist creation controls. Location: `src/components/ElectronSidebar.tsx`.

## [0.15.19] - 2026-02-13

### Added

- **End-to-end OAuth trace logging**: Added structured auth diagnostics that trace OAuth flow step-by-step across request entry, provider redirect, callback handling, and response output with sensitive field redaction. Locations: `src/server/auth/logging.ts`, `src/app/api/auth/[...nextauth]/route.ts`.
- **Client-side OAuth debug instrumentation**: Added optional browser-side auth logging for provider discovery, redirect URI computation, and sign-in initiation from both `/signin` and auth modal flows. Locations: `src/utils/authDebugClient.ts`, `src/app/signin/page.tsx`, `src/components/AuthModal.tsx`, `src/utils/getOAuthRedirectUri.ts`.
- **OAuth debug feature flags**: Added `AUTH_DEBUG_OAUTH` (server) and `NEXT_PUBLIC_AUTH_DEBUG_OAUTH` (client) to env validation and examples for controlled debug logging in production-like environments. Locations: `src/env.js`, `.env.example`.

### Changed

- **NextAuth observability and lifecycle logging**: Expanded auth configuration logging to include startup config validation, provider enablement decisions, callback decisions (`signIn`, `session`, `redirect`), auth events (`signIn`, `linkAccount`, `createUser`, `signOut`), and internal Auth.js logger hooks. Location: `src/server/auth/config.ts`.
- **Spotify provider diagnostics**: Improved provider initialization logs to explicitly state why Spotify auth is enabled/disabled (feature flag and credential presence), reducing ambiguity during rollout and incident debugging. Location: `src/server/auth/spotifyProvider.ts`.
- **Auth route diagnostics hardening**: Route wrapper now logs parsed auth action/provider context, request origin inference, callback query signal metadata (`state` hash, `code` length), and cookie name summaries without exposing raw cookie/token values. Location: `src/app/api/auth/[...nextauth]/route.ts`.
- **OAuth env template completeness**: Updated `.env.example` to include missing `AUTH_SPOTIFY_ENABLED` and new OAuth debug toggles so server/client feature gating remains explicit and aligned.

### Fixed

- **Spotify OAuth server/client flag mismatch visibility**: Added explicit warning path when `NEXT_PUBLIC_AUTH_SPOTIFY_ENABLED=true` but `AUTH_SPOTIFY_ENABLED=false`, which could expose Spotify in UI fallback paths while server-side provider remained disabled. Location: `src/server/auth/config.ts`.

## [0.15.18] - 2026-02-12

### Added

- **GitHub Actions security documentation**: Added comprehensive security policy documentation at `.github/SECURITY.md` explaining secret management, Docker build arg security trade-offs, mitigation strategies, and emergency response procedures.

### Changed

- **Environment variable cleanup (infrastructure)**: Streamlined environment variables to only essential secrets, removing redundant legacy database configuration variables. Locations: `.github/workflows/docker-build.yml`, `Dockerfile`, `.env.example`.
  - **Removed redundant DB\_\* variables**: Eliminated `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_ADMIN_USER`, `DB_ADMIN_PASSWORD` from all configurations (workflow, Dockerfile, env example). These were legacy fallbacks for drizzle-kit that are unnecessary when `DATABASE_URL` is always provided.
  - **Simplified Dockerfile build args**: Reduced from 17 ARG declarations to 9 essential variables (`DATABASE_URL`, `AUTH_SECRET`, `AUTH_DISCORD_ID`, `AUTH_DISCORD_SECRET`, `BLUESIX_API_KEY`, `API_V2_URL`, `NEXTAUTH_URL`, `NODE_ENV`, `SKIP_ENV_VALIDATION`).
  - **Cleaned up .env.example**: Removed all redundant variables including `NEXT_PUBLIC_NEXTAUTH_URL`, `NEXT_PUBLIC_NEXTAUTH_VERCEL_URL`, `NEXT_PUBLIC_NEXTAUTH_URL_CUSTOM_SERVER`, `DATABASE_UNPOOLED`, and `API_V2_HEALTH_URL`. Added clear section comments explaining each variable's purpose.
  - **Updated GitHub Actions workflow**: Removed 5 redundant secret references from both test and production build steps, reducing secret exposure surface and improving clarity.

- **GitHub Actions Docker workflow**: Updated to pass essential application secrets as build arguments (required for Next.js build process). While this creates a security trade-off (secrets visible in Docker layer metadata via `docker history`), mitigations are in place: test builds remain local to CI runner, production images should not be inspected, and all secrets are rotatable. Location: `.github/workflows/docker-build.yml`.

### Fixed

- **CI/CD build process**: Fixed GitHub Actions Docker builds that were failing due to missing environment variables during Next.js build step. Now correctly passes all required secrets (`DATABASE_URL`, `AUTH_SECRET`, OAuth credentials, API keys) as build arguments.

## [0.15.17] - 2026-02-12

### Changed

- **Visualizer Firefox performance optimizations (gradient elimination)**: Eliminated gradient creation in three of the most performance-intensive visualizer patterns, achieving massive Firefox performance improvements. Location: `src/components/visualizers/FlowFieldRenderer.ts`.
  - **Fluid**: Eliminated 500-3,600 gradient creations per frame by removing all `createLinearGradient()` calls and batching flow field lines into 6 hue-based paths (600x reduction in operations). Increased grid size from 24 to 36 for additional performance gain.
  - **Starfield**: Eliminated 200-500 radial gradients per frame by removing all `createRadialGradient()` calls, using simple `fillStyle` instead. Reduced visible stars via stride (every 2nd-3rd star) and minimized trail rendering to every 4th star only when `bassIntensity > 0.5`.
  - **Constellation**: Eliminated 70-120 gradients per frame (50-100 linear + 20 radial) by batching all connection lines into a single path with one stroke operation, and using simple fills for stars instead of radial gradients.
- **Visualizer Firefox performance optimizations (high-cost dark set)**: Hyper-optimized the five heaviest dark-mode visualizers with adaptive detail scaling, reduced shadow churn, lower path density, and selective gradient fallback. Location: `src/components/visualizers/FlowFieldRenderer.ts`.
  - **Abyssal Depth**: Removed redundant per-layer rotations, reduced layer/creature gradient pressure with low-detail flat-fill fallbacks, simplified creature glow/trails, and scaled counts by adaptive detail.
  - **Demonic Gate**: Reused a single `Path2D` gate outline for fill/stroke, batched tendril strokes, reduced vortex/entity/sigil complexity on low detail, and switched pillars/core to conditional gradient use.
  - **Shadow Dance**: Batched the dancer net into one path, cached dancer polar results per frame, replaced trail arcs with rect fills, reduced per-dancer shadow state flips, and lowered wisp/ring complexity in low detail.
  - **Spectral Echo**: Reduced ring segment density and layer cadence adaptively, converted inner orbit particles to rect fills, batched beam and core segment strokes, and added low-detail center source fill fallback.
  - **Twilight Zone**: Added adaptive zone/particle scaling, removed per-zone save/restore rotation overhead, batched tear strokes, converted wisps to grouped rect fills, and introduced low-detail core rendering fallback.

## [0.15.16] - 2026-02-12

### Added

- **Automatic canvas state reset**: Implemented periodic deep canvas cleanup every 10 visualizer pattern switches to prevent performance degradation from accumulated canvas state. The reset clears transforms, shadows, filters, gradients, paths, and the HSL color cache. Location: `src/components/visualizers/FlowFieldRenderer.ts`.

### Changed

- **Canvas context management**: Added `patternsSinceReset` counter to track pattern switches and trigger `resetCanvasState()` method every 10 patterns, preventing memory pollution and canvas state accumulation that caused slowdowns over extended playback sessions.

## [0.15.15] - 2026-02-12

### Changed

- **Visualizer Firefox performance optimizations**: Dramatically improved Firefox canvas rendering performance for multiple visualizer patterns by reducing shadow operations, batching path operations, and optimizing rendering techniques. Location: `src/components/visualizers/FlowFieldRenderer.ts`.
  - **Ancient Sigil (necromanticSigil)**: Reduced from ~36 to 3 stroke/fill calls per frame by batching all inner line segments into a single path, reducing shadow blur from 35px to 20px, and lowering shadow alpha values.
  - **Dimensional Rift**: Halved shadow operations from 12 to 6 by applying shadows only to alternating rifts, reduced shadow blur from 40px to 25px, and lowered shadow alpha from 0.9 to 0.6.
  - **Fireworks**: Switched from `arc()` to `fillRect()` for particle rendering (3-4x faster in Firefox) and removed expensive per-particle path operations for 50-150 particles per frame.
  - **Dusk Realm (shadowRealm)**: Reduced shadow operations by 70% (from ~23 to 7 per frame) by applying shadows only to every 3rd layer, reducing shadow blur from 25px to 15px for layers and 35px to 20px for center void, and removing shadowed accent fills entirely.
  - **Mystic Ceremony (forbiddenRitual)**: Reduced from 200+ to ~60 operations per frame by cutting rune count from 40-70 to 20-35, removing all 140 individual shadowed symbol arcs, eliminating pentagrams and flame particles, batching spike lines into single path, reducing wisps from 12-18 to 8-12 using fillRect, and simplifying center from 4 gradients to 1.
  - **Crystal Grid**: Reduced from 36 to 16 crystals (56% reduction) and eliminated all 36 per-frame radial gradient creations, batched internal hexagon lines into single path per crystal, and removed connection lines with setLineDash overhead.
  - **EM Field (emField)**: Reduced from up to 7,200 individual shadowed stroke calls to ~20 operations per frame by removing entire physics simulation, replacing with 16 simple curved field lines (no per-segment shadows), simplifying particles from 25-45 to 12 using fillRect, eliminating gradient trails, and removing contour and wave rings.

## [0.15.14] - 2026-02-12

### Added

- **Linux custom titlebar**: Added frameless window with custom titlebar for Linux Electron builds featuring centered app version display, dynamic track info when playing, full draggable area, and theme-matched window controls. Location: `src/components/LinuxTitlebar.tsx`.
- **AudioPlayerContext export**: Exported `AudioPlayerContext` for direct context access in components outside the provider tree. Location: `src/contexts/AudioPlayerContext.tsx`.

### Changed

- **Linux Electron window configuration**: Switched from native frame to frameless window (`frame: false`) on Linux platform. Location: `electron/main.cjs`.
- **Loopback host resolution**: Updated to consistently use `localhost` for all Electron builds (dev and production) to ensure OAuth callback compatibility with Discord and other providers. Location: `electron/main.cjs`.
- **Header search bar layout**: Improved search bar centering (both vertical and horizontal), increased width to 90% of container, and added proper spacing below Linux titlebar. Location: `src/components/Header.tsx`.
- **Platform-specific spacing**: Added 36px top padding to `DesktopShell` and 44px top offset to `Header` on Linux Electron to accommodate custom titlebar. Locations: `src/components/DesktopShell.tsx`, `src/components/Header.tsx`.

### Fixed

- **OAuth PKCE verification errors**: Fixed `pkceCodeVerifier value could not be parsed` errors in packaged Linux builds by ensuring consistent loopback hostname across OAuth flow.
- **Component hydration timing**: Resolved state initialization issues in dev mode by implementing proper useEffect hooks for platform detection.
- **Header obscured by titlebar**: Fixed Linux titlebar covering search header by adding conditional top offset based on platform detection.

## [0.15.13] - 2026-02-11

### Changed

- **Standalone prep module alias handling**: Electron package preparation now materializes symlinked Turbopack module aliases under `.next/standalone/.next/node_modules` into real directories/files before packaging. Location: `electron/prepare-package.js`.
- **After-pack alias hardening**: Electron `afterPack` now also materializes any remaining symlinked module aliases in the packaged standalone output and validates required `pg-*` aliases referenced by Turbopack runtime chunks. Location: `electron/builder/afterPack.cjs`.

### Fixed

- **Linux AppImage auth runtime regression**: Fixed packaged Linux/Electron OAuth flows (`/api/auth/*`) failing with `Internal Server Error` caused by unresolved `pg-<hash>` module aliases in AppImage runtime mounts. Locations: `electron/prepare-package.js`, `electron/builder/afterPack.cjs`.

## [0.15.12] - 2026-02-11

### Added

- **Spotify auth readiness module**: Added a dedicated Spotify provider factory with resilient OAuth response normalization/retry handling so Spotify login can be enabled safely when required. Location: `src/server/auth/spotifyProvider.ts`.
- **Centralized OAuth provider config**: Added a shared provider config layer for enabled OAuth IDs and provider button styles to keep sign-in surfaces consistent. Location: `src/config/oauthProviders.ts`.
- **Explicit Spotify feature flags**: Added `AUTH_SPOTIFY_ENABLED` (server) and `NEXT_PUBLIC_AUTH_SPOTIFY_ENABLED` (client) to env validation and templates for controlled rollout. Locations: `src/env.js`, `.env.example`, `README.md`.

### Changed

- **Auth provider wiring**: Reintroduced Spotify in NextAuth as an opt-in provider behind `AUTH_SPOTIFY_ENABLED` plus credential checks, with warning logs for server/client flag mismatch. Location: `src/server/auth/config.ts`.
- **Sign-in provider discovery fallback**: Updated fallback provider generation to derive from enabled provider config (no hardcoded provider IDs), preventing stale UI options after env changes. Location: `src/utils/authProvidersFallback.ts`.
- **OAuth UI behavior**: Updated `/signin` and `AuthModal` to filter and style providers via shared enabled-provider config, supporting a clean Discord-only baseline and Spotify-ready expansion. Locations: `src/app/signin/page.tsx`, `src/components/AuthModal.tsx`.
- **Electron OAuth navigation**: Extended in-app OAuth allowlist to include Spotify host navigation so callback cookies stay within Electron session context. Location: `electron/main.cjs`.
- **Build helper command resolution**: Updated env build runner to prepend local `node_modules/.bin` into `PATH`, preventing `electron-builder` command resolution failures outside npm script context. Location: `scripts/load-env-build.js`.

### Fixed

- **Packaged app static asset integrity**: Added after-pack verification for `.next/static` alongside standalone server/node_modules to fail fast on broken Linux/Electron artifacts that would otherwise render without CSS/assets. Location: `electron/builder/afterPack.cjs`.
- **Auth handler diagnostics**: Added explicit GET/POST handler error logging in NextAuth route wrapper to surface root causes during OAuth callback failures in Electron/prod-style runs. Location: `src/app/api/auth/[...nextauth]/route.ts`.

## [0.15.11] - 2026-02-11

### Added

- **New API V2 proxy surface**: Added Next.js proxy routes for upstream diagnostics, auth/session metadata, config, rate limits, cache operations, stream capabilities, track metadata, and metrics. Locations: `src/app/api/v2/_lib.ts` and `src/app/api/v2/**/route.ts`.
- **Admin diagnostics panel**: Added an API diagnostics section to the Admin page with periodic probes, manual refresh, upstream auth refresh action, cache clear action, and quick links for OpenAPI + metrics. Location: `src/app/admin/page.tsx`.
- **Proxy route coverage tests**: Added tests for new V2 route mappings, admin-only protections, and track metadata id validation. Location: `src/__tests__/api-v2-status-routes.test.ts`.

### Changed

- **Header health polling strategy**: Updated health badge checks to use `/api/v2/status` first with fallback to `/api/v2/health` for compatibility during upstream rollout. Location: `src/components/Header.tsx`.
- **Health status normalization**: Extended parser support for additional upstream formats (`status: "up"` and `{ ok: boolean }`). Location: `src/utils/healthStatus.ts`, `src/__tests__/health-status.test.ts`.
- **API route documentation**: Expanded route map docs to include all new V2 proxy endpoints and admin-session requirements for sensitive routes. Location: `docs/API_ROUTE_USE.md`.

## [0.15.10] - 2026-02-11

### Added

- **Discover playlist proxy route**: Added `GET /api/playlist/[id]` to proxy upstream playlist-track payloads from `API_V2_URL/api/music/playlists/{id}` for frontend consumption. Location: `src/app/api/playlist/[id]/route.ts`.
- **Discover playlist detail page**: Added a new playback-ready page for discovered playlists that fetches and validates upstream track arrays, then supports play-all/shuffle and queue integration. Location: `src/app/discover/playlists/[id]/page.tsx`.

### Changed

- **Taste playlist card navigation**: Updated “Playlists for Your Taste” cards to open discovered playlist detail routes instead of running title-based search fallback. Location: `src/app/HomePageClient.tsx`.
- **API route map docs**: Documented the new `/api/playlist/[id]` proxy route in the API route usage reference. Location: `docs/API_ROUTE_USE.md`.

## [0.15.9] - 2026-02-11

### Added

- **Server-side taste inference pipeline**: Introduced weighted taste profiling from listening analytics, favorites, search behavior, and playlist context with recency/engagement scoring, genre alias normalization, and cached genre catalog matching for stronger personalization signals. Location: `src/server/api/routers/music.ts`.

### Changed

- **Taste profile API behavior**: `getTasteProfile` now returns a merged profile (stored + inferred) with confidence-aware genre selection and richer seed generation; `upsertTasteProfile` now merges incoming seeds with existing seeds instead of replacing them, improving long-term profile stability. Location: `src/server/api/routers/music.ts`.
- **Desktop sidebar signed-out UX**: Reordered signed-out navigation to surface sign-in first, added prominent sign-in call-to-action blocks, replaced empty library state with guidance, and hid bottom authenticated actions for guests. Location: `src/components/ElectronSidebar.tsx`.
- **Sidebar bottom action positioning**: Anchored sidebar actions to the bottom and introduced configurable bottom spacing via `--electron-sidebar-bottom-padding` for consistent layout tuning. Locations: `src/components/ElectronSidebar.tsx`, `src/styles/globals.css`.

## [0.15.8] - 2026-02-10

### Added

- **Queue item context menu**: Implemented full queue-aware context actions (play from queue, move to next/end, remove) while keeping standard track actions available on queued tracks. Locations: `src/components/EnhancedQueue.tsx`, `src/components/TrackContextMenu.tsx`, `src/contexts/TrackContextMenuContext.tsx`.

## [0.15.4] - 2026-02-09

### Added

- **Start-page taste profile persistence**: Added a dedicated user taste profile data model with migration support to persist preferred genre and playlist/artist seed signals for signed-in users. Locations: `src/server/db/schema.ts`, `drizzle/0022_startpage_taste_profile.sql`, `drizzle/meta/_journal.json`.
- **Taste profile API methods**: Added protected tRPC endpoints to read and upsert taste profile data used by home personalization. Location: `src/server/api/routers/music.ts`.

### Changed

- **Personalized playlist section on Home**: Added a new “Playlists for Your Taste” block on the start page and wired it to discovery data filtered by user taste signals. Location: `src/app/HomePageClient.tsx`.
- **Cross-device taste sync**: Home now syncs saved genre preference and observed taste seeds into the server profile so playlist personalization remains consistent across sessions/devices. Location: `src/app/HomePageClient.tsx`.

## [0.15.3] - 2026-02-09

### Fixed

- **Discovery proxy/spec alignment**: Updated discovery proxy forwarding paths and request bounds to match the current upstream music API contract for releases, popular playlists, genre playlists, and genre taxonomy. Locations: `src/app/api/music/releases/latest/route.ts`, `src/app/api/music/playlists/popular/route.ts`, `src/app/api/music/playlists/by-genre/route.ts`, `src/app/api/music/playlists/by-genre-id/route.ts`, `src/app/api/music/genres/route.ts`.
- **Track conversion endpoint alignment**: Updated server-side conversion calls to the current upstream track conversion path under the shared music namespace. Location: `src/server/api/routers/music.ts`.

### Changed

- **Client discovery helper bounds**: Normalized helper defaults/max limits to the current upstream contract and removed unsupported query parameters from genre-list requests (local slicing is now applied client-side). Location: `src/utils/api.ts`.
- **Home feed query sizing**: Updated start-page discovery fetch sizes to stay within upstream discovery endpoint bounds while retaining personalized feed behavior. Location: `src/app/HomePageClient.tsx`.
- **OpenAPI source reference**: Pointed route-usage docs at `docs/API_V2_SWAGGER.json` as the active upstream schema reference. Location: `docs/API_ROUTE_USE.md`.

## [0.15.2] - 2026-02-09

### Added

- **Provider-agnostic discovery proxy routes**: Added new discovery endpoints for latest releases, popular playlists, playlist discovery by genre id/name, and genre taxonomy under the shared music API namespace. Locations: `src/app/api/music/releases/latest/route.ts`, `src/app/api/music/playlists/popular/route.ts`, `src/app/api/music/playlists/by-genre-id/route.ts`, `src/app/api/music/playlists/by-genre/route.ts`, `src/app/api/music/genres/route.ts`, `src/app/api/music/_lib.ts`.
- **Start-page taste preference storage**: Added persisted genre preference keys used by onboarding and home feed personalization. Location: `src/config/storage.ts`.

### Changed

- **Home feed relevance and freshness**: Reworked home feed row generation to use live discovery sources (latest releases + curated playlists) and bias results with saved user genre preference for more engaging start-page content. Location: `src/app/HomePageClient.tsx`.
- **Sign-in personalization step**: Enhanced the sign-in page with a pre-login genre selector that stores user preference for immediate homepage personalization after authentication (or later as guest). Location: `src/app/signin/page.tsx`.
- **Client discovery helpers**: Added typed frontend helpers for discovery feeds and switched app-side calls to the new generic route surface. Location: `src/utils/api.ts`.
- **API route documentation**: Updated route mapping docs to include the new `/api/music/*` endpoints. Location: `docs/API_ROUTE_USE.md`.

## [0.15.1] - 2026-02-09

### Added

- **Cookie consent banner**: Implemented a minimalistic, non-intrusive cookie consent banner that informs users about functional cookies. The banner appears once on first visit, stores consent in localStorage, and features a clean design that matches the app's aesthetic. Only functional cookies are used, which are essential for site operation. Locations: [src/components/CookieConsent.tsx](src/components/CookieConsent.tsx), [src/app/layout.tsx](src/app/layout.tsx).

## [0.15.0] - 2026-02-09

### Fixed

- **OAuth PKCE authentication failure for new users**: Resolved critical "code_verifier was incorrect" error that blocked new user registration via Spotify and Discord OAuth on both Vercel and self-hosted deployments. The issue was caused by explicit cookie configuration that prevented Auth.js from creating necessary PKCE state cookies (`pkceCodeVerifier`, `state`, `nonce`). Removed custom cookie configuration to allow Auth.js to use its built-in defaults which properly handle all OAuth state management. Location: [src/server/auth/config.ts:193-230](src/server/auth/config.ts).

### Changed

- **Auth environment validation enhancement**: Added `AUTH_TRUST_HOST` environment variable to the Zod validation schema with proper boolean transformation. While `trustHost: true` was already set in the auth config, the environment variable is now properly validated and can be explicitly configured. Location: [src/env.js:11-14,43](src/env.js).

### Technical Details

This release fixes a critical OAuth authentication bug that manifested as:

```
CallbackRouteError: r_: server responded with an error in the response body
[auth][details]: {
  "error": "invalid_grant",
  "error_description": "code_verifier was incorrect",
  "provider": "spotify"
}
```

**Root Cause**: The custom cookie configuration (sessionToken, csrfToken, callbackUrl) inadvertently prevented Auth.js from creating the required PKCE cookies needed for the OAuth 2.0 authorization code flow with PKCE (Proof Key for Code Exchange).

**Impact**: New users attempting to sign up via Spotify or Discord OAuth would encounter a "Server error - There is a problem with the server configuration" message during the callback phase, effectively blocking all new user registrations.

**Resolution**: By removing the explicit cookie configuration and allowing Auth.js to use its default cookie handling, all necessary OAuth state cookies are now properly created and managed with appropriate security settings for both development and production environments.

## [0.14.9] - 2026-02-08

### Fixed

- **Lint remediation for tests and hooks**: Typed the search, toast, TRPC, and audio-player stability specs, added the shared `renderPlayerHook`, and started calling the typed `api.music.addToPlaylist` helper so ESLint no-unsafe rules now pass cleanly. Locations: `src/__tests__/api-search-v2.test.ts`, `src/__tests__/Toast.test.tsx`, `src/__tests__/trpc.music.test.ts`, `src/__tests__/useAudioPlayer.stability.test.ts`, `src/components/PlaylistContextMenu.tsx`.
- **Track metadata safety**: Ensured the `/track/[id]/page` data fetching narrows Bluesix/Starchild responses before returning a `Track`, so runtime errors stop surfacing as unsafe assignments. Location: `src/app/track/[id]/page.tsx`.
- **Visualization and config housekeeping**: Declared `twoPi` inside `FlowFieldRenderer`’s cloverleaf helper and added `vitest/globals` to `tsconfig.json` so the lint and test tooling stay aligned. Locations: `src/components/visualizers/FlowFieldRenderer.ts`, `tsconfig.json`.
- **Desktop greeting update**: Sidebar branding now greets signed-in users by `Hi <username>` (falling back to email, username, or “Hi there” when absent). Location: `src/components/ElectronSidebar.tsx`.

## [0.14.8] - 2026-02-08

### Added

- **Admin user removal action**: Added a `Remove user` control in the Admin Panel with confirmation and refresh flow so admins can delete user accounts without using bans. Location: [src/app/admin/page.tsx](src/app/admin/page.tsx).
- **Admin-side remove user API**: Added `admin.removeUser` tRPC mutation with guarded account deletion and related cleanup for non-cascade relations (`sessions`, `accounts`, `posts`). Location: [src/server/api/routers/admin.ts](src/server/api/routers/admin.ts).

### Changed

- **First-admin authority enforcement**: Restricts demoting admin users, banning/unbanning admin users, and removing admin users to the `firstAdmin` role only (enforced server-side, mirrored in UI disabled states/tooltips). Locations: [src/server/api/routers/admin.ts](src/server/api/routers/admin.ts), [src/app/admin/page.tsx](src/app/admin/page.tsx).
- **Docker CI env handling**: Updated Docker workflow compose validation to ignore `.env` value checks and validate compose config without secret substitution. Location: [.github/workflows/docker-build.yml](.github/workflows/docker-build.yml).

### Fixed

- **MobileHeader tests**: Typed the `framer-motion` mock and navigation helpers so RTL assertions use concrete call data, eliminating `@typescript-eslint/no-unsafe-*` errors and allowing the suite to pass lint. Location: `src/__tests__/MobileHeader.test.tsx`.

## [0.14.7] - 2026-02-08

### Fixed

- **Performance utilities SSR safety**: Guarded performance helpers to avoid `window` access in SSR/tests by using `globalThis.performance` with feature checks. Location: [src/utils/performance.ts](src/utils/performance.ts).
- **Settings volume slider stability**: Normalized persisted volume values and clamped invalid inputs to prevent slider jumps and out-of-range state. Location: [src/hooks/useAudioPlayer.ts](src/hooks/useAudioPlayer.ts).
- **Bottom sheet flick snapping**: Velocity-based snapping now steps from the drag end snap target to avoid unexpected direction changes near midpoints. Location: [src/components/BottomSheet.tsx](src/components/BottomSheet.tsx).
- **Health check IP parsing**: Treated empty `x-forwarded-for` values as missing so fallbacks apply correctly. Location: [src/app/api/health/route.ts](src/app/api/health/route.ts).
- **Null settings persistence**: Restored undefined-only fallback behavior to keep explicit `null` values intact. Location: [src/utils/settingsStorage.ts](src/utils/settingsStorage.ts).
- **SmartQueue seed filtering**: Trimmed empty/whitespace-only seed values before sending recommendations. Location: [src/services/smartQueue.ts](src/services/smartQueue.ts).

### Changed

- **Swipe gesture API compatibility**: Preserved `swipeState` snapshot while adding `swipeStateRef` and `getSwipeState` accessors. Location: [src/hooks/useSwipeGesture.ts](src/hooks/useSwipeGesture.ts).
- **Media query hook resync**: Re-applies the current match state on subscription to handle query changes immediately. Location: [src/hooks/useMediaQuery.ts](src/hooks/useMediaQuery.ts).
- **Repeat mode coercion**: Sanitized persisted `repeatMode` to the allowed union with a safe fallback. Location: [src/contexts/AudioPlayerContext.tsx](src/contexts/AudioPlayerContext.tsx).
- **Electron detection**: Added a lightweight `useIsElectron` hook and used it for dynamic title behavior. Locations: [src/hooks/useIsElectron.ts](src/hooks/useIsElectron.ts), [src/components/DynamicTitle.tsx](src/components/DynamicTitle.tsx).
- **Floating action button hydration**: Clarified `useSyncExternalStore` subscription semantics to avoid confusion in SSR/client checks. Location: [src/components/FloatingActionButton.tsx](src/components/FloatingActionButton.tsx).
- **Queue state typing**: Tightened queue state normalization to use `Track | null` instead of `unknown`. Location: [src/server/api/routers/music.ts](src/server/api/routers/music.ts).

### Chore

- **Electron build logging**: Reinstated a targeted `no-console` lint disable for the afterPack hook. Location: [electron/builder/afterPack.cjs](electron/builder/afterPack.cjs).
- **Error boundary tests**: Removed unused variables/disable directives and tightened `onError` typing. Location: [src/**tests**/ErrorBoundary.stability.test.tsx](src/__tests__/ErrorBoundary.stability.test.tsx).

## [0.14.6] - 2026-02-07

### Changed

- **Universal OAuth login popup**: Added a global auth modal system that loads configured OAuth providers dynamically and can be opened from any unauthenticated action without hard-routing first. Locations: [src/components/AuthModal.tsx](src/components/AuthModal.tsx), [src/contexts/AuthModalContext.tsx](src/contexts/AuthModalContext.tsx), [src/app/layout.tsx](src/app/layout.tsx).
- **Navigation auth flow unification**: Updated desktop sidebar, hamburger menu, and mobile header/footer/navigation to trigger the auth popup for protected actions instead of sending users to mixed sign-in endpoints. Locations: [src/components/ElectronSidebar.tsx](src/components/ElectronSidebar.tsx), [src/components/HamburgerMenu.tsx](src/components/HamburgerMenu.tsx), [src/components/MobileHeader.tsx](src/components/MobileHeader.tsx), [src/components/MobileFooter.tsx](src/components/MobileFooter.tsx), [src/components/MobileNavigation.tsx](src/components/MobileNavigation.tsx).
- **Playlist modal auth UX**: Create/Add-to-playlist modals now open the same OAuth popup when unauthenticated, keeping behavior consistent with the rest of the app shell. Locations: [src/components/CreatePlaylistModal.tsx](src/components/CreatePlaylistModal.tsx), [src/components/AddToPlaylistModal.tsx](src/components/AddToPlaylistModal.tsx).
- **Sign-in fallback and callback routing**: Standardized remaining sign-in links to the app sign-in page and ensured callback URL passthrough is honored. Locations: [src/app/signin/page.tsx](src/app/signin/page.tsx), [src/app/HomePageClient.tsx](src/app/HomePageClient.tsx), [src/app/admin/page.tsx](src/app/admin/page.tsx), [src/app/playlists/page.tsx](src/app/playlists/page.tsx), [src/app/settings/page.tsx](src/app/settings/page.tsx).

## [0.14.5] - 2026-02-07

### Changed

- **Desktop sidebar action visibility fix**: Added persistent bottom clearance so sidebar actions (including `New playlist`) stay above the fixed desktop player in web, PWA, and Electron shells. Location: [src/components/ElectronSidebar.tsx](src/components/ElectronSidebar.tsx).
- **Desktop right-rail queue controls upgraded**: Enhanced `Up Next` with drag-and-drop reordering, per-track `Play next`, and remove-with-undo recovery to reduce queue-management friction. Location: [src/components/DesktopRightRail.tsx](src/components/DesktopRightRail.tsx).

## [0.14.4] - 2026-02-07

### Changed

- **Home experience upgraded to a real feed**: Added row-based discovery sections on Home (`Continue Listening`, `Recently Played`, `Made for You`, `New Releases`) with direct play/queue behavior from each row. Locations: [src/app/HomePageClient.tsx](src/app/HomePageClient.tsx), [src/components/HomeFeedRow.tsx](src/components/HomeFeedRow.tsx).
- **Search now supports typeahead entity suggestions**: Added shared search suggestions with inline query/artist/album/track results, keyboard navigation on desktop, and tap-first behavior on mobile. Locations: [src/hooks/useSearchSuggestions.ts](src/hooks/useSearchSuggestions.ts), [src/components/SearchSuggestionsList.tsx](src/components/SearchSuggestionsList.tsx), [src/components/Header.tsx](src/components/Header.tsx), [src/components/MobileSearchBar.tsx](src/components/MobileSearchBar.tsx).
- **Persistent desktop right rail added**: Introduced a dedicated desktop rail with `Now Playing`, `Up Next`, and quick queue actions (play/pause, next, shuffle, clear, save queue, smart-add) without opening modal layers. Locations: [src/components/DesktopRightRail.tsx](src/components/DesktopRightRail.tsx), [src/components/DesktopShell.tsx](src/components/DesktopShell.tsx), [src/components/Header.tsx](src/components/Header.tsx).
- **Desktop header simplification**: Removed redundant `Starchild Player` logo/title from the main header and tightened layout around search + nav actions. Location: [src/components/Header.tsx](src/components/Header.tsx).
- **Theme direction corrected**: Rolled back explicit Spotify-like color treatment and restored the original Starchild visual palette while keeping UX improvements. Locations: [src/styles/globals.css](src/styles/globals.css), [src/app/HomePageClient.tsx](src/app/HomePageClient.tsx), [src/components/Header.tsx](src/components/Header.tsx), [src/components/MobileSearchBar.tsx](src/components/MobileSearchBar.tsx), [src/components/ElectronSidebar.tsx](src/components/ElectronSidebar.tsx), [src/components/Player.tsx](src/components/Player.tsx), [src/components/SwipeableTrackCard.tsx](src/components/SwipeableTrackCard.tsx).

## [0.14.3] - 2026-02-07

### Changed

- **Spotify-inspired visual system**: Retuned global dark-mode styling toward a Spotify-like experience (deeper neutrals, green-first accent treatment, updated chrome/panel hierarchy, stronger desktop shell contrast, and consistent control states). Locations: [src/styles/globals.css](src/styles/globals.css), [src/components/DesktopShell.tsx](src/components/DesktopShell.tsx).
- **Desktop header UX refresh**: Restored visible brand identity, upgraded search affordance ("What do you want to play?"), and added compact Home/Library quick-navigation chips with clear active states. Location: [src/components/Header.tsx](src/components/Header.tsx).
- **Desktop sidebar hierarchy improvements**: Refined sidebar spacing, typography, active indicators, and playlist section framing for a clearer music-library mental model (including polished collapsed/expanded behavior). Location: [src/components/ElectronSidebar.tsx](src/components/ElectronSidebar.tsx).
- **Home browse experience update**: Added a desktop discovery hero with contextual greeting/actions, improved search-results header context, and aligned empty-state chips/CTAs with the new accent system. Location: [src/app/HomePageClient.tsx](src/app/HomePageClient.tsx).
- **Desktop browse grid section**: Added a compact two-column "Album Picks" + "Playlist Grid" module on desktop home empty-state to speed up discovery and shortcut navigation into playlists. Location: [src/app/HomePageClient.tsx](src/app/HomePageClient.tsx).
- **Mobile Spotify-style shell pass**: Refined mobile header/search/footer spacing and visual hierarchy (cleaner top search chrome, tighter bottom-tab behavior, stronger active/action affordances) for a more Spotify-like mobile navigation feel. Locations: [src/components/MobileHeader.tsx](src/components/MobileHeader.tsx), [src/components/MobileSearchBar.tsx](src/components/MobileSearchBar.tsx), [src/components/MobileFooter.tsx](src/components/MobileFooter.tsx).
- **Track-row interaction polish**: Converted result cards into denser, hover-led rows with stronger play affordance and cleaner contextual action presentation to better match desktop music-app browsing patterns. Location: [src/components/SwipeableTrackCard.tsx](src/components/SwipeableTrackCard.tsx).
- **Player control styling sync**: Updated desktop player button sizing and active-state styling to align playback controls with the refreshed accent/chrome language. Location: [src/components/Player.tsx](src/components/Player.tsx).
- **Typography update**: Replaced the previous global app font with `Manrope` and wired it into the root CSS variable used by global styles. Location: [src/app/layout.tsx](src/app/layout.tsx).

## [0.14.2] - 2026-02-06

### Changed

- **Desktop web sidebar restoration**: Desktop shell now renders for all non-mobile environments, so the sidebar is visible again in pure web deployment (not only in Electron). Location: [src/components/DesktopShell.tsx](src/components/DesktopShell.tsx).
- **Sidebar navigation priority**: Reordered desktop sidebar items to emphasize core routes first (`Home`, `Library`, `Playlists`, `Profile`) with utility routes afterward (`Admin` when eligible, then `Settings`). Location: [src/components/ElectronSidebar.tsx](src/components/ElectronSidebar.tsx).

## [0.14.1] - 2026-02-06

### Changed

- **Universal desktop shell (non-mobile)**: Applied the sidebar + framed content architecture to all non-mobile layouts (web and Electron), rather than Electron-only. Location: [src/components/DesktopShell.tsx](src/components/DesktopShell.tsx).
- **Global desktop header unification**: Replaced split desktop/Electron header variants with one shared non-mobile header layout (left branding/health, centered global search) for consistent spacing and behavior. Location: [src/components/Header.tsx](src/components/Header.tsx).
- **Desktop spacing sync**: Sidebar width and header height now drive content offsets consistently via CSS variables, preventing crowded/overlapping top layout. Locations: [src/components/ElectronSidebar.tsx](src/components/ElectronSidebar.tsx), [src/styles/globals.css](src/styles/globals.css).
- **Desktop chrome styling generalization**: Promoted key Electron-only desktop chrome rules (surface, scroll regions, search/header sizing) to shared desktop rules while preserving Electron titlebar insets where available. Location: [src/styles/globals.css](src/styles/globals.css).

## [0.13.0] - 2026-02-06

### Changed

- **Auth fail-closed behavior**: NextAuth `signIn` now denies login with `AuthFailed` when critical DB checks cannot complete (ban check and first-admin promotion), instead of allowing sign-in on callback errors. Non-critical Discord profile sync failures are logged and do not block login. Location: [src/server/auth/config.ts](src/server/auth/config.ts).
- **Atomic first-admin promotion**: Replaced race-prone first-user promotion logic with a transaction-based conditional update and lock so only one user can become `firstAdmin` under concurrent sign-ins. Location: [src/server/auth/config.ts](src/server/auth/config.ts).
- **First-admin uniqueness guard**: Added a partial unique index for `firstAdmin = true` in schema and migration to enforce single-first-admin at the database layer. Locations: [src/server/db/schema.ts](src/server/db/schema.ts), [drizzle/0021_unique_first_admin.sql](drizzle/0021_unique_first_admin.sql).

## [0.12.10] - 2026-02-04

### Added

- **docs/ index**: New [docs/README.md](docs/README.md) lists all files under `docs/` as a single entry-point.
- **Architecture doc**: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) covers the full system layout (web + Electron), runtime entry-points, and sequence diagrams for search, streaming, track-metadata (V2 → Starchild fallback), and auth flows.
- **API route map**: [docs/API_ROUTE_USE.md](docs/API_ROUTE_USE.md) tabulates every Next.js route handler — method, source file, upstream target, and required env vars — plus notes on the two Bluesix V2 auth styles (query-string vs header).
- **External-API guide**: [docs/API_USE.md](docs/API_USE.md) documents each upstream service (Bluesix V2, Starchild, Last.fm), what this app uses from each, and how they're configured.
- **Agent entry-point**: [AGENTS.md](AGENTS.md) provides a quick-start for AI coding agents — commands, env-loading rules, project layout, and working conventions.
- **Claude Code guidance**: [CLAUDE.md](CLAUDE.md) documents cross-file architecture that isn't visible from any single file: provider nesting order, the three-layer audio stack, queue-model conventions, tRPC-vs-proxy decision rules, and DB/Electron/test-setup constraints.

### Changed

- **`.env.example` tidied**: Moved `AUTH_SECRET` directly below its generation comment so the file reads top-to-bottom. Location: [.env.example](.env.example).

### Removed

- **`REPOSITORY_OVERVIEW.md` deleted**: Content replaced by the focused docs above (`docs/ARCHITECTURE.md`, `docs/API_ROUTE_USE.md`, `docs/API_USE.md`, `AGENTS.md`).

## [0.12.9] - 2026-02-02

### Changed

- **Env cleanup**: Removed remaining `API_URL` usage and standardized on `API_V2_URL` in env schema, scripts, tests, and docs. Locations: [src/env.js](src/env.js), [scripts/server.js](scripts/server.js), [scripts/test-og-images.sh](scripts/test-og-images.sh), [src/test/setup.ts](src/test/setup.ts), [REPOSITORY_ANALYSIS.md](REPOSITORY_ANALYSIS.md), [REPOSITORY_OVERVIEW.md](REPOSITORY_OVERVIEW.md).
- **Env cleanup**: Dropped `STREAMING_KEY` references from docs since it is no longer used. Location: [CHANGELOG.md](CHANGELOG.md).
- **Smart queue seeding**: Queue-based seeds now exclude smart tracks and pass new spice-up controls (`maxSeeds`, `sampling`, `queueMode`) to honor full-queue influence. Locations: [src/contexts/AudioPlayerContext.tsx](src/contexts/AudioPlayerContext.tsx), [src/hooks/useAudioPlayer.ts](src/hooks/useAudioPlayer.ts), [src/server/api/routers/music.ts](src/server/api/routers/music.ts).

## [0.12.8] - 2026-02-02

### Changed

- **Streaming proxy**: `/api/stream` now targets `/music/stream/direct` for in-memory streaming on Vercel; docs/tests updated. Locations: [src/app/api/stream/route.ts](src/app/api/stream/route.ts), [src/**tests**/api-stream-v2.test.ts](src/__tests__/api-stream-v2.test.ts), [README.md](README.md), [REPOSITORY_OVERVIEW.md](REPOSITORY_OVERVIEW.md).
- **API base URL**: Removed `API_URL` usage in favor of `API_V2_URL` across proxying, OG previews, smart-queue requests, and tests/scripts. Locations: [src/proxy.ts](src/proxy.ts), [src/app/api/og/route.tsx](src/app/api/og/route.tsx), [src/services/smartQueue.ts](src/services/smartQueue.ts), [src/test/setup.ts](src/test/setup.ts), [scripts/server.js](scripts/server.js).
- **Mobile queue scrolling**: Added a dedicated scroll rail and restricted reordering to the handle so swipe scrolling no longer triggers haptic reorders. Location: [src/components/MobilePlayer.tsx](src/components/MobilePlayer.tsx).

## [0.12.7] - 2026-02-02

### Changed

- **Smart Queue recommendations**: Auto-queue now uses the unified spice-up endpoint for broader variety, while manual smart-track actions prefer Spotify-only for faster, more consistent matches. Multi-seed inputs are always sent and queue/history IDs are excluded to reduce repeats. Locations: [src/contexts/AudioPlayerContext.tsx](src/contexts/AudioPlayerContext.tsx), [src/hooks/useAudioPlayer.ts](src/hooks/useAudioPlayer.ts), [src/server/api/routers/music.ts](src/server/api/routers/music.ts), [src/services/smartQueue.ts](src/services/smartQueue.ts).
- **Spice-up integration**: Updated to the new envelope response and new request options (exclude Starchild + Spotify IDs, exclude explicit), resolving Starchild IDs from response metadata when available. Locations: [src/server/api/routers/music.ts](src/server/api/routers/music.ts), [src/services/smartQueue.ts](src/services/smartQueue.ts).

## [0.12.6] - 2026-02-01

### Changed

- **Vercel-only deployment**: Header deployment switcher (server / Vercel icon) commented out; start page "Infrastructure & Architecture" explanation removed. Start page now shows a small disclaimer: "Fully migrated to Vercel". Locations: [src/components/Header.tsx](src/components/Header.tsx), [src/app/HomePageClient.tsx](src/app/HomePageClient.tsx).

## [0.12.5] - 2026-02-01

### Added

- **User banning**: Admins can ban users from the admin page; banned users cannot sign in (login with email or username via Discord is blocked). When a banned user attempts to sign in, they are redirected to the sign-in page with the message "Your account has been banned. If you believe this is an error, please contact support."
  - **Schema**: `users.banned` column (boolean, default `false`). Migration: [drizzle/0019_user_banned.sql](drizzle/0019_user_banned.sql).
  - **Auth**: NextAuth `signIn` callback checks `users.banned` before allowing sign-in; returns redirect to `/signin?error=Banned`. Custom sign-in page at `/signin` shows the banned message when `error=Banned`. Locations: [src/server/db/schema.ts](src/server/db/schema.ts), [src/server/auth/config.ts](src/server/auth/config.ts), [src/app/signin/page.tsx](src/app/signin/page.tsx).
  - **Admin**: `admin.setBanned` mutation (`userId`, `banned`); admin page lists `banned` and has Ban / Unban buttons. Admins cannot ban themselves. Locations: [src/server/api/routers/admin.ts](src/server/api/routers/admin.ts), [src/app/admin/page.tsx](src/app/admin/page.tsx).

## [0.12.4] - 2026-02-01

### Changed

- **Light mode on mobile disabled**: Light theme is no longer available on mobile; effective theme is always dark regardless of stored preference. ThemeContext defaults to mobile (dark) until the media query resolves to avoid a flash of light on load. Settings theme selector on mobile shows only "Dark"; desktop preference (e.g. light) is ignored on mobile and applied again on larger viewports. Locations: [src/contexts/ThemeContext.tsx](src/contexts/ThemeContext.tsx), [src/app/settings/page.tsx](src/app/settings/page.tsx).
- **Visuals disabled on mobile**: FlowField background visualizer is not rendered on mobile; lightweight particle background is used instead. Full-screen mobile player no longer offers the visualizer: Eye toggle removed, only album artwork is shown, and the reactive background hook is disabled in MobilePlayer. Locations: [src/components/PersistentPlayer.tsx](src/components/PersistentPlayer.tsx), [src/components/MobilePlayer.tsx](src/components/MobilePlayer.tsx).
- **Mobile footer visible again**: Mini player was covering the bottom tab bar (both fixed at bottom-0; mini player z-60, footer z-50). Mini player is now positioned above the footer on mobile (`bottom-16`) so both the tab bar (Home, Search, Library, Profile, Create) and the mini player are visible. Location: [src/components/MiniPlayer.tsx](src/components/MiniPlayer.tsx).

### Fixed

- **Mobile queue drawer (dark mode)**: Transparent borders in dark mode for mobile drawer sections and dividers so separator lines do not show as white stripes. Applies to `.mobile-drawer-border`, `.mobile-drawer-section`, `.mobile-drawer-section-header`, `.mobile-drawer-divider` inside the theme chrome drawer. Location: [src/styles/globals.css](src/styles/globals.css).

## [0.12.3] - 2026-02-01

### Changed

- Light theme: further dark-spot fixes and theme-aware styling across components.
- Sliders: dedicated CSS variables (track/fill/thumb) for both themes so sliders contrast in dark and light.
- **Light theme gradients**: Orange-to-green gradient (accent → accent-strong) fits light mode; light-theme overrides for `.accent-gradient`, `.btn-primary`, `.badge-accent`, `.text-glow`, `.player-backdrop::before`; CSS vars `--accent-btn-shadow` / `--accent-btn-shadow-hover` for theme-aware button shadows; gradient buttons (Create Playlist, Add to Playlist, Equalizer, Profile avatar, desktop Play) use these; desktop Play button uses same conditional gradient as other primary actions.
- **Light theme contrast**: Stronger contrast in light mode (darker text `--color-text` / `--color-subtext` / `--color-muted`, darker borders, clearer surface hierarchy, stronger shadows); accent gradients kept lighter (`#d4933d` → `#3da88a`) with `--color-on-accent` for readable text on buttons. Later tuned: light-mode orange slightly darker (`#c9822e` / `#d9933d`) for better contrast; `--ring` and accent shadows use matching orange; `.btn-primary` hover overlay opacity 0.92 so gradient shows through and text stays visible.
- **Visuals in light mode**: Lightweight particle background no longer hidden; `html.theme-light .lightweight-particle` uses softer orange/teal gradients and lower opacity so particles are visible but subtle in light theme.
- **Theme toggle**: Settings theme change (Light/Dark) applies instantly: document class and localStorage update immediately; for logged-in users, preferences cache is updated optimistically so ThemeContext reflects the new theme without waiting for the server.
- **Light mode outlines**: “Starchild Music” header title (`.header-logo-title`) gets a dark per-letter outline in light mode (`-webkit-text-stroke`, `paint-order: stroke fill`); API health pill (`.api-health-pill`) gets a visible border and subtle outer shadow; both outlines strengthened (stroke 1.25px, higher opacity) for clarity.
- **View on GitHub (light mode)**: “View on GitHub” button (`.btn-github`) in light mode uses gray background (`var(--color-surface-hover)`) and outline (`border: 1px solid var(--color-border)`); hover state slightly darker surface and border.

### Fixed

- **Search button (light theme)**: Home page “Search” button and `.btn-primary` in light theme explicitly use `color: var(--color-on-accent)` so label stays visible on hover (no longer solid orange with invisible text); `.btn-primary > *` inherits color for consistent legibility.

## [0.12.2] - 2026-02-01

### Changed

- **ELECTRON_BUILD no longer required in .env**: App detects Electron context dynamically
  - Electron main process sets `ELECTRON_BUILD=true` when spawning the Next.js server, so the server no longer needs this in `.env` or `.env.local`
  - Build scripts (`npm run electron:build:*`) already set `ELECTRON_BUILD=true` for `next build` (image optimization); runtime flag is now injected by Electron when starting the server
  - Removed `ELECTRON_BUILD` from `.env.example`; removed prepare-package logic that wrote it into standalone `.env.local`
  - Auth config uses `env.ELECTRON_BUILD` (set by Electron at runtime); Docker and docs no longer reference the env var
  - Locations: [electron/main.cjs](electron/main.cjs), [electron/prepare-package.js](electron/prepare-package.js), [src/server/auth/config.ts](src/server/auth/config.ts), [.env.example](.env.example), Dockerfile, docker-compose.yml, README, CONTEXT.md, CLAUDE.md, electron/README.md, electron/DISCORD_OAUTH.md, electron/verify-build.js, scripts/server.js

## [0.12.1] - 2026-02-01

### Fixed

- **Mobile visualizer (eye button)**: "Class constructor FlowFieldRenderer cannot be invoked without 'new'" when enabling visuals on mobile
  - FlowFieldRenderer is a canvas class, not a React component; it was incorrectly used as a component via dynamic import
  - New React component `FlowFieldCanvas` wraps a canvas and instantiates `new FlowFieldRenderer(canvas)` with ResizeObserver, audio connection, and animation loop
  - MobilePlayer now dynamically loads and renders `<FlowFieldCanvas />` with same props (audioElement, isPlaying, visualizerMode, visualizerType)
  - Locations: [src/components/visualizers/FlowFieldCanvas.tsx](src/components/visualizers/FlowFieldCanvas.tsx), [src/components/MobilePlayer.tsx](src/components/MobilePlayer.tsx)

### Changed

- **Light mode styling (full revamp)**: Light theme no longer mixes dark base with light variables
  - Dark-only base: html background and arcane overlays (html::before/::after, body::before/::after) apply only under `html:not(.theme-light)` so light mode gets a clean base
  - Light theme variables: refreshed palette (e.g. bg #f8fafb, surface #ffffff, accent #d4933d, border #e2e8f0), softer shadows/ring, `--color-on-accent` for buttons/badges/selection
  - Light base: solid background and subtle teal/amber gradients via html.theme-light::before/::after; lightweight particle background hidden in light mode
  - Component overrides under `html.theme-light`: .btn-secondary, .btn-ghost, .card, .surface-panel, .surface-muted, .chip, .glass, .player-backdrop, .page-shell, .bottom-sheet, .input-text, scrollbar, scroll-shadow-\*, equalizer sliders/labels
  - Theme-aware chrome: new classes .theme-chrome-header, .theme-chrome-bar, .theme-chrome-drawer, .theme-chrome-backdrop with light variants; Header, MiniPlayer, MobileFooter, BottomSheet, EnhancedQueue, Equalizer, PatternControls use them
  - Settings and Home: cards/rows use var(--color-border), var(--color-surface), var(--color-surface-hover) instead of white/5; toggle track uses var(--color-border) when unchecked
  - Locations: [src/styles/globals.css](src/styles/globals.css), [src/components/Header.tsx](src/components/Header.tsx), [src/components/MiniPlayer.tsx](src/components/MiniPlayer.tsx), [src/components/MobileFooter.tsx](src/components/MobileFooter.tsx), [src/components/BottomSheet.tsx](src/components/BottomSheet.tsx), [src/components/EnhancedQueue.tsx](src/components/EnhancedQueue.tsx), [src/components/Equalizer.tsx](src/components/Equalizer.tsx), [src/components/PatternControls.tsx](src/components/PatternControls.tsx), [src/app/settings/page.tsx](src/app/settings/page.tsx), [src/app/HomePageClient.tsx](src/app/HomePageClient.tsx)

## [0.12.0] - 2026-01-28

### Changed

- **Docker**: App runs as PID 1 with `node server.js` (no PM2 in default flow)
  - Entrypoint runs `exec node server.js` so the Next.js standalone server is the container init process and receives all env (HOSTNAME=0.0.0.0, PORT=3222)
  - Restart on crash is handled by Docker `restart: unless-stopped`; PM2 inside the container is redundant for single-process apps
  - Entrypoint warns if AUTH_SECRET is unset
  - Locations: [scripts/docker-entrypoint.sh](scripts/docker-entrypoint.sh), [DOCKER.md](DOCKER.md)

- **API env renames (server-only)**: `NEXT_PUBLIC_API_URL` → `API_URL`, `NEXT_PUBLIC_V2_API_URL` / `V2_API_URL` → `API_V2_URL`
  - All server and API code use `env.API_URL` and `env.API_V2_URL`; client no longer reads these (apiHostname passed from server to HomePageClient)
  - Backward compatibility: runtimeEnv still reads `NEXT_PUBLIC_*` / `V2_API_URL` when new names are unset
  - Locations: [src/env.js](src/env.js), API routes, [.env.example](.env.example), Dockerfile, docker-compose, scripts, tests

### Improved

- **Health route (`/api/health`)**: Always returns a response (fixes ERR_EMPTY_RESPONSE / 502)
  - No top-level import of `@/server/db`; db is loaded via dynamic `import()` inside the handler so missing DATABASE_URL does not crash the process before responding
  - When DATABASE_URL is missing, response is 200 with `checks.database: "skipped"`; when DB is unreachable, 503 with error
  - Outer try/catch returns 503 JSON on any uncaught error so the connection is never closed without a response
  - Location: [src/app/api/health/route.ts](src/app/api/health/route.ts)

- **DOCKER.md**: 502 troubleshooting and process management
  - Explains app runs as PID 1, required env vars (AUTH_SECRET, etc.), startup delay, and how to check with `curl` and `docker compose logs`
  - Process management section updated: default is `node server.js`; optional PM2 via ecosystem.docker.cjs noted
  - Location: [DOCKER.md](DOCKER.md)

### Removed

- **Void Ripples pattern**: Removed from FlowFieldRenderer and pattern list (had caused visualizer freezes; pattern was reworked then dropped)
  - Locations: [src/components/visualizers/FlowFieldRenderer.ts](src/components/visualizers/FlowFieldRenderer.ts), [src/components/visualizers/flowfieldPatterns/patternIds.ts](src/components/visualizers/flowfieldPatterns/patternIds.ts)

## [0.11.4] - 2026-01-28

### Improved

- **README (Docker)**: Detailed Docker instructions and container management
  - Prerequisites, quick start with `.env.example`, and table of commands (start, stop, restart, logs, shell, db:push, rebuild, status, health)
  - Notes on when to restart vs rebuild and that db:push runs on startup when DB is configured
  - Makefile section aligned with actual targets; pointer to DOCKER.md for local PostgreSQL and full guide
  - Location: [README.md](README.md)

- **Home page (sign-in copy)**: Rephrased optional sign-in / privacy line for clarity and tone
  - "Your privacy stays fully protected; optional sign-in unlocks custom playlists, a public profile, and your personal music identity—with more features on the way"
  - Location: [src/app/HomePageClient.tsx](src/app/HomePageClient.tsx)

- **Home page (infrastructure)**: API hostname from env instead of hardcoded URL
  - Music data source text uses `NEXT_PUBLIC_V2_API_URL` (fallback `NEXT_PUBLIC_API_URL`); displays hostname only
  - Location: [src/app/HomePageClient.tsx](src/app/HomePageClient.tsx)

## [0.11.3] - 2026-02-01

### Improved

- **Docker build**: Dockerfile mirrors all env.js variables via build args (no hardcoded URLs)
  - Required and optional vars passed as ARG/ENV in builder stage; docker-compose passes them from `.env` as build args
  - Ensures env validation runs at build time with values from `.env`
  - Locations: [Dockerfile](Dockerfile), [docker-compose.yml](docker-compose.yml)

- **Docker build**: `.dockerignore` updated so `CHANGELOG.md` is included in the build context
  - Enables `copy:changelog` (cp CHANGELOG.md public/CHANGELOG.md) to succeed during `npm run build`
  - Location: [.dockerignore](.dockerignore)

- **Example Playlist button (home)**: Stronger hover and focus styling
  - Scale and ring on hover/focus; brightness lift; subtle overlay and icon scale on hover
  - Theme: `--color-secondary-accent` and `--color-secondary-accent-strong` added in `globals.css` (dark and light) for teal gradient
  - Locations: [src/app/HomePageClient.tsx](src/app/HomePageClient.tsx), [src/styles/globals.css](src/styles/globals.css)

## [0.11.2] - 2026-02-01

### Improved

- **Desktop start page (home)**: More compact, denser layout on desktop (md and up)
  - Reduced main and card padding, gaps, and section spacing
  - Smaller search bar and button, tighter recent-search chips
  - Search results header and list spacing reduced; load-more area tightened
  - Empty state: less vertical padding, smaller hero icon and heading, denser sign-in and example-playlist blocks
  - Suggestion pills, GitHub/Changelog buttons, and Infrastructure section use smaller type and spacing
  - Mobile layout unchanged
  - Location: [src/app/HomePageClient.tsx](src/app/HomePageClient.tsx)

## [0.11.1] - 2026-01-28

### Added

- **Docker Deployment Support**: Complete containerization with production-ready Docker setup
  - Multi-stage Dockerfile optimized for production (~450MB final image)
  - Docker Compose orchestration for full stack (app + PostgreSQL database)
  - Development Docker Compose with hot reload and volume mounts
  - Automatic database migrations on container startup via entrypoint script
  - Health checks and auto-restart policies for reliability
  - PostgreSQL 16 Alpine integration with persistent volumes
  - Non-root user (nextjs:1001) for enhanced security
  - Environment template with all required variables (`.env.docker.example`)
  - Locations: [Dockerfile](Dockerfile), [docker-compose.yml](docker-compose.yml), [docker-compose.dev.yml](docker-compose.dev.yml)

- **Docker Helper Scripts**: Automation scripts for Docker deployment
  - `docker-entrypoint.sh`: Runs migrations before starting app in production
  - `docker-migrate.sh`: Database migration helper with PostgreSQL readiness check
  - Executable permissions configured in Dockerfile
  - Locations: [scripts/docker-entrypoint.sh](scripts/docker-entrypoint.sh), [scripts/docker-migrate.sh](scripts/docker-migrate.sh)

- **Makefile**: Convenient commands for Docker operations
  - `make up`: Start production environment
  - `make down`: Stop all services
  - `make logs`: View application logs
  - `make dev`: Start development with hot reload
  - `make db-shell`: Access PostgreSQL CLI
  - `make migrate`: Run database migrations
  - `make clean`: Remove all containers and volumes
  - `make help`: Show all available commands
  - Location: [Makefile](Makefile)

- **Docker CI/CD Workflow**: GitHub Actions integration for automated builds
  - Builds and tests Docker images on push and pull requests
  - Caches Docker layers for faster builds
  - Pushes to Docker Hub on main branch (configurable)
  - Multi-platform support ready
  - Location: [.github/workflows/docker-build.yml](.github/workflows/docker-build.yml)

- **Comprehensive Docker Documentation**: 500+ line deployment guide
  - Quick start guide with step-by-step instructions
  - Production deployment checklist
  - Database management and backup strategies
  - Reverse proxy setup examples (nginx, Caddy)
  - Troubleshooting guide for common issues
  - Security best practices and hardening
  - Performance tuning recommendations
  - CI/CD integration examples
  - Migration guide from non-Docker deployments
  - Location: [DOCKER.md](DOCKER.md)

### Improved

- **README.md**: Added Docker as recommended deployment method
  - Quick start section for Docker deployment
  - Makefile command reference
  - Feature highlights (isolation, auto-migrations, health checks)
  - Links to comprehensive Docker documentation
  - Positioned Docker before PM2 as recommended approach
  - Location: [README.md](README.md#-production-deployment--server-management)

- **CLAUDE.md**: Added Docker deployment commands section
  - Production and development Docker Compose commands
  - Database operations via Docker
  - Reference to DOCKER.md for complete guide
  - Integrated into Common Commands section
  - Location: [CLAUDE.md](CLAUDE.md#docker-deployment)

- **.dockerignore**: Optimized Docker build context
  - Excludes node_modules, .next, and build artifacts
  - Excludes .env files (except example template)
  - Excludes development files (tests, IDE configs)
  - Reduces build context size and improves build speed
  - Location: [.dockerignore](.dockerignore)

- **mark-migrations-applied script**: Fix sync with drizzle-kit migrate (PostgreSQL)
  - Script now writes to `drizzle.__drizzle_migrations` instead of `public.__drizzle_migrations`, matching the schema used by drizzle-orm for PostgreSQL so `npm run db:migrate` recognizes applied migrations
  - Hash stored is now the SHA-256 hex digest of each migration `.sql` file content (as computed by drizzle-orm's migrator), instead of the migration tag, so entries match what `drizzle-kit migrate` expects
  - Use when the database already has the tables (e.g. from `db:push` or a previous run) but migrate still tries to re-apply and fails with "relation … already exists"
  - Usage: `npx tsx scripts/mark-migrations-applied.ts` then `npm run db:migrate`
  - Location: [scripts/mark-migrations-applied.ts](scripts/mark-migrations-applied.ts)

## [0.11.0] - 2026-02-01

### Added

- **Mobile Player Visualizer Toggle**: Interactive visualizer overlay on mobile player artwork
  - Eye icon button in top-right corner of artwork toggles between album cover and visualizer
  - 3D flip animation using Framer Motion with rotateY transforms for smooth transition
  - Button only visible when visualizerMode is "random" or "specific" (hidden when "off")
  - Button styled with backdrop blur and dynamic shadow color based on album palette
  - Haptic feedback on toggle for enhanced mobile UX
  - Location: [src/components/MobilePlayer.tsx](src/components/MobilePlayer.tsx:1119-1225)

- **FlowFieldRenderer Integration**: Full audio-reactive visualizer integration in mobile player
  - FlowFieldRenderer component dynamically imported for performance optimization
  - Canvas element replaces album artwork when visualizer is toggled on
  - Connected to audio element for real-time frequency analysis
  - Supports visualizerMode settings: "random" (random patterns), "specific" (user-selected), "off" (disabled)
  - Inherits all 80+ audio-reactive patterns from FlowFieldRenderer
  - Maintains same border styling and glow effects as album artwork for visual consistency
  - Responds to isPlaying state for proper play/pause behavior
  - Location: [src/components/MobilePlayer.tsx](src/components/MobilePlayer.tsx:1192-1209)

- **Compact Mode for Mobile Player**: Space-efficient mode for smaller screens
  - Toggle available in Settings > Visual section
  - Artwork size: 360px → 280px (reduces visual footprint by 22%)
  - Text sizing adjustments:
    - Track title: text-xl → text-lg
    - Artist name: text-xs → text-[11px]
    - Album title: text-[10px] → text-[9px]
    - Queue labels: text-[9px] → text-[8px]
    - Queue numbers: text-lg → text-base (queue count), text-sm → text-xs (total duration)
  - Spacing reductions:
    - Info section gap: 4 → 2 (50% reduction)
    - Card padding: px-4 py-2 → px-3 py-1.5
    - Content gap: gap-4 → gap-2
  - Maintains full functionality with reduced visual footprint
  - Ideal for users who prefer more content visibility or have smaller screens
  - Settings persist across sessions (localStorage for guests, database for authenticated users)
  - Location: [src/components/MobilePlayer.tsx](src/components/MobilePlayer.tsx:1118-1340)

### Improved

- **Settings Persistence**: Enhanced settings storage system for mobile
  - LocalStorage-based persistence for non-authenticated users via settingsStorage utility
  - Database persistence for authenticated users via user_preferences table
  - Unified interface through effectivePreferences pattern (checks authentication status)
  - Applies to all mobile settings: visualizerMode, compactMode, theme, and player preferences
  - Seamless migration when users sign in (database preferences override localStorage)
  - Type-safe settings management with UserSettings interface and DEFAULT_SETTINGS fallback
  - Location: [src/utils/settingsStorage.ts](src/utils/settingsStorage.ts), [src/components/MobilePlayer.tsx](src/components/MobilePlayer.tsx:398-406)

## [0.10.30] - 2026-02-01

### Added

- **About Page**: New sparse About page accessible from mobile hamburger menu
  - Team information featuring the developers behind the project
  - Project motivation and purpose section explaining the frontend for self-made API
  - Development approach overview (team and pair programming)
  - Tech stack display with visual badges (Next.js 15, TypeScript, TailwindCSS v4, tRPC, PostgreSQL, Drizzle ORM)
  - Links to GitHub repository and license page
  - Consistent minimal iOS-style design matching settings and license pages
  - Clean card-based layout with subtle borders and backdrop blur effects
  - Location: [src/app/about/page.tsx](src/app/about/page.tsx)

### Improved

- **TypeScript Type Safety**: Enhanced type safety in tesseractSpin visualizer pattern
  - Added explicit undefined checks for vertex array destructuring
  - Added type annotations for edges array (`Array<[number, number]>`)
  - Added undefined guards for edge indices in sorting function
  - Added validation check to skip edges with undefined indices
  - Prevents potential runtime errors in strict TypeScript mode
  - Improves code reliability and maintainability
  - No visual or performance changes, purely type safety improvements
  - Location: [src/components/visualizers/FlowFieldRenderer.ts](src/components/visualizers/FlowFieldRenderer.ts:15730-15790)

## [0.10.29] - 2026-02-01

### Added

- **Light Theme**: Added light theme option for mobile with persistent user preference
  - New ThemeProvider context manages theme state across the application
  - Light theme features clean white backgrounds with high-contrast text for better daylight readability
  - Theme selector available in Settings > Visual section (already existed, now functional)
  - Dark theme remains the default for all users
  - Theme preference persists across sessions via user_preferences database table
  - Automatic theme application on mount without page reload
  - Light theme specifications:
    - Background: Pure white (#ffffff) with subtle gradients (#f8f9fa)
    - Text: High contrast dark (#1a1f2e) for maximum readability
    - Subtext: Medium gray (#4a5568) for secondary content
    - Surfaces: Light gray (#f8f9fa) with hover states (#f0f2f5)
    - Borders: Soft light gray (#e2e8f0)
    - Shadows: Lighter, more subtle (rgba(0,0,0,0.08) vs rgba(5,10,18,0.45))
    - Accent colors: Maintains orange (#f4b266) and teal (#58c6b1) for consistency
    - Overlay effects: Reduced opacity for light backgrounds (0.04-0.08 vs 0.08-0.15)
  - Mobile-optimized with instant visual feedback on theme change
  - Seamless transition between themes without visual artifacts
  - Location: [src/contexts/ThemeContext.tsx](src/contexts/ThemeContext.tsx), [src/styles/globals.css](src/styles/globals.css:9-82)

## [0.10.28] - 2026-02-01

### Added

- **New Visual Patterns**: Added three hyper-optimized audio-reactive visualizer patterns
  - **voidRipples**: Concentric interference patterns from multiple ripple sources
    - Pure stroke-based rendering (no fill operations) for maximum efficiency
    - Multiple ripple sources create natural interference patterns without computational overhead
    - Adaptive ripple counts based on screen resolution and audio intensity
    - Minimal connection lines between sources for visual interest
    - Audio-reactive: bass affects ripple amplitude, mid frequencies control ripple density, overall intensity affects visibility
    - Zero gradient usage, zero shadow usage (ultra Firefox-friendly)
  - **tesseractSpin**: Rotating 4D hypercube (tesseract) projected into 2D space
    - Pure line-based wireframe geometry (32 edges) for efficient rendering
    - 4D rotation through multiple dimensional planes (XY, XZ, YZ, XW)
    - Depth-sorted edge rendering creates proper 3D perspective effect
    - Conditional shadow usage (only on edges with depth > 0.6 at high quality settings)
    - Pre-computed rotation matrices for faster frame rendering
    - Audio-reactive: bass affects rotation speed, treble controls line width, overall intensity affects visibility and depth perception
  - **valknut**: Norse three-triangle knot symbol with interlocking sacred geometry
    - Three interlocking equilateral triangles forming the traditional Odin's knot pattern
    - Pure stroke-based geometry with inner concentric triangles for depth
    - Conditional shadow usage (only when quality ≥ 0.85)
    - Triangles rotate in unison while maintaining their interconnected pattern
    - Minimal connection lines between triangle centers
    - Audio-reactive: bass drives pulsation scale (breathing effect), treble controls line width, overall intensity affects glow strength
  - **Firefox-Specific Optimizations**: All patterns include
    - Minimal or zero gradient usage (solid colors preferred)
    - Controlled shadow usage (disabled by default, only at high quality)
    - Reduced element counts (scales down on large displays)
    - Efficient canvas operations (batched stroke operations)
    - Fast math helpers and pre-computed values
    - Depth-sorting optimization for tesseract edge ordering
  - Location: [src/components/visualizers/FlowFieldRenderer.ts](src/components/visualizers/FlowFieldRenderer.ts:15607-15930), [src/components/visualizers/flowfieldPatterns/patternIds.ts](src/components/visualizers/flowfieldPatterns/patternIds.ts:116-120)

## [0.10.27] - 2026-02-01

### Added

- **New Visual Patterns**: Added two hyper-optimized audio-reactive visualizer patterns
  - **nebulaDrift**: Flowing nebula-like particles in spiral streams with dynamic color shifts
    - Adaptive particle counts based on screen resolution and audio intensity
    - Conditional gradient usage (solid colors in low detail mode, gradients when quality > 0.75)
    - Efficient per-stream batching reduces canvas state changes
    - Minimal connection lines between streams (2-3 for optimal performance)
    - Early-continue optimizations for particles outside visible life ranges
    - Audio-reactive: bass affects drift amplitude, mid frequencies control particle density, overall intensity affects size and glow
  - **crystalPulse**: Pulsating geometric crystalline structures with energy connections
    - Pure line-based geometry (no gradients) for maximum rendering efficiency
    - Conditional shadow usage (only when quality ≥ 0.85)
    - Adaptive crystal and facet counts based on audio intensity and quality scale
    - Batched stroke operations for facet connections
    - Pre-computed rotation and positioning values for faster frame rendering
    - Audio-reactive: bass drives pulsation scale (breathing effect), treble controls facet count, overall intensity affects crystal count and glow
  - **Firefox-Specific Optimizations**: Both patterns include
    - Minimal gradient usage (only in high quality mode, solid colors otherwise)
    - Controlled shadow usage (disabled in low detail, scaled with quality)
    - Reduced element counts (scales down on large displays and low quality settings)
    - Efficient canvas operations (batched beginPath/stroke/fill cycles)
    - Fast math helpers (fastSin, fastCos, fastMod360)
    - Bitwise integer operations for element counts and indexing
  - Location: [src/components/visualizers/FlowFieldRenderer.ts](src/components/visualizers/FlowFieldRenderer.ts:15403-15598), [src/components/visualizers/flowfieldPatterns/patternIds.ts](src/components/visualizers/flowfieldPatterns/patternIds.ts:116-117)

## [0.10.26] - 2026-02-01

### Changed

- **Mobile Player Controls Integration**: Consolidated all player controls into a unified section
  - Integrated queue, add to playlist, and favorite buttons directly into the main music controls card
  - Removed the separate secondary controls section that was creating a visual gap at the bottom
  - Added horizontal divider to separate main playback controls from action buttons
  - More compact and cohesive mobile player design with all controls in one gradient-bordered card
  - Improved visual hierarchy and reduced vertical spacing for a cleaner interface
  - Enhanced touch target accessibility with consistent button sizing and spacing
  - Location: [src/components/MobilePlayer.tsx](src/components/MobilePlayer.tsx:1565-1740)

### Improved

- **Mobile Player UX**: Streamlined bottom section
  - Eliminated the gaping hole at the bottom by integrating all controls
  - Controls now flow naturally within a single unified card
  - Better visual consistency with gradient styling matching the main controls
  - Reduced overall player height while maintaining all functionality

## [0.10.25] - 2026-02-01

### Removed

- **Mobile Player Volume Controls**: Removed volume slider and mute button from mobile player
  - Volume controls were non-functional on mobile devices due to browser API limitations
  - Mobile OS handles volume through physical hardware buttons, making in-app controls redundant
  - Removed UI elements: volume slider, mute/unmute button, volume adjustment handlers
  - Simplified mobile player interface by ~100 lines of code
  - Users can still control volume using device volume buttons (standard mobile UX pattern)
  - Location: `src/components/MobilePlayer.tsx`

- **Mobile Player Equalizer**: Removed equalizer panel and controls from mobile player
  - Equalizer caused interference with background playback persistence
  - Web Audio API context conflicts prevented reliable background audio on mobile browsers
  - Removing equalizer improves playback stability when app is backgrounded or screen is locked
  - Equalizer functionality still available on desktop player where background playback is not a concern
  - Mobile users benefit from more reliable continuous playback during screen-off scenarios
  - Removed UI elements: equalizer button, equalizer slide-out panel, equalizer state management
  - Location: `src/components/MobilePlayer.tsx`

### Changed

- **Mobile Player Interface**: Streamlined secondary controls bar
  - Removed volume controls reduces visual clutter
  - More space for essential playback controls (queue, add to playlist)
  - Cleaner, more focused mobile UI optimized for touch interactions
  - Follows mobile-first design principles (hardware controls preferred over software controls)

## [0.10.24] - 2026-01-30

### Changed

- **Mobile Player Browser Chrome Accommodation**: Adjusted default sizing to account for browser UI elements
  - Reduced default artwork size: 320px → 300px
  - Reduced default play button: 68px → 64px
  - Reduced default skip buttons: 36px → 34px
  - Reduced default control buttons: 16px → 15px
  - Reduced default gaps: 1rem → 0.875rem
  - Artwork max-height: 52vh → 42vh (accommodates ~130-145px of browser chrome)
  - Content max-width: 92vw → 90vw
  - Artwork max-width: 88vw → 85vw
  - **iOS considerations**: Status bar (44px) + Safari address bar (~50px) + home indicator (34px) = ~128px
  - **Android considerations**: Status bar (24-30px) + Chrome address bar (~56px) + navigation bar (48-60px) = ~130-146px
  - Ensures player controls remain accessible with browser UI visible
  - Location: `src/styles/globals.css`

- **Mobile Player UI Streamlining**: Reduced vertical spacing and simplified header
  - Removed "Now Playing on Starchild" label from player header
  - Removed top padding from shuffle/repeat controls row
  - Removed margin between control rows for tighter layout
  - Cleaner, more compact player interface with focus on content
  - Location: `src/components/MobilePlayer.tsx`

- **Mini Player Positioning**: Moved mini player to bottom edge on mobile
  - Changed from 68px offset to 0px (sits directly at screen bottom)
  - Safe area insets still respected for notched/gesture navigation devices
  - Consistent positioning across all mobile screen sizes
  - Location: `src/components/MiniPlayer.tsx`

- **Next.js 16 Proxy Migration**: Migrated from deprecated middleware.ts to proxy.ts
  - Renamed `src/middleware.ts` to `src/proxy.ts` for Next.js 16 compatibility
  - Renamed exported function from `middleware` to `proxy` (required by Next.js 16)
  - Functionality unchanged: rate limiting and CSP headers work identically
  - Resolves deprecation warning: "The 'middleware' file convention is deprecated"
  - Maintains all security features (100 requests/60s limit, CSP policies)
  - Location: `src/proxy.ts` (formerly `src/middleware.ts`)

## [0.10.23] - 2026-01-30

### Added

- **Extended Phone Model Support**: Added responsive breakpoints for 40+ additional phone models
  - **Motorola**: Edge 50 Pro, Edge 40 Pro, Edge+, Moto G Power, Moto G Stylus (395-400×851-900)
  - **Nokia**: X30, X20, G60 (412×915)
  - **TCL**: 40 XL, 40 SE (397×843)
  - **Samsung Galaxy M Series**: M54, M53, M52 (412×915)
  - **Huawei**: P50 Pro, P40 Pro, Mate 60 Pro, Mate 50 Pro (408-412×900-952)
  - **ZTE**: Axon 60 Ultra, Axon 40 Ultra (400×900)
  - **Meizu**: 21 Pro, 20 Pro (412×919)
  - **Nubia & Red Magic**: Z60 Ultra, Red Magic 9 Pro (412×952)
  - **Lenovo Legion**: Y90, Y70 (395×876)
  - **Black Shark**: 5 Pro, 4 Pro (409×906)
  - **Oppo Foldables**: Find N3 Flip (cover: 382×840, unfolded: 748×1082), Find N3 Fold (760×1080)
  - **Honor Foldables**: Magic V3, V2 (unfolded: 762×1080)
  - **Xiaomi Foldables**: Mix Fold 4, Fold 3 (unfolded: 768×1024)
  - **Tecno**: Phantom X2 Pro, Camon 20 Pro (395×854)
  - **Infinix**: Note 40 Pro, Zero 30 (412×915)
  - **Itel**: Vision 3 Turbo, S24 (390×844)
  - **Poco**: X6 Pro, F5 Pro (412×915)
  - **Redmi**: Note 13 Pro+, Note 12 Pro+ (412×915)
  - Location: `src/styles/globals.css`

- **Legacy Device Support**: Added comprehensive support for older flagship models still in widespread use
  - **Apple iPhone (Legacy)**:
    - iPhone 8, 7, 6s, 6 (375×667)
    - iPhone 8 Plus, 7 Plus, 6s Plus, 6 Plus (414×736)
    - iPhone 5s, 5c, 5, SE 1st Gen (320×568) with ultra-compact optimizations
  - **Samsung Galaxy (S-Series Legacy)**:
    - Galaxy S10+, S10 (412×869) with Infinity-O display
    - Galaxy S10e (360×760)
    - Galaxy S9+, S9 (360×740)
    - Galaxy S8+, S8 (360×740) with first-gen Infinity Display
    - Galaxy S7 Edge, S7 (360×640) classic design
  - **Samsung Galaxy (Note-Series Legacy)**:
    - Galaxy Note 9 (414×846) with S Pen optimizations
    - Galaxy Note 8 (414×846)
  - **Google Pixel (Legacy)**:
    - Pixel 5, 4a 5G, 4a (393×851) with early Material You
    - Pixel 4 XL (412×869), Pixel 4 (393×830)
    - Pixel 3a XL (412×846), Pixel 3a (393×808)
    - Pixel 3 XL (412×847) with notch, Pixel 3 (393×786)
    - Pixel 2 XL (412×824), Pixel 2 (411×731)
  - Total device support now exceeds 135+ phone models across all major manufacturers
  - Location: `src/styles/globals.css`

- **Dynamic Skip Button Colors**: Previous and Next buttons now use complementary colors from album art
  - Automatically extracts complementary (opposite) colors from primary and secondary album colors
  - High saturation boost (1.8x) for vibrant, eye-catching button colors
  - Slight brightness increase (1.2x) for better visibility
  - Previous button: Complementary of primary color
  - Next button: Complementary of secondary color
  - Creates dynamic, album-specific color schemes that harmonize with artwork
  - Location: `src/components/MobilePlayer.tsx`

### Changed

- **Gaming Phone Optimizations**: Added specialized spacing for gaming phones with cooling fans and side triggers
  - Lenovo Legion series: Extra padding for side trigger clearance
  - Nubia/Red Magic series: Bottom padding for cooling fan space
  - Black Shark series: Optimized touch target spacing

- **Foldable Device Enhancements**: Improved support for large unfolded screens
  - Larger artwork sizes (460-470px) for tablet-like experiences
  - Increased button sizes for better reachability on wide screens
  - Enhanced spacing with 1.75-2rem gaps for comfortable interaction

- **OS-Specific Gesture Navigation**: Added system-specific bottom padding for gesture bars
  - EMUI (Huawei): 1.125rem bottom padding
  - Flyme OS (Meizu): 1rem bottom padding
  - MagicOS (Honor): 1.25rem bottom padding
  - ColorOS (Oppo): 1.125rem bottom padding
  - HiOS (Tecno): 1rem bottom padding
  - XOS (Infinix): 1rem bottom padding
  - Poco UI (MIUI variant): 1.125rem bottom padding

## [0.10.22] - 2026-01-30

### Changed

- **Next.js Upgrade**: Upgraded from Next.js 15.5.11 to Next.js 16.1.6
  - Turbopack build performance improvements
  - Enhanced optimization for package imports
  - Improved worker-based page data collection (11 workers)
  - Location: `package.json`

- **NextAuth Compatibility**: Restored NextAuth v5.0.0-beta.30 for Next.js 16 App Router compatibility
  - NextAuth v5 beta required for App Router `handlers` API
  - Fixed build error: "Cannot destructure property 'GET' of 'a.handlers'"
  - Location: `package.json`, `src/server/auth/index.ts`

### Removed

- **Deprecated ESLint Config**: Removed `eslint` configuration block from next.config.js
  - Next.js 16 no longer supports ESLint configuration in next.config.js
  - ESLint configuration now handled exclusively via ESLint config files
  - Resolves warning: "eslint configuration in next.config.js is no longer supported"
  - Location: `next.config.js`

### Known Issues

- **Middleware Deprecation Warning**: ~~Next.js 16 deprecates "middleware.ts" in favor of "proxy.ts"~~ **RESOLVED in v0.10.24**
  - ~~Warning: "The 'middleware' file convention is deprecated. Please use 'proxy' instead"~~
  - ~~Current: `src/middleware.ts` handles rate limiting and CSP headers~~
  - ~~Impact: Warning only - middleware continues to function normally~~
  - ✓ **Fixed**: Migrated to `src/proxy.ts` in v0.10.24
  - Reference: https://nextjs.org/docs/messages/middleware-to-proxy

## [0.10.21] - 2026-01-30

### Added

- **Comprehensive Phone Model Support**: Added device-specific responsive breakpoints for 75+ phone models across all major manufacturers
  - **Apple iPhone (10 models)**:
    - Flagship: 14 Plus, 13 Pro Max, 12 Pro Max (428×926)
    - Pro: 16 Pro, 15 Pro (393×852)
    - Standard: 16, 15, 14, 13, 12 (390×844)
    - Compact: 13 mini, 12 mini (375×812)
    - Budget: SE 2022/2020/3rd Gen (375×667)
    - Classic: X/XS/11 Pro (375×812), XR/11 (414×896), 8 Plus/7 Plus/6s Plus (414×736)
  - **Samsung Galaxy (8 models)**:
    - Ultra: S24 Ultra, S23 Ultra (412×915)
    - Plus: S22+, S21+ (384×854)
    - Standard: S24, S23, S22 Ultra, S21 Ultra (360-384×854)
    - Mid-range: A54, A53, A52 (360×800)
    - Note: Note 20 Ultra, Note 10+ (412×915)
  - **Google Pixel (9 models)**:
    - Pro XL: Pixel 9 Pro XL, 8 Pro (412×915)
    - Standard: Pixel 9, 8, 7, 6 (412×915)
    - A-Series: Pixel 9a, 8a, 7a, 6a (412×892)
  - **OnePlus (5 models)**: OnePlus 12/11/10 Pro, Nord/Nord 2/Nord 3 (412×915-919)
  - **Xiaomi (3 models)**: Xiaomi 14 Pro, 13 Pro, 12 Pro (412×915)
  - **Nothing Phone (2 models)**: Nothing Phone (2), (1) (412×915)
  - **Sony Xperia (2 models)**: Xperia 1 VI, 1 V (412×1096 - 21:9 cinema aspect)
  - **Gaming Phones (2 models)**: Asus ROG Phone 8, 7 (412×952)
  - **Chinese Flagships (10 models)**:
    - Oppo: Find X7 Ultra, X6 Pro (412×919)
    - Vivo: X100 Pro, X90 Pro (412×915)
    - Realme: GT 6, GT 5 Pro (412×915)
    - Honor: Magic 6 Pro, Magic 5 Pro (412×915)
  - **Special Form Factors (3 models)**:
    - LG Wing: Swivel dual-screen (395×822)
    - Fairphone: Fairphone 5, 4 (412×915)
  - **Tablets (1 model)**: iPad Mini (744×1133 portrait)
  - Location: `src/styles/globals.css`

- **Foldable Device Support**: Added comprehensive responsive breakpoints for foldable devices
  - Samsung Galaxy Z Fold 5/4/3 (cover screen: 344×882, unfolded: 753×906)
  - Samsung Galaxy Z Flip 5/4/3 (cover screen: 260×512)
  - Motorola Razr+ / Razr 40 Ultra (cover screen: 413×360)
  - Location: `src/styles/globals.css`

- **Adaptive Mobile Player Button Sizing**: Added CSS variables for responsive button sizing across all device sizes
  - `--mobile-player-play-button-size`: Main play/pause button (44px-80px based on device)
  - `--mobile-player-skip-button-size`: Previous/Next buttons (24px-42px based on device)
  - `--mobile-player-control-button-size`: Shuffle/Repeat buttons (12px-20px based on device)
  - `--mobile-player-controls-gap`: Spacing between controls (0.75rem-2rem based on device)
  - Location: `src/styles/globals.css`, `src/components/MobilePlayer.tsx`

- **OS-Specific Gesture Navigation Spacing**: Added proper bottom padding for various Android skins and iOS
  - Material You (Google Pixel): 1.125rem bottom padding
  - One UI (Samsung): 1rem bottom padding
  - OxygenOS (OnePlus): 1rem bottom padding
  - MIUI (Xiaomi): 1.125rem bottom padding
  - ColorOS (Oppo): 1rem bottom padding
  - Funtouch OS (Vivo): 1rem bottom padding
  - MagicOS (Honor): 1rem bottom padding
  - Nothing OS: 1rem bottom padding
  - iOS Dynamic Island (iPhone Pro models): 2.5rem top padding
  - Location: `src/styles/globals.css`

### Changed

- **Device-Specific Button Sizing**: Optimized button sizes for each phone category
  - Compact phones (< 375px): Play 58px, Skip 32px, Controls 14px
  - iPhone SE / Classic models (375×667): Play 60px, Skip 32px, Controls 14px
  - Standard flagships (375-395×812-852): Play 64-68px, Skip 34-36px, Controls 15-16px
  - Large flagships (410-430×896-932): Play 69-72px, Skip 37-38px, Controls 17-18px
  - Tablets (iPad Mini): Play 80px, Skip 42px, Controls 20px
  - Gaming phones (ROG): Play 70px with extra bottom control space
  - Cinema phones (Sony Xperia 21:9): Play 72px with extra vertical spacing
  - Location: `src/styles/globals.css`

- **Artwork Sizing by Device**: Optimized album artwork display for each phone size
  - Compact phones (< 375px): 280px artwork
  - iPhone SE: 310px artwork
  - Standard phones (375-395px): 330-345px artwork
  - Large flagships (410-430px): 365-380px artwork
  - Sony Xperia (21:9): 390px artwork
  - Extra tall phones: 390-400px artwork
  - Tablets (iPad Mini): 480px artwork
  - Foldables (Z Fold unfolded): 450px artwork
  - Location: `src/styles/globals.css`

- **Compact Phone Optimizations**: Tuned button sizes and spacing for devices < 375px width
  - Play button: 68px → 58px
  - Skip buttons: 36px → 32px
  - Control buttons: 16px → 14px
  - Tighter control spacing for better ergonomics on small screens
  - Location: `src/styles/globals.css`

- **Landscape Mode Optimizations**: Enhanced button sizing for small landscape heights
  - Standard landscape (height < 500px): Play button 52px, tighter spacing
  - Extreme compact (height < 400px): Play button 44px, minimal UI
  - Tablet landscape layout improvements with grid-based artwork + controls
  - Location: `src/styles/globals.css`

- **Extra Tall Screen Enhancement**: Improved button sizing for unfolded foldables and tall phones (height > 950px)
  - Larger buttons for better touch targets on expansive screens
  - Play button: 72px, Skip buttons: 38px, Control buttons: 18px
  - Sony Xperia (21:9): Play button 72px with cinema-wide spacing optimizations
  - Location: `src/styles/globals.css`

### Fixed

- **Multiple Lockfile Warning**: Fixed Next.js workspace root inference when multiple lockfiles exist
  - Added `outputFileTracingRoot: process.cwd()` to explicitly set workspace root
  - Resolves warning: "Next.js inferred your workspace root, but it may not be correct"
  - Location: `next.config.js`

- **Database Pool Double Closure**: Fixed "Called end on pool more than once" error during build
  - Added `poolEnded` flag to prevent multiple pool.end() calls
  - Unified SIGTERM, SIGINT, and beforeExit signal handlers with graceful shutdown function
  - Prevents build errors when multiple shutdown signals are received
  - Location: `src/server/db/index.ts`

### Known Issues

- **@next/swc Version Mismatch Warning**: Next.js 15.5.11 displays warning about mismatched swc version (15.5.7)
  - Root cause: @next/swc-linux-x64-gnu@15.5.11 not yet published to npm registry
  - Latest available version: 15.5.7 (confirmed via npm registry check)
  - Impact: Cosmetic warning only - build completes successfully and application runs normally
  - Resolution: Warning will automatically resolve when Next.js publishes matching swc binaries
  - Workaround: Can be safely ignored or downgrade to Next.js 15.5.7 if warning is concerning
  - Status: Awaiting upstream package publication

### Performance

- **Dynamic Import Optimization**: Converted heavy components to dynamic imports with SSR disabled
  - ChangelogModal: Conditionally rendered only when open
  - QueueSettingsModal: Conditionally rendered only when open
  - FlowFieldBackground: Dynamic import to reduce initial bundle
  - PatternControls: Dynamic import to reduce initial bundle
  - Locations: `src/app/HomePageClient.tsx`, `src/components/EnhancedQueue.tsx`, `src/components/PersistentPlayer.tsx`

## [0.10.20] - 2026-01-29

### Fixed

- **Sacred Triangle Corner Orbs**: Corrected corner orb positions to align with triangle vertices
  - Location: `src/components/visualizers/FlowFieldRenderer.ts`

### Changed

- **Quantum Foam Performance**: Reduced per-frame cost on Firefox with lower element counts, simplified gradients/shadows, and reduced wave resolution
  - Location: `src/components/visualizers/FlowFieldRenderer.ts`
- **Voronoi Performance**: Reused seed buffers, constrained sampling radius, and adapted cell size for smoother rendering
  - Location: `src/components/visualizers/FlowFieldRenderer.ts`
- **Adaptive Visual Quality**: Added dynamic quality throttling based on frame time and scaled heavy patterns (Waves, Starfield, Chaos Vortex, Langton's Ant, Bitfield Matrix, Quantum Resonance, Sacred Triangle, Quantum Foam)
  - Location: `src/components/visualizers/FlowFieldRenderer.ts`
- **Additional Visual Optimizations**: Tuned Fluid, Dragon Curve, and Morse Aurora for lower per-frame cost on Firefox
  - Location: `src/components/visualizers/FlowFieldRenderer.ts`
- **Further Visual Optimizations**: Reduced cost in Fractal, Mandelbrot Spiral, and Menger Sponge using adaptive quality scaling
  - Location: `src/components/visualizers/FlowFieldRenderer.ts`
- **More Visual Optimizations**: Tuned Plasma Storm, Perlin Noise Field, and Superformula for adaptive detail scaling on Firefox
  - Location: `src/components/visualizers/FlowFieldRenderer.ts`
- **Additional Visual Optimizations**: Reduced gradient/shadow load and element counts in Divine Light, Transcendence, and Tree of Life
  - Location: `src/components/visualizers/FlowFieldRenderer.ts`
- **Additional Visual Optimizations**: Scaled Solar Flare, Gothic Thorns, and Phoenix with adaptive detail to reduce gradient/shadow cost
  - Location: `src/components/visualizers/FlowFieldRenderer.ts`
- **API Decryption Modernization**: API modernised to use new decryption methods

## [0.10.19] - 2026-01-29

### Fixed

- **API Health Check Configuration**: Corrected health check URLs to use local development endpoints instead of production
  - Updated `NEXT_PUBLIC_API_HEALTH_URL` and `API_V2_HEALTH_URL` in environment configuration to point to local APIs (127.0.0.1)
  - Resolved "API Down" false positive when developing locally with running API servers
  - Location: `.env`, `.env.local`

## [0.10.18] - 2026-01-28

### Added

- **V2 API Tests**: Added coverage for V2-only search/stream handlers and health status normalization, plus V2 track batch SEO path
  - Location: `src/__tests__/api-search-v2.test.ts`, `src/__tests__/api-stream-v2.test.ts`, `src/__tests__/health-status.test.ts`, `src/__tests__/track-seo.test.ts`

### Changed

- **V2-Only Search & Stream**: `/api/music/search` and `/api/stream` now require V2 (`NEXT_PUBLIC_V2_API_URL` + `BLUESIX_API_KEY`) with no V1 fallback
  - Location: `src/app/api/music/search/route.ts`, `src/app/api/stream/route.ts`
- **Track SEO Metadata via V2**: Track page metadata now fetches from V2 batch endpoint (Starchild fallback only)
  - Location: `src/app/track/[id]/page.tsx`
- **OG Track Previews via V2**: `/api/og` uses V2 track preview for trackId and search hits
  - Location: `src/app/api/og/route.tsx`
- **API Docs Updated**: Reflected V2 routing and OG preview changes
  - Location: `docs/API_ROUTE_USE.md`, `docs/API_USE.md`

### Fixed

- **Health Indicator Parsing**: Header health check now accepts JSON or plain-text statuses like `ok`
  - Location: `src/components/Header.tsx`, `src/utils/healthStatus.ts`

## [0.10.17] - 2026-01-28

### Fixed

- **MobilePlayer Palette Stability**: Ensured palette access happens after initialization and added a robust fallback when extraction fails or returns invalid values
  - Skip extraction for placeholder covers, validate palette shape/ranges, fall back safely on errors
  - Location: `src/components/MobilePlayer.tsx`
- **Auth API Client Errors**: Avoided JSON.parse failures by bypassing rate limiting on auth routes and returning JSON for 429 responses
  - Location: `src/middleware.ts`
- **Streaming Error Recovery**: Added transient 5xx/429/network retry handling with backoff and cache-busting, plus clearer 502/504 user messaging
  - Auto-advance to the next track after repeated stream failures
  - Location: `src/hooks/useAudioPlayer.ts`, `src/contexts/AudioPlayerContext.tsx`

### Changed

- **Service Worker Cache Strategy**: Versioned caches and switched `/_next/static` to network-first with explicit update checks to prevent stale bundles
  - Auto-activate new workers and reload clients on update
  - Location: `public/sw.js`, `src/app/register-sw.tsx`

## [0.10.16] - 2026-01-27

### Changed

- **FlowField Renderer Bottom Patterns Optimization**: Reduced per-frame allocations and math overhead in the lowest listed visuals for smoother Firefox rendering
  - Reused buffers in Sacred Triangle and EM Field; reduced angle divisions and per-frame object creation
  - Optimized Quantum Foam loops with precomputed angle steps and local constants
  - Tightened Gothic Thorns angle math to reduce repeated division
  - Location: `src/components/visualizers/FlowFieldRenderer.ts`

## [0.10.15] - 2026-01-27

### Changed

- **FlowField Renderer GC Trim**: Removed per-frame point array allocations and reused typed buffers for Metatron geometry to improve Firefox stability
  - Replaced dynamic point arrays with cached offsets and reusable buffers
  - Simplified vesica point rendering to avoid temporary arrays
  - Location: `src/components/visualizers/FlowFieldRenderer.ts`

## [0.10.14] - 2026-01-27

### Changed

- **FlowField Renderer Performance Pass**: Reduced per-frame allocations and consolidated audio analysis for smoother rendering (especially in Firefox)
  - Moved static pattern arrays to class-level constants to cut GC churn
  - Single-pass audio band analysis replaces multiple loops
  - Location: `src/components/visualizers/FlowFieldRenderer.ts`

## [0.10.13] - 2026-01-27

### Changed

- **More Reliable Color Extraction**: Reduced fallback usage by adding multi-pass bucket collection with relaxed thresholds for dark/transparent images
  - Secondary pass lowers alpha and lightness thresholds before falling back
  - Added safer referrer policy on image loads to improve CDN compatibility
  - Location: `src/utils/colorExtractor.ts`

## [0.10.12] - 2026-01-27

### Changed

- **Stabilized Mobile Palette Extraction**: Deferred album-art color extraction to idle time and reduced sampling size to avoid playback jank on mobile
  - Added caching and in-flight de-duplication for palette extraction
  - Palette extraction now uses smaller cover images and lower-resolution sampling
  - Guards against stale palette updates when tracks change quickly
  - Location: `src/components/MobilePlayer.tsx`, `src/utils/colorExtractor.ts`

## [0.10.11] - 2026-01-26

### Added

- **Eight New Visual Patterns**: Added diverse new audio-reactive visualizations to FlowFieldRenderer
  - **solarFlare**: Dynamic solar flares radiating from center with pulsing core, secondary flares, and glowing corona
  - **transcendence**: Ethereal flowing streams representing spiritual elevation with layered consciousness and floating particles
  - **treeOfLife**: Sacred geometry visualization with Kabbalistic Tree of Life, 10 Sephiroth spheres, recursive branching, and connection lines
  - **divineLight**: Heavenly light pattern with radiating rays, orbiting particles, cascading lights, and multiple halo effects
  - **gothicThorns**: Dark, spiky gothic pattern with angular spikes, thorn clusters, inner spike rings, and dark aura
  - **sacredTriangle**: Glowing triangle with halo ring, inner triangle, corner orbs, center orb, and outer aura
  - **emField**: Electromagnetic field visualization with field lines, charged particles, orbiting particles, and wave rings
  - **quantumFoam**: Quantum foam visualization with foam cells, virtual particles, energy fluctuations, and quantum connections
  - All patterns are fully audio-reactive and automatically cycle with existing patterns
  - Location: `src/components/visualizers/FlowFieldRenderer.ts`, `src/components/visualizers/flowfieldPatterns/patternIds.ts`

## [0.10.10] - 2026-01-26

### Changed

- **Full-Width Album Cover Gradient**: Mobile player background gradient now uses all three key colors (primary, secondary, accent) across the entire section
  - Gradient spans 0% to 100% with smooth color transitions
  - Replaced hardcoded blue fallback with dynamic color stops using all extracted colors
  - Enhanced color processing for better visual appeal
  - Location: `src/components/MobilePlayer.tsx`

- **Dark Album Cover Support**: Improved color extraction for dark album covers
  - Automatic detection of dark images (average lightness < 30%)
  - Prioritizes brighter pixels from dark covers for better visibility
  - Boosts brightness of extracted colors while preserving hue and saturation
  - Ensures minimum lightness thresholds (40-45%) for all colors in dark images
  - Enhanced vibrancy scoring to favor brighter colors in dark images
  - Location: `src/utils/colorExtractor.ts`

## [0.10.9] - 2026-01-26

### Added

- **Dynamic Color Adaptation from Album Art**: Mobile player color scheme now adapts to each track's album artwork
  - Real-time color extraction from album cover images
  - Automatic color palette generation (primary, secondary, accent colors)
  - All UI elements dynamically colored: control deck, progress bar, buttons, borders, glows, shadows
  - Enhanced color saturation and brightness for more vibrant results
  - Location: `src/components/MobilePlayer.tsx`, `src/utils/colorExtractor.ts`

### Changed

- **Robust Color Extraction Algorithm**: Completely rewritten color extraction system for maximum reliability
  - Color bucketing and vibrancy scoring for better color selection
  - Multiple extraction strategies with automatic fallback
  - Handles edge cases: grayscale, very dark/light images, empty images
  - Always extracts colors - no rejections, always resolves with valid palette
  - Increased sample size from 50x50 to 100x100 pixels for better accuracy
  - Smart color relationships ensure proper hue separation between primary, secondary, and accent
  - Automatic saturation enhancement for low-saturation images
  - Location: `src/utils/colorExtractor.ts`

- **Enhanced Color Visibility**: Made color adaptation effects more noticeable throughout the UI
  - Increased border thickness (1px→2px) with higher opacity
  - Stronger gradients and glow effects on all elements
  - Enhanced play button with thicker border (3px), stronger glow, and shadow
  - Progress bar seeking glow with shadow effects
  - Colored borders around artwork with enhanced radial glow
  - Track info card with colored border and gradient background
  - All hover and active states use extracted colors
  - Location: `src/components/MobilePlayer.tsx`

- **Removed Fallback Colors**: Component now always uses extracted colors
  - No null checks or conditional fallbacks
  - Default palette used only during initial load
  - All UI elements consistently use palette colors
  - Location: `src/components/MobilePlayer.tsx`

## [0.10.8] - 2026-01-26

### Changed

- **Mobile Player Compact Layout**: Significantly reduced vertical spacing throughout mobile player to prevent Safari browser UI overlap
  - Reduced main container padding (top: 24px→16px, bottom: 36px→20px) to account for Safari's UI components
  - Compacted drag handle, header, and content areas with reduced padding
  - Reduced gap between artwork and track info from 6 to 4
  - Artwork max width reduced from 330px to 300px for better fit
  - Track info card: reduced padding (py-3→py-2), smaller text sizes (title: 2xl→xl, artist: sm→xs, album: xs→10px)
  - Control section moved higher with reduced margins (mt-1→mt-0.5, pb-8px→pb-4px)
  - Larger playback control buttons: skip buttons (h-6→h-8), play/pause button (64px→72px), play/pause icons (h-7→h-8)
  - Optimized for newer Safari models with bottom UI bars
  - Location: `src/components/MobilePlayer.tsx`

## [0.10.7] - 2026-01-26

### Changed

- **Mobile Player UI Refinement**: Enhanced mobile player controls with refined color palette and compact design
  - Updated color scheme: vibrant gradient colors (#ff6b6b, #4ecdc4, #ffd93d, #6bcf7f) replacing CSS variables
  - Reduced spacing and padding throughout controls for more compact layout
  - Smaller icon sizes (h-4 w-4 for controls, h-6 w-6 for skip buttons, h-7 w-7 for play/pause)
  - Play button reduced from 80px to 64px with new gradient (red → yellow → teal)
  - Progress bar height reduced from 2.5 to 1.5 with refined gradient and smaller thumb (14-18px)
  - Updated control deck styling with gradient borders and refined backdrop blur
  - Improved safe area handling with adjusted padding calculations
  - Location: `src/components/MobilePlayer.tsx`

## [0.10.6] - 2026-01-26

### Added

- **Queue Transition Regression Tests**: Added coverage for auto-advance on track end and manual next to prevent playback regressions
  - Location: `src/__tests__/useAudioPlayer.test.ts`

## [0.10.5] - 2026-01-26

### Changed

- **Mobile Fullscreen Player Redesign**: Reimagined the fullscreen mobile player with framed artwork, an editorial track card, and a structured control deck while keeping all features accessible
  - Location: `src/components/MobilePlayer.tsx`

## [0.10.4] - 2026-01-26

### Fixed

- **Queue Auto-Advance**: Unified auto-play signaling on track transitions to ensure the next track starts after end/skip and reduce repeated play taps
  - Location: `src/hooks/useAudioPlayer.ts`

## [0.10.3] - 2026-01-26

### Fixed

- **iOS Background Playback**: Disabled Web Audio on iOS Safari to keep music playing when the browser is minimized
  - Location: `src/utils/audioContextManager.ts`, `src/hooks/useEqualizer.ts`, `src/components/Equalizer.tsx`

## [0.10.2] - 2026-01-26

### Fixed

- **Mobile Volume Control**: Volume slider now applies changes reliably during touch and updates the live playback output
  - Location: `src/components/MobilePlayer.tsx`, `src/hooks/useAudioPlayer.ts`, `src/utils/audioContextManager.ts`

## [0.10.1] - 2026-01-26

### Changed

- **Haptics Tuning**: Smoothed mobile haptics with gentler patterns and paced feedback to reduce jitter
  - Location: `src/utils/haptics.ts`

## [0.10.0] - 2026-01-26

### Added

- **Admin Role Support**: Added `admin` boolean column with default false and wired it into session payloads for authorization
  - Location: `src/server/db/schema.ts`, `src/server/auth/config.ts`, `drizzle/0017_admin_flag.sql`, `drizzle/meta/0017_snapshot.json`

- **First User Auto-Admin**: The first registered user is automatically promoted to admin
  - Location: `src/server/auth/config.ts`

- **Admin APIs**: New TRPC router for listing users and toggling admin access with a self-demotion guard
  - Location: `src/server/api/routers/admin.ts`, `src/server/api/root.ts`

- **Admin Console Page**: New `/admin` page for viewing users, profile links, and managing admin status
  - Location: `src/app/admin/page.tsx`

### Changed

- **Admin Navigation**: Added admin entry in the menu and an icon shortcut near the server/Vercel badge for quick access
  - Location: `src/components/HamburgerMenu.tsx`, `src/components/Header.tsx`

## [0.9.25] - 2026-01-22

### Fixed

- **Player Disappearing When Queue Ends**: Fixed critical bug where player would disappear when queue finished
  - **Root Cause**: When queue ran out, `handleTrackEnd` would clear the queue and stop playback, causing player UI to disappear
  - **Previous Behavior**: Queue finishes → player clears → playback stops → player disappears
  - **New Behavior**: Queue finishes → auto-generates smart tracks → playback continues seamlessly → player remains visible
  - **Implementation**:
    - Modified `handleTrackEnd` to check for auto-queue settings before clearing queue
    - When queue is about to end, automatically generates smart tracks based on current track
    - Only clears queue and stops if auto-queue is disabled or fails to generate tracks
  - **Location**: `src/hooks/useAudioPlayer.ts:287-385`

- **Audio Connection Release on Visualizer Toggle**: Fixed playback refresh when toggling visualizer UI
  - **Root Cause**: Components were releasing audio connections in cleanup effects when unmounting
  - **Impact**: Toggling visualizer on/off or hiding/showing UI would interrupt playback
  - **Fix**: Removed `releaseAudioConnection` calls from cleanup effects in:
    - `useAudioVisualizer` hook cleanup
    - `FlowFieldBackground` component cleanup
    - `useEqualizer` hook cleanup
  - **Rationale**: Audio connections are managed by `audioContextManager` with ref counting and should persist across component lifecycle
  - **Location**: `src/hooks/useAudioVisualizer.ts:175-188`, `src/components/FlowFieldBackground.tsx:100-109`, `src/hooks/useEqualizer.ts:343-355`

- **Audio Element Reference Stability**: Fixed audio refresh when toggling hideUI button
  - **Root Cause**: AudioPlayerContext value was being recreated on every render, causing audio element reference to change
  - **Impact**: Toggling "Hide UI" button would cause audio-related effects to re-run, potentially interrupting playback
  - **Fix**:
    - Added stable ref (`stableAudioElementRef`) to maintain consistent audio element reference
    - Memoized entire context value object to prevent unnecessary recreations
    - Excluded `audioElement` from dependency array since it's maintained via stable ref
  - **Location**: `src/contexts/AudioPlayerContext.tsx:501-511, 513-613`

### Added

- **Automatic Smart Queue Generation**: Implemented proactive smart track generation when queue is running low
  - **Feature**: Automatically generates smart tracks when queue drops to or below `autoQueueThreshold` (default: 3 tracks)
  - **Behavior**:
    - Monitors queue length during playback via `useEffect`
    - When remaining tracks ≤ threshold, triggers smart track generation
    - Adds generated tracks to end of queue to keep playback continuous
    - Prevents duplicate generation within 60 seconds for same seed track
  - **Settings**: Respects `autoQueueEnabled`, `autoQueueThreshold`, and `autoQueueCount` from user preferences
  - **Fallback**: If proactive generation doesn't happen, `handleTrackEnd` generates tracks when last track finishes
  - **Location**: `src/hooks/useAudioPlayer.ts:387-466`

### Changed

- **Repository Link**: Updated homepage link from GitLab to GitHub
  - Changed "View on GitLab" button to "View on GitHub"
  - Updated URL from `https://gitlab.com/soulwax/bluesix-library` to `https://github.com/soulwax/bluesix-library`
  - Replaced GitLab logo SVG with GitHub octocat logo SVG
  - **Location**: `src/app/HomePageClient.tsx:635-668`

- **API Health Check URL**: Updated health check to use dedicated `NEXT_PUBLIC_API_HEALTH_URL` environment variable
  - **Previous**: Constructed health URL from `NEXT_PUBLIC_API_URL + "/health"`
  - **New**: Uses `NEXT_PUBLIC_API_HEALTH_URL` environment variable directly (falls back to constructed URL if not set)
  - **Configuration**: Added `NEXT_PUBLIC_API_HEALTH_URL` to client env schema
  - **Location**: `src/env.js:37, 57`, `src/components/Header.tsx:47-53`

- **Dual API Health Monitoring**: Added monitoring for both API v1 and v2 health endpoints
  - **New Environment Variable**: `API_V2_HEALTH_URL` for secondary API health check
  - **Three-State Status**: Health indicator now shows three states:
    - 🟢 **Green "Api Healthy"**: Both APIs return `status: "ok"`
    - 🟡 **Yellow "Api Degraded"**: APIs respond but one returns `status: "degraded"` or `"unhealthy"`
    - 🔴 **Red "API Down"**: HTTP 400-500 errors or network failures
  - **Non-Clickable Indicator**: Removed link functionality, now shows status-only indicator
  - **Parallel Checks**: Both endpoints checked simultaneously every 30 seconds
  - **Configuration**: Added `API_V2_HEALTH_URL` to client env schema
  - **Location**: `src/env.js:37-38, 57-58`, `src/components/Header.tsx:44-108`

## [0.9.24] - 2026-01-22

### Fixed

- **Social Media OG Image Generation**: Migrated to backend preview API for reliable rich previews
  - **Previous Issue**: Frontend OG route had edge runtime timeouts and limited canvas capabilities
  - **New Architecture**: Frontend now proxies to backend's native canvas-based preview generator
  - **Backend API**: Uses robust `canvas` package (1200×600 PNG with album art, track info, darkfloor branding)
  - **Performance**:
    - Track IDs: Direct 302 redirect to backend GET endpoint (zero frontend processing)
    - Search queries: Proxy converts GET → POST to backend (supports query-based previews)
    - No more edge runtime timeouts (backend handles image generation)
    - Better image quality (native canvas vs Next.js ImageResponse)
  - **Fallback**: If backend unavailable, falls back to frontend generation with 5s API / 2s cover timeouts
  - **Env**: Uses `NEXT_PUBLIC_V2_API_URL` (local: http://127.0.0.1:3333/, prod: https://darkfloor.one/)
  - **Endpoints**: `/api/og?trackId=123` → Backend `/api/track/123/preview`, `/api/og?q=search` → Backend POST
  - Locations: `src/app/api/og/route.tsx`, `src/app/page.tsx`, `src/app/track/[id]/page.tsx`

- **Show GUI Button Playback Restart**: Fixed audio playback restarting when clicking "Show UI Again" button
  - **Root Cause 1**: UIWrapper returned `null` when `hideUI` was true, causing complete unmount of page components
  - **Root Cause 2**: When components remounted, HomePageClient's useEffect re-ran and re-processed URL parameters (trackId, albumId, query)
  - **Impact**: Showing UI again after hiding it called `player.clearQueue()` and `player.playTrack()`, restarting playback
  - **Previous Behavior**:
    - Hide UI → page components unmount → refs reset to null
    - Show UI → page components remount → useEffect re-runs → playback restarts from beginning
  - **Fix**: Changed UIWrapper to use CSS `hidden` class instead of returning `null`, preserving component state and refs
  - Location: `src/components/UIWrapper.tsx`

- **Show GUI Button Context Recreation**: Fixed audio player context recreating unnecessarily when toggling UI visibility
  - **Root Cause**: `hideUI` and `showMobilePlayer` were incorrectly included in the AudioPlayerContext useMemo dependency array
  - **Impact**: Clicking "Show GUI / Hide UI" button no longer triggers full context recreation and component re-renders
  - **Performance**: Reduced unnecessary re-renders across all components consuming the audio player context
  - **Fix**: Removed `hideUI` and `showMobilePlayer` from dependency array as they are UI-only state
  - Location: `src/contexts/AudioPlayerContext.tsx:567-613`

### Improved

- **Settings Page Functionality**: Implemented full backend integration for settings controls
  - **Auto Queue Settings**: Added slider controls for queue threshold (1-10 tracks) and tracks to add (1-20 tracks)
  - **Theme Switcher**: Added dark/light theme selector in Visual section
  - **Backend Mutations**: Added missing fields to `updatePreferences` mutation (autoQueueThreshold, autoQueueCount, smartMixEnabled, similarityPreference)
  - **Field Validation**: All settings now properly validated with Zod schemas (number ranges, enum values)
  - **Settings Persistence**: All UI controls now correctly save to database for authenticated users
  - **UI Polish**: Updated descriptions to be more concise and user-friendly
  - Locations: `src/app/settings/page.tsx`, `src/server/api/routers/music.ts`

## [0.9.23] - 2026-01-22

### Fixed

- **Player Button Refresh Bug**: Fixed page refresh when clicking "Hide UI to enjoy visuals" button
  - **Root Cause**: All buttons in Player component were missing `type="button"` attribute, defaulting to `type="submit"` which triggers form submission/navigation
  - **Impact**: All 15 player buttons now explicitly set `type="button"` to prevent unintended page refreshes
  - **Buttons Fixed**: Hide UI, Add to playlist, Favorite, Shuffle, Previous, Skip backward, Play/Pause, Skip forward, Next, Repeat, Mute, Queue, Equalizer, Visualizer, Pattern controls
  - Location: `src/components/Player.tsx`

### Improved

- **Test Infrastructure**: Comprehensive testing environment setup
  - **localStorage Mock**: Full implementation with getItem, setItem, removeItem, clear, length, key methods
  - **AbortSignal.timeout**: Polyfill for Node.js compatibility (Node doesn't support AbortSignal.timeout natively)
  - **Global Fetch Mock**: Handles API calls, CDN resources (emojis, fonts), external services
  - **AudioContext Mock**: Web Audio API mock for equalizer and visualizer tests
  - **Audio Element Mock**: DOM-based mock with proper HTMLAudioElement property definitions
  - **Service Worker Mock**: Background playback keep-alive testing support
  - Location: `src/test/setup.ts`

- **Test Stability**: Updated audio player tests to use DOM-based mocks
  - Fixed test failures caused by trying to append non-DOM objects to document.body
  - Tests now use proper HTMLAudioElement mocks that can be appended to DOM
  - Locations: `src/__tests__/useAudioPlayer.stability.test.ts`, `src/__tests__/player.integration.stability.test.ts`, `src/__tests__/playback-rate.stability.test.ts`

## [0.9.22] - 2026-01-22

### Fixed

- **Player Stability**: Fixed critical issues causing player to disappear and page reloads after 2-3 songs
  - **Error Boundary**: Now recovers gracefully with "Try Again" instead of forcing page reload (`window.location.reload()` removed)
  - **Error Handling**: Fixed empty catch blocks that silently masked failures in repeat-one mode and service worker keep-alive
  - **State Sync**: Fixed infinite interval recreation loop by removing `isPlaying` from sync effect dependencies (now uses ref)
  - **Memory Leaks**: Fixed service worker keep-alive interval orphaning with proper ref-based cleanup
  - **Race Conditions**: Removed arbitrary 100ms timeout in play/pause operations, now uses immediate flag reset
  - **Null Checks**: Added state updates when audio element is null to prevent UI/audio desync
  - Locations: `src/components/ErrorBoundary.tsx`, `src/hooks/useAudioPlayer.ts`

- **Playback Rate Stability**: Fixed audio speeding up sporadically during playback on mobile
  - **Faster Detection**: Reduced playback rate enforcement interval from 10s to 1s (users hear drift for max 1s instead of 10s)
  - **Resume Enforcement**: Added playback rate enforcement after all resume operations (visibility change, pageshow, resume events)
  - **Better Logging**: Added detailed logging when playback rate changes to identify root causes
  - **Proactive Enforcement**: Enforces playback rate immediately after play() operation, not just reactively
  - Location: `src/hooks/useAudioPlayer.ts`

### Added

- **Stability Tests**: Comprehensive test suite to prevent regressions
  - ErrorBoundary tests (7 tests, all passing)
  - useAudioPlayer stability tests (race conditions, state sync, memory leaks)
  - Player integration tests (multi-track playback, repeat modes, background playback)
  - Location: `src/__tests__/*stability.test.{ts,tsx}`

## [0.9.21] - 2026-01-20

### Added

- **OG Image Route - Track ID & Query Support**: Social media preview images now support track IDs and search queries
  - **Track ID Support**: Accepts `trackId` parameter to fetch and display specific track information
  - **Query String Support**: Accepts `q` parameter to search for tracks and display the first result
  - **API Integration**: Fetches track data via `/api/track/[id]` or `/api/music/search` before generating image
  - **Fallback Support**: Falls back to direct URL parameters (title, artist, etc.) if trackId/query not provided or fetch fails
  - Location: `src/app/api/og/route.tsx`

- **Enhanced Mobile Queue**: Complete feature parity with desktop queue
  - **Search Functionality**: Search queue by track title or artist name with real-time filtering
  - **Multi-Select**: Long-press to select tracks, tap to toggle selection, bulk remove selected items
  - **Drag-to-Reorder**: Swipe up/down on drag handle to reorder tracks in queue
  - **Play from Here**: Tap any track or play button overlay to start playback from that position
  - **Remove Individual Tracks**: Remove button on each track (except currently playing)
  - **Smart Tracks Sections**: Visual organization with sections for "Now Playing", "Next in queue", and "Smart tracks"
  - **Save as Playlist**: Save entire queue as a playlist (authenticated users only)
  - **Settings Modal**: Configure smart tracks count and similarity level preferences
  - **Total Duration Display**: Shows total queue duration and search result counts
  - **Visual Feedback**: Selected tracks highlighted, active track indicator, smart track accent bar
  - **Loading States**: Loading indicators for smart tracks operations
  - **Haptic Feedback**: Tactile feedback for all interactions (selection, removal, reordering)
  - Location: `src/components/MobilePlayer.tsx`

### Changed

- **OG Image Route Optimization**: Improved performance and timeout handling for social media previews
  - **Aggressive Timeouts**: Reduced API fetch timeout to 2s, cover image timeout to 1s
  - **Total Time Check**: Redirects to static image if data fetch takes >2.5s (leaving ~2.5s for image generation)
  - **Cover Image Limits**: Reduced max cover image size from 1MB to 500KB for faster processing
  - **Early Exit**: Skips cover image if fetch takes >1s or image is too large
  - **Performance Logging**: Added detailed timing logs for debugging timeout issues
  - **Error Handling**: Graceful fallbacks at each step to prevent edge runtime timeouts
  - Location: `src/app/api/og/route.tsx`

### Fixed

- **Mobile Volume Controls**: Fixed janky haptics and volume not working
  - **Volume Not Working**: Volume changes now immediately apply to audio element during dragging for responsive feedback
  - **Janky Haptics**: Reduced haptic frequency (50ms interval, threshold 5) and optimized haptic triggers
  - **Local State Management**: Uses local state during dragging (like progress bar) to reduce re-renders
  - **Visual Feedback**: Added glow effect and thumb scaling during volume adjustment
  - **Fallback Audio Element**: Added fallback to find audio element from DOM if context reference unavailable
  - Location: `src/components/MobilePlayer.tsx`

## [0.9.20] - 2026-01-20

### Added

- **Static OG Image**: New pre-generated Open Graph social preview image for faster loading
  - **Design**: Dark background (#0b1118), Emily the Strange logo, gradient title, minimal aesthetic
  - **Dimensions**: 1200×630px optimized for social media platforms
  - **Generator Script**: `scripts/generate-og-image.js` for regenerating the image
  - Location: `public/og-image.png`

### Changed

- **OG Image Route Optimization**: Default social previews now use static image with redirect
  - **Before**: Dynamically generated JSX image on every request (slower, no caching)
  - **After**: 302 redirect to `/og-image.png` (instant, CDN-cacheable)
  - **Track Shares**: Still generate dynamic mini-player cards with album art
  - **Impact**: Faster social preview loading for homepage/general links
  - Location: `src/app/api/og/route.tsx`

### Fixed

- **SmoothSlider Import Bug**: Fixed non-existent `hapticSlider` function import
  - Changed to `haptic("sliderTick")` for proper haptic feedback during slider drag
  - Location: `src/components/SmoothSlider.tsx`

- **Unused Variables Cleanup**: Removed dead code from slider components
  - Removed unused `activeDragBand` state from Equalizer
  - Removed unused `useTransform` import and `thumbScale` variable from SmoothSlider
  - Locations: `src/components/Equalizer.tsx`, `src/components/SmoothSlider.tsx`

## [0.9.19] - 2026-01-20

### Added

- **SmoothSlider Component**: New reusable slider component for consistent slider UX across the app
  - **Dual Orientation**: Supports both horizontal and vertical slider layouts
  - **Size Variants**: Small, medium, and large presets with configurable track and thumb sizes
  - **Haptic Feedback**: Built-in intelligent haptic feedback with configurable intervals
  - **Spring Animations**: Smooth Framer Motion spring-based animations
  - **Glow Effects**: Optional visual glow during interaction
  - **Accessibility**: Full ARIA support with customizable labels and value text
  - **Touch Optimized**: Native touch event handling for mobile devices
  - Location: `src/components/SmoothSlider.tsx`

- **New Haptic Patterns**: Extended haptic feedback system with slider-specific patterns
  - `sliderTick` - Subtle tick feedback during slider movement
  - `sliderEnd` - Confirmation feedback when releasing slider
  - `scrub` - Ultra-light feedback for scrubbing interactions
  - `boundary` - Double-tap feedback when hitting min/max boundaries
  - Location: `src/utils/haptics.ts`

- **New Spring Animation Presets**: Added slider-optimized spring configurations
  - `slider` - High stiffness (600) for responsive slider fill animations
  - `sliderThumb` - Extra responsive (800) thumb animations
  - `scrub` - Ultra-responsive (1000) scrubbing animations
  - `gestureRelease` - Natural gesture release with moderate stiffness (400)
  - Location: `src/utils/spring-animations.ts`

### Changed

- **Equalizer Sliders**: Completely redesigned vertical EQ sliders with custom implementation
  - **Custom VerticalEqSlider**: Replaced native HTML range inputs with Framer Motion-based draggable component
  - **Enhanced Visual Feedback**: Added glow effects, scale animations on hover/drag, and gradient fills
  - **Improved Haptics**: Integrated new `hapticSliderContinuous()` for smooth feedback during adjustment
  - **Spring Animations**: All slider movements now use spring physics for natural feel
  - **Pulse Animation**: Active drag state shows pulsing ring effect on thumb
  - Location: `src/components/Equalizer.tsx`

- **Mobile Player Progress Bar**: Enhanced seek slider with improved touch experience
  - **Larger Touch Targets**: Progress bar height increased from 2px to 2.5px
  - **Dynamic Thumb Scaling**: Thumb grows from 18px to 24px during active seek
  - **Glow Effect**: Added blur glow effect behind progress bar during seeking
  - **Pulse Animation**: Thumb shows pulsing ring animation while dragging
  - **Animated Time Display**: Current/remaining time scales up slightly during seek
  - **Continuous Haptics**: Integrated `hapticSliderContinuous()` for tactile feedback
  - Location: `src/components/MobilePlayer.tsx`

- **Mobile Player Volume Slider**: Improved volume control UX
  - **Thicker Track**: Track height increased to 1.5px for better visibility
  - **Spring Animations**: Fill and thumb now animate with spring physics
  - **Hover/Tap Effects**: Added scale animations on thumb interaction
  - **Continuous Haptics**: Volume changes trigger continuous haptic feedback with boundary detection
  - **Selection Haptic**: Initial touch triggers selection haptic pattern
  - Location: `src/components/MobilePlayer.tsx`

- **Haptic Feedback Utilities**: Enhanced haptic API with new functions
  - `hapticThrottled()` - Throttled haptic calls to prevent vibration spam
  - `hapticSliderContinuous()` - Intelligent continuous feedback with tick threshold and boundary detection
  - `hapticSliderEnd()` - Cleanup function to reset slider state and provide end feedback
  - `hapticScrub()` - Ultra-throttled (30ms) scrub feedback for rapid interactions
  - Location: `src/utils/haptics.ts`

## [0.9.18] - 2026-01-19

### Changed

- **Bluesix API v1.0.0 Compatibility**: Updated frontend to handle breaking changes in Bluesix API v1.0.0
  - **Mode Parameter Update**: Changed default mode from `"normal"` to `"balanced"` (breaking change in API)
    - The `"normal"` mode is no longer accepted by the API
    - All similarity level mappings now use `"balanced"` as the default instead of `"normal"`
  - **Enhanced Response Format**: Updated response type handling to support new API v1.0.0 fields
    - Added support for `foundSongs` (required) - Number of songs successfully found
    - Added support for `songResults` (required) - Detailed results for each input song
    - Added support for `seedQuality` (optional) - Seed quality analysis metrics
    - Added support for `warnings` (optional) - Warning messages for partial failures
  - **Improved Error Handling**: Added logging for API warnings and partial failures
    - Logs warnings when present in API response
    - Logs when `foundSongs < inputSongs` to detect partial song matching failures
  - **Backward Compatibility**: All new fields are optional in type definitions, ensuring graceful degradation
  - **Impact**: Frontend is now fully compatible with Bluesix API v1.0.0 breaking changes
  - Locations:
    - `src/server/api/routers/music.ts` (getSimilarTracks procedure)

## [0.9.17] - 2026-01-19

### Added

- **Share Button on All Track Cards**: Added share button next to heart (favorite) button on every song card
  - **Starchild ID-Based Sharing**: Share URLs use `track.deezer_id` when available, falling back to `track.id`
  - **Consistent Placement**: Share button positioned immediately after heart button on all card types
  - **Always Visible**: Share button is now always visible (removed conditional rendering restrictions)
  - **Universal Support**: Implemented across all track card components (TrackCard, EnhancedTrackCard, SwipeableTrackCard)
  - **Impact**: Easy sharing of tracks with Starchild ID-based URLs for reliable track identification
  - Locations:
    - `src/components/TrackCard.tsx`
    - `src/components/EnhancedTrackCard.tsx`
    - `src/components/SwipeableTrackCard.tsx`

- **Loading Spinner for Smart Tracks**: Added visual loading indicator while smart tracks are being fetched
  - **Queue Loading State**: Shows spinner in "Smart tracks" section header and content area during fetch
  - **Button State**: Share button shows spinner icon and is disabled during loading
  - **User Feedback**: Displays "Finding similar tracks..." message when loading with no existing tracks
  - **State Management**: Added `isLoading` property to `SmartQueueState` interface
  - **Impact**: Clear visual feedback when smart tracks are being generated, improving user experience
  - Locations:
    - `src/types/index.ts` (SmartQueueState interface)
    - `src/hooks/useAudioPlayer.ts` (loading state management)
    - `src/components/EnhancedQueue.tsx` (loading UI)

### Changed

- **Enhanced SEO Embeds for Discord**: Redesigned Open Graph images for better Discord embed previews
  - **Prominent Album Cover**: Full-size square album art (570×570px) on the left side of embed
  - **Improved Typography**: Larger, bolder text with better hierarchy (title: 56px, artist: 36px, album: 28px)
  - **Cleaner Layout**: Optimized spacing and layout for Discord's 1200×630px embed format
  - **Better Readability**: Removed overlays that could interfere with album art visibility
  - **Embedded Images**: Album covers are embedded directly in generated images via base64 encoding
  - **Branding**: Updated to "Play now on Starchild Music" for clearer call-to-action
  - **Impact**: Rich, beautiful previews on Discord with album art and song info clearly visible
  - Locations:
    - `src/app/api/og/route.tsx` (OG image generation)
    - `src/app/page.tsx` (metadata description enhancement)

## [0.9.16] - 2026-01-19

### Added

- **Health Check Request Logging**: Added comprehensive development-mode logging for health check requests
  - **Request Details**: Logs method, URL, origin, user-agent, referer, and client IP
  - **Response Details**: Logs status, response time, database check result, and memory usage
  - **Error Logging**: Detailed error messages for database check failures
  - **Impact**: Easier debugging of health check issues and CORS problems during development
  - Location: `src/app/api/health/route.ts`

- **CORS Configuration Documentation**: Created comprehensive documentation for API CORS setup
  - **Detailed Guide**: Complete CORS configuration request document with code examples
  - **Quick Reference**: Concise prompt for quick copy-paste requests
  - **Implementation Examples**: Express.js, FastAPI, and Nginx configuration examples
  - **Testing Instructions**: Browser console and cURL test commands
  - **Impact**: Clear instructions for backend team to configure CORS properly
  - Locations:
    - `docs/CORS_CONFIGURATION_REQUEST.md`
    - `docs/CORS_PROMPT.txt`

### Changed

- **Environment Configuration**: Development mode now loads from `.env` instead of `.env.development`
  - **Unified Configuration**: Single `.env` file for development, simplifying environment management
  - **Consistent Behavior**: Both `npm run dev` and SSL certificate generation use the same file
  - **Impact**: Easier development setup with a single source of truth for environment variables
  - Locations:
    - `scripts/server.js`
    - `scripts/generate-ssl-cert.js`

- **Header API Health Status**: Enhanced API health monitoring in desktop header
  - **Periodic Checks**: Health status now updates every 30 seconds automatically
  - **Improved Error Handling**: Better error logging and status detection
  - **CORS Mode**: Explicitly sets `mode: "cors"` for health check requests
  - **Text Update**: Changed "API OK" to "Api Healthy" for consistency
  - **Impact**: More reliable and visible API health monitoring
  - Location: `src/components/Header.tsx`

- **Header Navigation Authentication**: Improved authentication flow for header navigation links
  - **Library & Playlists**: Now redirect to Discord OAuth2 login (`/api/auth/signin`) when not authenticated
  - **Consistent Behavior**: All protected routes now have consistent authentication handling
  - **Impact**: Better user experience with clear authentication prompts
  - Location: `src/components/Header.tsx`

### Fixed

- **Content-Security-Policy Violation**: Added `https://api.starchildmusic.com` to CSP `connect-src` directive
  - **Health Check Access**: Allows frontend to make health check requests to the API
  - **CORS Compatibility**: Works in conjunction with CORS configuration for proper cross-origin requests
  - **Impact**: Health check badge now works correctly without CSP violations
  - Location: `src/middleware.ts`

- **HTML Nesting Error**: Fixed invalid `<a>` tag nesting in header component
  - **Structure Fix**: Moved API health badge link outside of logo link to prevent nested anchors
  - **Hydration Fix**: Resolves React hydration error that was breaking client-side interactivity
  - **Impact**: Eliminates console errors and ensures proper HTML structure
  - Location: `src/components/Header.tsx`

## [0.9.15] - 2026-01-19

### Added

- **Auto-Play for Shared Search Links**: Search query links now automatically play the first result
  - **URL Format**: Links like `https://starchildmusic.com/?q=jetlag+jenny+45ACID` auto-play first match
  - **Smart Detection**: Only triggers for URL parameter searches, not manual user searches
  - **One-Time Playback**: Uses ref-based tracking to prevent re-triggering on re-renders
  - **Graceful Fallbacks**: No auto-play if search fails or returns empty results
  - **Mobile Integration**: Includes haptic feedback on successful auto-play
  - **Impact**: Shared discovery links provide instant playback, creating a seamless listening experience
  - Location: `src/app/HomePageClient.tsx`

## [0.9.14] - 2026-01-17

### Added

- **Background Playback Persistence**: Enhanced audio playback to continue when app goes to background or phone locks
  - **Service Worker Keep-Alive**: Pings service worker every 25 seconds during playback to prevent page suspension
  - **Visibility Change Handlers**: Detects when page is hidden/shown and auto-resumes playback if paused unexpectedly
  - **Page Lifecycle API**: Handles freeze/resume events for better mobile browser support
  - **Audio Element Configuration**: Added `preload="auto"` and `playsinline` attributes for optimal mobile playback
  - **WebKit-Specific Handlers**: Special handling for iOS Safari page hide/show events
  - **Impact**: Music continues playing when switching apps, locking phone, or backgrounding the browser
  - Locations:
    - `src/hooks/useAudioPlayer.ts` (visibility handlers, keep-alive interval)
    - `public/sw.js` (KEEP_ALIVE message handler)
    - `public/manifest.json` (scope and prefer_related_applications)

- **Track Sharing with Rich Previews**: Created dedicated share routes with SEO metadata
  - **Starchild ID-Based URLs**: All track sharing now uses `/track/{id}` format instead of current page URL
  - **Rich Social Media Previews**: Album art, track title, artist, and album shown in link previews
  - **SEO Metadata**: OpenGraph and Twitter Card tags for optimal social sharing
  - **Dynamic Track Routes**: Created `/track/[id]` page with server-side metadata generation
  - **Auto-Redirect**: Share links redirect to `/?track={id}` to auto-play the track
  - **Impact**: Shareable links look professional on Discord, Twitter, Facebook with album artwork
  - Locations:
    - `src/app/track/[id]/page.tsx` (new route with metadata)
    - `src/components/TrackCard.tsx`
    - `src/components/EnhancedTrackCard.tsx`
    - `src/components/SwipeableTrackCard.tsx`
    - `src/components/TrackContextMenu.tsx`

- **Visual Mini Player Design in OG Images**: Enhanced social media preview cards to look like interactive music players
  - **Player-Style Layout**: Preview cards now display as a mini player interface with album art, track info, play button, and progress bar
  - **Dynamic Progress Bar**: Shows a simulated playback position at 42% with gradient accent colors
  - **Duration Display**: Shows current position and total track duration (e.g., "1:23 / 3:24")
  - **Play Button**: Large circular accent-colored play button for visual emphasis
  - **Compact Card Design**: Player card (1040px wide) with rounded corners, subtle glow, and dark theme
  - **Impact**: Shared links look more interactive and music-focused, clearly indicating they're playable tracks
  - Locations:
    - `src/app/api/og/route.tsx` (redesigned OG image generator)
    - `src/app/track/[id]/page.tsx` (passes duration parameter to OG image)

### Changed

- **Complete Rebrand**: Rebranded from darkfloor.art to Starchild Music (starchildmusic.com)
  - **Package Name**: Updated npm package name to `starchildmusic`
  - **Domain References**: Changed all URLs from `darkfloor.art` to `starchildmusic.com`
  - **UI Branding**: Updated all visible text, logos, and metadata
  - **Service Worker**: Cache names updated to `starchildmusic-*`
  - **PWA Manifest**: App name changed to "Starchild Music - Music Streaming Platform"
  - **SEO & Metadata**: Updated all OpenGraph, Twitter Card, and meta tags
  - **Impact**: Consistent branding across the entire application
  - Locations:
    - `package.json` (name, homepage, keywords)
    - `public/manifest.json` (app name, short_name)
    - `public/sw.js` (cache names)
    - `src/app/layout.tsx` (metadata)
    - `src/app/page.tsx` (metadata)
    - `src/components/Header.tsx`
    - `src/components/HamburgerMenu.tsx`
    - `src/components/WelcomeHero.tsx`
    - `src/components/DynamicTitle.tsx`
    - `src/app/license/page.tsx`
    - `src/app/api/og/route.tsx`
    - `src/utils/getBaseUrl.ts`
    - `src/styles/globals.css`
    - `ecosystem.config.cjs`
    - `scripts/server.js`
    - `README.md`
    - `CLAUDE.md`

- **PWA Icons**: Updated icon generation to use refined branding image
  - **Source Image**: Changed to `emily-the-strange-raw.png` for cleaner icon appearance
  - **Platform Compatibility**: Better adaptation to iOS rounded squares and Android adaptive icons
  - **Impact**: App icon looks more professional on all mobile platforms
  - Location: `scripts/generate-pwa-icons.cjs`

## [0.9.13] - 2026-01-17

### Added

- **Mobile Queue Access**: Added a queue button on the mini player and smart actions in the queue header
  - **Impact**: Faster, accessible queue access on mobile
  - Locations:
    - `src/components/MiniPlayer.tsx`
    - `src/components/MobilePlayer.tsx`
    - `src/components/PersistentPlayer.tsx`

### Fixed

- **Smart Tracks Recovery**: Added fallback recommendation routes (Last.fm similar + Spotify search)
  - **Impact**: Smart queue rarely returns empty results
  - Location: `src/server/api/routers/music.ts`

- **Smart Queue Actions**: Unified smart-track actions with feedback in the queue UI
  - **Impact**: Clear success/empty/error state feedback
  - Location: `src/components/EnhancedQueue.tsx`

### Changed

- **Bluesix Env Alias**: Support `BLUESIX_PUBLIC_API_URL` for the Bluesix base URL
  - **Impact**: Easier env configuration across environments
  - Location: `src/services/bluesix.ts`

## [0.9.12] - 2026-01-17

### Fixed

- **Smart Queue Recommendations**: Smart tracks now use Bluesix's Last.fm + Starchild conversion flow
  - **Impact**: Auto-queue pulls richer recommendations with Starchild IDs
  - Locations:
    - `src/server/api/routers/music.ts`
    - `src/contexts/AudioPlayerContext.tsx`
    - `src/services/bluesix.ts`

- **tRPC Preferences Tests**: Added coverage for smart queue defaults and preference persistence
  - **Impact**: Validates server preferences behavior
  - Location: `src/__tests__/trpc.music.test.ts`

- **Mobile Search Clear Behavior**: Ensured clearing a non-empty search reliably returns to `/`
  - Uses previous query tracking to avoid skipping the first clear
  - **Impact**: Search URL clears consistently on mobile
  - Location: `src/components/MobileHeader.tsx`

- **Search Clear Regression Test**: Stabilized test coverage for clear behavior
  - **Impact**: Prevents regressions in search clear routing
  - Location: `src/__tests__/MobileHeader.test.tsx`

- **Share URL Source**: Reverted track sharing to use the current page URL
  - **Impact**: Shares now reflect the exact page context
  - Locations:
    - `src/components/TrackCard.tsx`
    - `src/components/SwipeableTrackCard.tsx`
    - `src/components/EnhancedTrackCard.tsx`
    - `src/components/TrackContextMenu.tsx`

## [0.9.11] - 2026-01-17

### Added

- **Starchild ID Database Columns**: Added `deezer_id` as dedicated columns to all tables storing song/track data
  - Added `deezerId` column to `favorites`, `playlist_tracks`, `listening_history`, `listening_analytics`, and `audio_features` tables
  - Added `seedDeezerId` column to `recommendation_cache` table
  - Added `currentTrackDeezerId` column to `playback_state` table
  - All columns are indexed for fast lookups and querying
  - **Impact**: Starchild song IDs are now stored as dedicated columns, enabling efficient querying and serving as the basis for sharing songs
  - **Migration**: Run `npm run db:migrate` or `npm run db:push` to apply schema changes
  - Locations:
    - `src/server/db/schema.ts`
    - `src/server/api/routers/music.ts`
    - `drizzle/0016_add_deezer_id_columns.sql`

- **Starchild ID Type Support**: Added `deezer_id` field to Track type definition and validation
  - Track interface now includes optional `deezer_id` field
  - API routes automatically extract and preserve `deezer_id` from responses
  - **Impact**: Type-safe handling of Starchild IDs throughout the application
  - Locations:
    - `src/types/index.ts`
    - `src/app/api/album/[id]/tracks/route.ts`
    - `src/app/api/artist/[id]/tracks/route.ts`

- **Starchild ID in Sharing**: Updated all sharing functionality to prefer `deezer_id` when available
  - Share URLs now use `deezer_id` as the primary identifier for tracks
  - Falls back to `track.id` if `deezer_id` is not present
  - **Impact**: Shared song links use consistent Starchild IDs for reliable sharing
  - Locations:
    - `src/components/TrackContextMenu.tsx`
    - `src/components/TrackCard.tsx`
    - `src/components/SwipeableTrackCard.tsx`
    - `src/components/EnhancedTrackCard.tsx`

- **Background Playback Toggle**: Added a user preference to keep audio playing in the background
  - New setting under Playback for background playback
  - Stored as `keepPlaybackAlive` in user preferences (default true)
  - **Impact**: Users can opt out of background playback behavior
  - Locations:
    - `src/app/settings/page.tsx`
    - `src/server/db/schema.ts`
    - `src/server/api/routers/music.ts`

### Fixed

- **Mobile Search URL Persistence**: Prevented search URLs from reverting to the base route after search
  - Avoids clearing the URL when the query is still active
  - **Impact**: Search URLs stay stable after searching
  - Location: `src/components/MobileHeader.tsx`

- **Search URL Regression Test**: Added coverage to prevent future URL resets
  - **Impact**: Guards against search URL regressions
  - Location: `src/__tests__/MobileHeader.test.tsx`

- **Queue State Persistence Types**: Serialized queue fields to match API schema
  - `queuedTracks.addedAt` now persists as ISO strings
  - Coerced `queueSource` to `"user" | "smart"` for storage
  - **Impact**: Eliminates queue persistence type errors
  - Location: `src/contexts/AudioPlayerContext.tsx`

- **Smart Queue Settings Shape**: Normalized missing fields with defaults
  - Added `diversityFactor`, `excludeExplicit`, and `preferLiveVersions` defaults
  - **Impact**: Prevents SmartQueue settings type mismatch
  - Location: `src/contexts/AudioPlayerContext.tsx`

- **Toast Warning Support**: Added `warning` to toast types and UI styling
  - **Impact**: Allows background resume warnings without type errors
  - Locations:
    - `src/components/Toast.tsx`
    - `src/contexts/ToastContext.tsx`

- **Background Playback Resilience**: Improved resume handling across visibility, pagehide/pageshow, and lifecycle events
  - Added resume error feedback via toast with throttling
  - Ensured WebKit-specific listeners are cleaned up conditionally
  - **Impact**: More reliable playback continuity after app backgrounding
  - Locations:
    - `src/hooks/useAudioPlayer.ts`
    - `src/contexts/AudioPlayerContext.tsx`

- **Visualizer Type Setting**: Restored server-side support for Flow Field selection
  - API now accepts both `flowfield` and `kaleidoscope`
  - Updated visualizer type constants accordingly
  - **Impact**: Visualizer Type dropdown saves correctly
  - Locations:
    - `src/server/api/routers/music.ts`
    - `src/constants/visualizer.ts`

- **GitLab Branding**: Updated the start page GitLab button to use the correct logo
  - **Impact**: Visual branding matches the GitLab destination
  - Location: `src/app/HomePageClient.tsx`

- **Global Player Track Playback**: Aligned `play` vs `playTrack` semantics to avoid passing tracks into a parameterless resume call
  - **Impact**: Prevents runtime errors when playing a selected track
  - Locations:
    - `src/contexts/AudioPlayerContext.tsx`
    - `src/app/HomePageClient.tsx`
    - `src/components/TrackContextMenu.tsx`
    - `src/components/PlaylistContextMenu.tsx`
    - `src/app/playlists/[id]/page.tsx`
    - `src/app/artist/[id]/page.tsx`
    - `src/app/album/[id]/page.tsx`
    - `src/app/[userhash]/page.tsx`

- **Artist Tracks API Filtering**: Filtered invalid entries before enriching tracks with `deezer_id`
  - **Impact**: Prevents `null` or primitive entries in artist track responses
  - Location: `src/app/api/artist/[id]/tracks/route.ts`

## [0.9.9] - 2026-01-17

### Added

- **Mobile Player Overhauls**: Implemented full mobile player improvements
  - Mini player fixed to sit above the footer while playing
  - Sliding Queue panel (from right) and Equalizer panel (from left), both with swipe-to-dismiss
  - Mobile volume slider control in the fullscreen player
  - Desktop share button for track cards (Web Share API + clipboard fallback)
  - **Impact**: Better mobile UX, faster access to queue/equalizer, and desktop share support
  - Locations:
    - `src/components/MiniPlayer.tsx`
    - `src/components/MobilePlayer.tsx`
    - `src/components/TrackCard.tsx`

- **PWA Icon Generation**: Added Emily the Strange PWA icon pipeline
  - Sharp-based icon generator script and updated source asset
  - **Impact**: Updated PWA icons for install experience
  - Locations:
    - `scripts/generate-pwa-icons.cjs`
    - `public/icon-192.png`
    - `public/icon-512.png`

### Fixed

- **Playback Rate Stability**: Added aggressive enforcement to prevent random speedups on mobile
  - Ratechange listener + 100ms interval + timeupdate checks
  - **Impact**: Playback stays at 1.0 speed
  - Location: `src/hooks/useAudioPlayer.ts`

- **Mobile Album Art Always On**: Removed mobile visualizer toggle and always show album art
  - **Impact**: Simplified mobile UI and consistent art display
  - Location: `src/components/MobilePlayer.tsx`

- **Missing Icon Import**: Added missing `X` icon import for panel close buttons
  - **Impact**: Prevents runtime rendering issues on mobile panels
  - Location: `src/components/MobilePlayer.tsx`

## [0.9.8] - 2026-01-13

### Added

- **Mobile Header Hamburger Menu**: Restored hamburger menu button to mobile header
  - Added Menu icon button on the upper left side of mobile header
  - Opens hamburger menu drawer when tapped
  - Includes haptic feedback and smooth animations
  - **Impact**: Users can now access navigation menu from mobile header
  - Location: `src/components/MobileHeader.tsx:178-196`

- **Profile Tab in Mobile Footer**: Added profile navigation tab to mobile footer
  - Profile tab appears between "Library" and "Create" tabs
  - Uses User icon and links to user's profile page (`/${userHash}`)
  - Requires authentication and shows disabled state while userHash loads
  - **Impact**: Quick access to user profile from mobile footer navigation
  - Location: `src/components/MobileFooter.tsx:93-107, 125`

- **Six New Audio Visualizer Effects**: Added six new high-performance visualizer patterns
  - **plasmaStorm**: Plasma effect with bitwise-optimized calculations and adaptive quality
  - **bitfieldMatrix**: Matrix-style grid pattern with bit-based cell generation
  - **mandelbrotSpiral**: Mandelbrot set fractal combined with audio-reactive spiral overlay
  - **quantumResonance**: Grid-based resonance pattern with audio-reactive cell activation
  - **morseAurora**: Multi-band wave patterns with Morse code-like pulsing
  - **chromaticAberration**: RGB channel separation effect with audio-reactive color shifts
  - All effects use bitwise operations for optimal performance
  - All effects are audio-reactive with bass, mid, and treble intensity controls
  - **Impact**: Expanded visualizer pattern library with 6 new mesmerizing effects
  - Locations:
    - `src/components/visualizers/flowfieldPatterns/patternIds.ts:88-93`
    - `src/components/visualizers/FlowFieldRenderer.ts:141-147, 3040-3080, 11544-11927`

- **Five Additional Visualizer Effects**: Added five more mathematical and fractal-based visualizer patterns
  - **mengerSponge**: Recursive 3D fractal pattern with audio-reactive depth
  - **perlinNoiseField**: Multi-octave Perlin noise field with smooth gradient generation
  - **superformula**: Mathematical superformula curves with audio-reactive parameters
  - **voronoi**: Voronoi diagram with distance-based coloring and seed generation
  - **dragonCurve**: Fractal dragon curve using bit-counting algorithm
  - All effects use optimized calculations and audio-reactive properties
  - **Impact**: Expanded visualizer library with mathematical and fractal patterns
  - Locations:
    - `src/components/visualizers/flowfieldPatterns/patternIds.ts:94-98`
    - `src/components/visualizers/FlowFieldRenderer.ts:151-152, 3087-3125, 11928-12365`

- **Three Knot and Cellular Automaton Patterns**: Added knotwork and algorithmic visualizer patterns
  - **langtonsAnt**: Cellular automaton following Langton's ant rules with audio-reactive grid
  - **celticKnot**: Interwoven Celtic knot pattern with multiple rotating layers
  - **germanicKnot**: Valknut pattern (three interlocking triangles) with audio-reactive rotation and pulsing
  - All patterns use proper hue normalization and audio-reactive animations
  - **Impact**: Added cultural knotwork patterns and algorithmic visualizations
  - Locations:
    - `src/components/visualizers/flowfieldPatterns/patternIds.ts:99-101`
    - `src/components/visualizers/FlowFieldRenderer.ts:153-155, 3126-3138, 12366-12520`

### Fixed

- **Mobile Footer Active State Logic**: Fixed duplicate active tab indicators
  - Home and search tabs both had `path: "/"`, causing both to be active simultaneously
  - Updated `isActive` function to distinguish between home and search tabs
  - Search tab is only active when there's a search query (`?q=...`)
  - Home tab is only active when on "/" without a search query
  - **Impact**: Only one tab shows as active at a time, fixing Framer Motion layout animation
  - Location: `src/components/MobileFooter.tsx:31-47, 128-135`

- **Mandelbrot Spiral Hue Calculation**: Fixed invalid hue values in visualizer
  - Hue calculation used `& 0x1ff` (0-511 range) then divided by 360, producing values > 1.0
  - Added `fastMod360()` normalization to ensure 0-360 range before division
  - **Impact**: Mandelbrot spiral now displays correct colors without hue overflow
  - Location: `src/components/visualizers/FlowFieldRenderer.ts:11709`

- **PlasmaStorm Hue Calculation**: Fixed incorrect hue normalization in visualizer
  - Hue was calculated in 0-255 range and divided by 255, but HSL requires 0-360 degrees
  - Changed to scale 0-255 to 0-360 range using pre-calculated constant `HUE_255_TO_360`
  - Added `fastMod360()` normalization to ensure proper 0-360 range
  - **Impact**: PlasmaStorm effect now displays correct colors with proper HSL hue values
  - Location: `src/components/visualizers/FlowFieldRenderer.ts:11579-11580, 288`

- **Hue Normalization with Bitwise Masking**: Fixed incorrect hue calculations in three visualizer effects
  - Removed incorrect `& 0x1ff` (0-511 range) masking before `fastMod360()` calls
  - Bitwise masking was truncating values instead of properly normalizing to 0-360 range
  - Fixed in `renderMandelbrotSpiral`, `renderQuantumResonance`, and `renderMorseAurora`
  - **Impact**: All three effects now display correct colors with proper hue normalization
  - Locations:
    - `src/components/visualizers/FlowFieldRenderer.ts:11711` (Mandelbrot Spiral)
    - `src/components/visualizers/FlowFieldRenderer.ts:11794` (Quantum Resonance)
    - `src/components/visualizers/FlowFieldRenderer.ts:11841` (Morse Aurora)

- **Search Tab Navigation**: Fixed search tab clearing active search query
  - Search tab had `path: "/"` without custom handler, causing navigation to clear search query
  - Added `handleSearchNavigation` function that preserves search query when already on search page
  - Prevents navigation if already on search page with active query
  - **Impact**: Search tab no longer clears active search results when clicked
  - Location: `src/components/MobileFooter.tsx:88-99, 105-107`

- **Build Error Fix**: Fixed missing Suspense boundary for `useSearchParams()`
  - `MobileFooter` uses `useSearchParams()` which requires Suspense boundary during static generation
  - Wrapped `MobileFooterWrapper` in Suspense boundary in root layout
  - **Impact**: Build now completes successfully without prerendering errors
  - Location: `src/app/layout.tsx:132-134`

- **Performance Optimization**: Pre-calculated hue conversion constant
  - Added `HUE_255_TO_360` static constant to avoid repeated division calculations
  - Replaced `360 / 255` division with pre-calculated constant multiplication
  - **Impact**: Slight performance improvement in PlasmaStorm effect rendering
  - Location: `src/components/visualizers/FlowFieldRenderer.ts:288, 11580`

- **Extended Recent Searches**: Increased search history capacity and improved display
  - Increased API limit from 20 to 100 searches, defaulting to 50
  - Updated both mobile and desktop to fetch and display 50 recent searches (previously 5)
  - Made desktop display more compact: reduced text size (text-sm → text-xs), padding (px-3 py-1.5 → px-2 py-1), and gap spacing
  - Increased mobile dropdown height from max-h-48 to max-h-64 to accommodate more searches
  - **Impact**: Users can now access up to 50 recent searches with improved desktop layout density
  - Locations:
    - `src/server/api/routers/music.ts:701` (API limit increase)
    - `src/app/HomePageClient.tsx:77, 441-457` (desktop display and query)
    - `src/components/MobileHeader.tsx:31` (mobile query)
    - `src/components/MobileSearchBar.tsx:433` (mobile dropdown height)

- **Client-Side Navigation Optimization**: Improved navigation to prevent page reloads
  - Added `{ scroll: false }` option to all `router.push()` calls in mobile footer
  - Prevents scroll jumps and ensures smooth client-side navigation
  - **Impact**: Audio player continues playing during navigation, no page reloads
  - Location: `src/components/MobileFooter.tsx:61, 84, 93`

- **Search Tab Active State Fix**: Fixed search tab visual feedback
  - Search tab now uses `activeTab` state as fallback when no query exists
  - Prevents both home and search tabs from being active simultaneously
  - **Impact**: Proper visual feedback when clicking search tab without existing query
  - Location: `src/components/MobileFooter.tsx:31-49`

- **Visualizer Pattern Enhancements**: Enhanced all patterns after hydrogenElectronOrbitals for elegant, intricate shapes
  - **PlasmaStorm**: Transformed into layered plasma rings with smooth waves and central gradient orb
  - **BitfieldMatrix**: Redesigned as elegant geometric grid with squares, circles, triangles, and hexagons
  - **MandelbrotSpiral**: Enhanced with layered mandelbrot-inspired rings and smooth spiral overlay
  - **QuantumResonance**: Improved with interconnected resonance orbs and connecting lines
  - **MorseAurora**: Converted to circular aurora bands with smooth wave patterns (no flashing)
  - **ChromaticAberration**: Enhanced with layered chromatic rings and subtle RGB channel separation
  - **MengerSponge**: Added rounded fractal cubes with smooth rotation
  - **PerlinNoiseField**: Redesigned as flowing noise-based patterns in elegant rings
  - **Superformula**: Enhanced with multiple layered superformula curves and smooth rotation
  - **Voronoi**: Improved with gradient-filled Voronoi cells and elegant seed orbs
  - **DragonCurve**: Enhanced with multiple interwoven dragon curves and gradient fills
  - **LangtonsAnt**: Redesigned with rounded cellular pattern and elegant styling
  - **CelticKnot**: Improved with bezier curves for smoother interweaving and subtle fills
  - **GermanicKnot**: Enhanced Valknut with gradients, corner decorations, and outer ring
  - All patterns now feature slower, smoother animations (reduced time multipliers)
  - All patterns focus on elegant, intricate shapes rather than rapid flashing effects
  - Added more visual depth with gradients, multiple layers, and connecting elements
  - **Impact**: All visualizer patterns now display beautiful, intricate shapes with smooth, flowing animations
  - Location: `src/components/visualizers/FlowFieldRenderer.ts:11612-12887`

## [0.9.7] - 2026-01-13

### Removed

- **Complete Playback Speed Removal**: Removed all playback speed/rate adjustment functionality
  - Removed playback speed slider from settings page
  - Removed speed controls from mobile and desktop players (speed menu button and dropdown)
  - Removed `playbackRate` state from audio player context and hooks
  - Removed `playbackRate` column from database schema (user_preferences table)
  - Removed `playbackRate` from tRPC API validation and mutations
  - Removed `PLAYBACK_RATE` from localStorage storage keys
  - Removed `playbackRate` from Electron persistent preferences
  - Removed all audio element `playbackRate` assignments and preservation logic
  - Removed `playbackRate` from TypeScript type definitions (BasePlayerProps, PlayerControls, PlayerState)
  - Removed mobile playback speed gotcha from CLAUDE.md documentation
  - **Rationale**: Feature was unnecessary and caused more issues than value
  - **Impact**: All audio now plays at normal 1.0x speed with no user controls
  - Locations:
    - `src/app/settings/page.tsx` (removed speed slider)
    - `src/components/MobilePlayer.tsx` (removed speed menu UI)
    - `src/components/Player.tsx` (removed speed controls)
    - `src/components/PersistentPlayer.tsx` (removed playbackRate props)
    - `src/contexts/AudioPlayerContext.tsx` (removed from context)
    - `src/hooks/useAudioPlayer.ts` (removed all playbackRate logic)
    - `src/types/player.ts` (removed from interfaces)
    - `src/types/index.ts` (removed from PlayerState)
    - `src/server/db/schema.ts` (removed database column)
    - `src/server/api/routers/music.ts` (removed from updatePreferences)
    - `src/server/api/routers/equalizer.ts` (removed from default values)
    - `src/config/storage.ts` (removed PLAYBACK_RATE key)
    - `src/utils/electronStorage.ts` (removed from PERSISTENT_PREFERENCES)
    - `CLAUDE.md` (removed gotcha #6)

### Fixed

- **Dependency Cleanup**: Cleaned up unused and incorrectly removed dependencies
  - **Removed unused dependencies** (truly unused):
    - `@tanstack/react-virtual`, `@use-gesture/react`, `morgan`, `@types/morgan`
    - `react-audio-visualize`, `tone`, `vaul`
    - `@next/bundle-analyzer`, `@svgr/cli`, `svgo`, `tsup`, `webpack`, `yargs`
    - `electron-context-menu`, `electron-window-state-manager` (using custom implementations)
  - **Reinstalled required dependencies** (incorrectly removed):
    - `eslint-config-next` (used in eslint.config.js for Next.js linting rules)
    - `prettier-plugin-tailwindcss` (used in prettier.config.js for class sorting)
    - `wait-on` (used in electron:dev scripts)
    - `postcss` (required by Tailwind CSS)
    - `autoprefixer` (CSS vendor prefixing)
  - **Rollup plugins** (already installed, not missing):
    - `@rollup/plugin-json`, `@rollup/plugin-node-resolve`, `rollup-plugin-re`
  - **Impact**: Cleaner dependencies, faster installs, no missing required packages
  - Location: `package.json` devDependencies

### Known Issues

- **Mobile Browser Buffering Behavior**: On mobile devices, playback may exhibit very minor speed fluctuations (~1-2%) at regular intervals (~55 seconds)
  - **Root Cause**: Mobile browsers (Safari, Chrome) automatically adjust playback rate slightly when approaching HLS stream segment boundaries (typically 60-second chunks) to maintain smooth playback and prevent stuttering
  - **Impact**: Barely noticeable under normal listening conditions, prevents audio stuttering
  - **Status**: This is standard mobile browser behavior for adaptive streaming and cannot be controlled via frontend code
  - **Workaround**: None needed - this is expected behavior for mobile audio streaming

## [0.9.6] - 2026-01-11

### Fixed

- **Settings Profile Link Navigation**: Fixed "View your public profile" link leading to profile not found
  - Profile link was using `session.user.name` instead of the correct `userHash`
  - Added `getCurrentUserHash` query to fetch the user's hash from the API
  - Updated accountSection href to use `userHash` for correct profile navigation
  - **Impact**: Profile link in settings now correctly navigates to user's public profile
  - Location: `src/app/settings/page.tsx:58-61, 342`

### Redesigned

- **COMPLETE Settings Page Mobile Redesign**: Total creative overhaul with minimal, elegant aesthetic
  - **Header**: Clean title and subtitle without gradient badges
  - **Section Headers**: Minimal uppercase labels with accent icon (no badges or dividers)
  - **Cards**: Floating style with subtle borders (`border-white/5`) and clean shadows
  - **Typography**: Consistent 15px labels, 13px descriptions for better readability
  - **Toggle Switches**: Simple iOS-style toggles with clean accent color (no gradients or scale effects)
  - **Sliders**: Clean white thumb with accent color fill, subtle shadows
  - **Dropdowns**: Minimal design with proper z-index and subtle hover states
  - **Spacing**: Generous padding (px-5 py-4) for better breathing room
  - **Dividers**: Only between items, removed from last item in each section
  - **Hover States**: Subtle `bg-white/[0.03]` on hover, `bg-white/5` on active
  - **Animations**: Reduced delay timing for smoother, less distracting motion
  - **Overall**: Removed excessive gradients, shadows, and visual noise for a premium, clean aesthetic
  - **Impact**: Settings page now has a beautiful, minimal, and elegant design
  - Location: `src/app/settings/page.tsx:361-759`

## [0.9.5] - 2026-01-10

### Fixed

- **Mobile Playback Speed Issue**: Fixed audio randomly speeding up on mobile devices after track loads
  - Root cause: Mobile browsers (Safari/Chrome) asynchronously reset playbackRate after `load()` call
  - Previous fix only restored playbackRate immediately after `load()`, but before metadata loaded
  - Added `loadedmetadata` event listener to restore playbackRate AFTER metadata is fully loaded
  - Event listener uses `{ once: true }` to auto-cleanup and prevent memory leaks
  - **Impact**: Playback speed now stays consistent at user's chosen rate on mobile browsers
  - Location: `src/hooks/useAudioPlayer.ts:532-539`

## [0.9.4] - 2026-01-10

### Improved

- **Settings Page Mobile UI Overhaul**: Complete visual redesign of the settings page for mobile devices
  - Enhanced header with gradient icon badge and refined typography
  - Beautiful gradient card backgrounds with shadow effects and subtle borders
  - Section headers with gradient icon badges and divider lines
  - Improved toggle switches with gradient backgrounds and scale animations
  - Enhanced sliders with gradient thumbs and glow effects on interaction
  - Polished select dropdowns with staggered animations and gradient highlights
  - Better touch targets and active states for all interactive elements
  - Sign Out button styled with red accent for visual distinction
  - Consistent spacing, padding, and rounded corners throughout
  - Smooth whileTap scale animations on all interactive items
  - **Impact**: Settings page now has a premium, polished feel on mobile devices
  - Location: `src/app/settings/page.tsx:358-786`

## [0.9.3] - 2026-01-10

### Fixed

- **CRITICAL: Profile Page Auto-Redirect**: Fixed profile pages immediately redirecting to home page
  - MobileHeader component runs on ALL pages (it's in the root layout)
  - Its useEffect was redirecting to `/` whenever `searchQuery` was empty
  - When navigating to profile pages (`/[userhash]`), there's no search query, triggering unwanted redirect
  - Profile would load briefly, then immediately redirect to `/`
  - Fixed by only redirecting when actively clearing a search (when `?q=` param exists in URL)
  - **Impact**: Profile pages now work correctly on both desktop and mobile
  - Location: `src/components/MobileHeader.tsx:63-72`

## [0.9.2] - 2026-01-10

### Fixed

- **CRITICAL: Infinite Mutation Loop**: Fixed severe performance issue causing request storms and profile navigation failures
  - AudioPlayerContext had tRPC mutations (`clearQueueStateMutation`, `saveQueueStateMutation`) in useEffect dependency arrays
  - This caused infinite re-renders and thousands of aborted `clearQueueState` requests (NS_BINDING_ABORTED)
  - Profile pages couldn't load because `getCurrentUserHash` query was being aborted repeatedly
  - Navigation to user profiles (`/[userhash]`) was broken on both desktop and mobile
  - Removed mutation objects from dependency arrays (mutations are stable references and don't need to be dependencies)
  - **Impact**: Dramatically improves performance, fixes profile navigation, reduces server load
  - Location: `src/contexts/AudioPlayerContext.tsx:232-241, 269-270`

### Improved

- **Performance**: Application is now significantly more responsive with proper dependency management
  - No more request storms on every state change
  - Profile queries can complete successfully
  - Navigation works smoothly across all pages

## [0.9.1] - 2026-01-10

### Added

- **Track Sharing by ID**: New feature to share individual songs with instant playback
  - Share any track via URL parameter: `?track=123456`
  - Shared track loads automatically and starts playing immediately
  - Track metadata fetched via new API endpoint: `/api/track/[id]`
  - Updates share functionality to generate shareable links with track ID
  - Clipboard fallback for browsers without Web Share API support
  - Haptic feedback on successful track load
  - Location: `src/app/HomePageClient.tsx:162-185, 209-232`, `src/app/api/track/[id]/route.ts`, `src/utils/api.ts:106-111`, `src/components/TrackContextMenu.tsx:166-192`

### Fixed

- **Desktop Search Clearing Bug**: Fixed search results clearing immediately when searching on desktop
  - Previous results now remain visible while new search loads (prevents flash to default state)
  - Added `lastUrlQueryRef` to track URL state and prevent race conditions
  - Fixed dependency array in useEffect causing premature state clearing
  - Search flow now stable on both desktop and mobile
  - Location: `src/app/HomePageClient.tsx:54-55, 185-230`

### Improved

- **Share Functionality**: Enhanced track sharing with proper URL generation
  - Generates shareable links with track ID parameter instead of current page URL
  - Desktop users can copy link to clipboard if Web Share API unavailable
  - Toast notifications for successful share or clipboard copy
  - Better user experience for sharing tracks across platforms

## [0.9.0] - 2026-01-10

### Fixed

- **Mobile Player Visualizer Toggle**: Fixed Activity (lightning) button not controlling background visualizer
  - Button was incorrectly toggling `hideAlbumCover` state instead of `visualizerEnabled`
  - Now properly enables/disables the audio-reactive background visualizer
  - Visual feedback: Amber highlight (`bg-[rgba(244,178,102,0.3)]`) when enabled, dark (`bg-black/40`) when disabled
  - Persists user preference to localStorage for non-authenticated users
  - Syncs with user preferences from database for authenticated users
  - Location: `src/components/MobilePlayer.tsx:499-518`

- **Mobile Player Favorite/Heart Button**: Implemented full favorite functionality for Heart button
  - Previously only triggered haptic feedback with no actual function
  - Now adds/removes tracks from user's favorites with proper API integration
  - Queries favorite status on track change and displays filled red heart for favorited tracks
  - Animated scale effect on click (600ms) with different haptics (success for add, light for remove)
  - Shows visual state: Red filled heart when favorited, gray outline when not
  - Disabled state (50% opacity) when user is not authenticated
  - Proper tooltips: "Sign in to favorite tracks" (unauthenticated) or "Add/Remove from favorites" (authenticated)
  - Invalidates cache on mutation success to ensure UI stays in sync
  - Location: `src/components/MobilePlayer.tsx:119-122, 129, 152-176, 193-205, 937-1006`

### Added

- **Mobile Player API Integration**: Enhanced mobile player with tRPC mutations and queries
  - Added `api.useUtils()` for cache invalidation
  - Integrated `api.music.isFavorite` query to check track favorite status
  - Integrated `api.music.addFavorite` and `api.music.removeFavorite` mutations
  - Heart animation state management with `isHeartAnimating` flag
  - Location: `src/components/MobilePlayer.tsx:110, 119-122, 129, 152-176, 193-205`

### Improved

- **Mobile Player Button Consistency**: All mobile player control buttons now fully functional
  - Visualizer toggle (Activity icon): Controls audio-reactive background
  - Heart button: Add/remove from favorites with authentication check
  - Play/Pause, Previous/Next, Skip ±10s: Already functional
  - Shuffle, Repeat modes: Already functional
  - Volume/Mute, Playback speed: Already functional
  - Queue, Equalizer, Add to playlist: Already functional
  - Complete feature parity with desktop player controls

## [0.8.9] - 2026-01-09

### Fixed

- **Mobile Search Spinner Overlap**: Fixed loading spinner overlapping with input text in mobile search bar
  - Added conditional left padding (`pl-8`) to input wrapper when spinner is visible
  - Spinner positioned absolutely at `left-4`, input text now has proper spacing
  - Prevents text from being hidden behind the loading/countdown indicator
  - Location: `src/components/MobileSearchBar.tsx:297`

- **Persistent "Searching..." State**: Fixed search loading state not clearing after navigation completes
  - Removed unreliable hardcoded `setTimeout(500ms)` that didn't account for actual API completion
  - Now properly resets `isSearching` state when URL changes (via `searchParams` effect)
  - Searching state clears immediately when navigation to search results page completes
  - Prevents infinite "Searching now..." message after results are ready
  - Location: `src/components/MobileHeader.tsx:34-42, 85-88, 115-116`

- **Search Results Not Displaying on Mobile**: Fixed search results failing to appear after search execution
  - Removed `isInitialized` flag that was blocking URL change detection after first page load
  - Added duplicate search protection directly in `performSearch()` function
  - Search now properly triggers on URL changes regardless of initialization state
  - Works correctly on fresh page load, repeated searches, and navigation scenarios
  - Location: `src/app/HomePageClient.tsx:66-100, 157-182`

- **Hamburger Menu Navigation Search State**: Fixed hamburger menu navigation preserving search query in URL
  - Menu links now use `router.push()` explicitly to ensure clean navigation without query parameters
  - Search query clears when URL has no `q` parameter (navigation away from search)
  - Prevents users from seeing stale search results when navigating to other pages
  - Search input properly clears when leaving search page via hamburger menu
  - Location: `src/components/HamburgerMenu.tsx:24, 190-193` and `src/components/MobileHeader.tsx:38-40`

- **Search Results State Management**: Improved search state clearing when navigating away from results
  - Added proper cleanup when URL has no query parameters (clears results, total, currentQuery, and query)
  - Prevents stale results from displaying when user navigates to home page
  - Ensures clean state transitions between search and non-search pages
  - Location: `src/app/HomePageClient.tsx:176-181`

### Improved

- **Search Flow Reliability**: Enhanced mobile search user experience with proper state management
  - Debounced search countdown now properly syncs with navigation state
  - Loading indicators accurately reflect actual search progress
  - Duplicate search prevention reduces unnecessary API calls
  - Clean state transitions when navigating between pages
  - Consistent behavior across fresh loads, repeated searches, and navigation scenarios

## [0.8.8] - 2026-01-08

### Fixed

- **Smooth Circular Progress Animation**: Fixed choppy countdown indicator animation in mobile search bar
  - Changed from `style={{ strokeDashoffset: ... }}` to `animate={{ strokeDashoffset: ... }}` for smooth interpolation
  - Previously updated in discrete jumps every 100ms (matching countdown interval frequency)
  - Now uses Framer Motion's `animate` prop for smooth interpolation between values, matching the progress bar pattern
  - Provides consistent and fluid visual feedback during search countdown
  - Location: `src/components/MobileSearchBar.tsx:270-283`

- **Progress Bar Direction**: Fixed backwards progress bar animation in mobile search countdown
  - Progress bar was emptying instead of filling as countdown progressed
  - Added `elapsedProgress` calculation that inverts countdown: `(1 - autoSearchCountdown / 2000) * 100`
  - Progress bar now correctly fills from 0% to 100% as time elapses (intuitive UX)
  - Circular indicator still uses `countdownProgress` (remaining time) which is correct for that visualization
  - Location: `src/components/MobileSearchBar.tsx:200-202, 324`

- **Profile Link Navigation**: Fixed unwanted page scrolling when profile link clicked before userHash loads
  - Uses `href="#"` as placeholder when userHash is loading (follows security best practices)
  - Added `e.stopPropagation()` alongside `e.preventDefault()` to prevent event bubbling
  - Prevents browser from navigating to page anchor and causing unexpected scrolling
  - Works in conjunction with `preventDefault()`, `stopPropagation()`, and `pointer-events-none` for complete protection
  - Location: `src/components/HamburgerMenu.tsx:75-80, 183-191`

### Improved

- **Elegant Play Button Design**: Enhanced mobile player Play/Pause button with premium styling
  - Added gradient background: `bg-gradient-to-br from-[var(--color-text)] to-[var(--color-accent)]`
  - Added subtle ring border: `ring-2 ring-[var(--color-accent)]/20` for elegant accent
  - Enhanced shadow with increased opacity (0.4 → 0.5) for better depth
  - Added glossy overlay effect with white gradient (`from-white/10 to-transparent`)
  - Improved hover animation: `whileHover={{ scale: 1.05 }}` for interactive feedback
  - Smoother tap animation: adjusted scale from 0.9 to 0.92
  - Better icon centering: adjusted Play icon margin from `ml-1` to `ml-0.5`
  - Added smooth transitions: `transition-all duration-300`
  - Enhanced disabled state styling with proper opacity and cursor
  - Location: `src/components/MobilePlayer.tsx:782-799`

## [0.8.7] - 2026-01-08

### Fixed

- **SVG Animation Conflict in Search Countdown**: Fixed conflicting animation mechanisms in circular progress indicator
  - Removed incompatible `pathLength` animation that conflicted with `strokeDashoffset`
  - Now uses only `strokeDashoffset` animated via Framer Motion's style prop for consistent circular progress animation
  - Prevents unpredictable rendering behavior and visual glitches
  - Location: `src/components/MobileSearchBar.tsx:270-283`

## [0.8.6] - 2026-01-08

### Added

#### Device Support

- **iPhone 17 Pro Max Support**: Added optimized CSS media queries for iPhone 17 Pro Max (1320×2868 pixels)
  - Enhanced header height (64px) and player height (92px) for larger display
  - Increased artwork size to 450px for better visual presentation
  - Optimized padding and spacing for extra-tall screen aspect ratio
  - Location: `src/styles/globals.css:1670-1701`

### Fixed

- **Profile Link in Hamburger Menu**: Fixed broken profile link for authenticated users
  - Switched from `getCurrentUserProfile` to `getCurrentUserHash` query for more reliable data fetching
  - Fixed incorrect `href` value: when user is logged in but `userHash` is still loading, the link now uses `"#"` placeholder instead of incorrectly pointing to `/api/auth/signin`
  - Added proper loading state handling with disabled styling and navigation prevention
  - Prevents authenticated users from being redirected to sign-in page while profile loads
  - Location: `src/components/HamburgerMenu.tsx:35-41, 71-80, 179-190`

- **Mobile Search Countdown Bug**: Fixed countdown indicator continuing to animate after manual search submission
  - When user submits search manually via Enter key, `handleSearch()` now properly clears both the debounce timeout and countdown interval
  - Countdown state is reset to 0 when search is submitted manually or cleared
  - Prevents countdown indicator from animating in the background after search completion
  - Location: `src/components/MobileHeader.tsx:95-112, 114-125`

- **Mobile Player Button Controls**: Fixed audio control buttons in mobile player
  - Added proper event handling with `preventDefault()` and `stopPropagation()` to prevent event bubbling
  - Wrapped handlers in `useCallback` for better performance
  - Added proper disabled states and visual feedback
  - Enhanced accessibility with proper `aria-label` attributes
  - Location: `src/components/MobilePlayer.tsx:168-191, 720-876`

### Improved

- **Profile Link UX**: Better user experience for profile navigation
  - Visual feedback (reduced opacity) when profile link is loading
  - Prevents accidental navigation to sign-in page for authenticated users
  - Smooth transition when `userHash` becomes available

- **Mobile Player Controls**: Enhanced button functionality and accessibility
  - All buttons now have consistent event handling
  - Proper disabled states with visual feedback
  - Better haptic feedback on all button presses

## [0.8.5] - 2026-01-08

### Added

#### Mobile Settings Page

- **Spotify-Like Settings Interface**: Comprehensive mobile settings page with intuitive design
  - Settings sections: Playback, Audio, Visual, Smart Queue, Account
  - Toggle switches with haptic feedback for boolean settings
  - Sliders for volume and playback speed with real-time value display
  - Select dropdowns for repeat mode, equalizer presets, visualizer types, and similarity preferences
  - Real-time sync with audio player state
  - Toast notifications for save success/errors
  - Authentication check with redirect to sign-in if not logged in
  - Location: `src/app/settings/page.tsx`
  - Accessible via hamburger menu (Settings link)

#### Mobile Player Improvements

- **Enhanced Swipe-Up Gesture**: Made mobile player pop up more easily
  - Lowered swipe threshold from 30px to 20px for easier triggering
  - Reduced velocity threshold from 200 to 150 for quick flicks
  - Added visual feedback during swipe with opacity and scale transforms
  - "Swipe Up to Expand" hint appears when dragging up (>20px)
  - Increased drag elastic to 0.5 for more responsive feel
  - Medium haptic feedback when player expands via swipe
  - Location: `src/components/MiniPlayer.tsx`

#### Mobile Search Bar Enhancements

- **Auto-Search with Debounce**: Intelligent search that triggers automatically while typing
  - 2-second debounce: searches automatically 2 seconds after typing stops
  - Visual countdown indicator: circular progress in search icon area
  - Progress bar below input showing countdown progress
  - Text indicator: "Searching in 2s", "Searching in 1s", "Searching now..."
  - Countdown resets on each keystroke
  - Manual search still works via Enter/submit button
  - Smooth animations with Framer Motion
  - Location: `src/components/MobileSearchBar.tsx`, `src/components/MobileHeader.tsx`

### Improved

- **Mobile UX**: More intuitive and responsive mobile interactions
  - Settings page follows Spotify's mobile design patterns
  - Search bar provides clear visual feedback during typing
  - Player expansion is easier and more discoverable
  - Better haptic feedback throughout mobile interface

### Fixed

- **Mobile Search**: Fixed duplicate onSubmit handler in search form
- **Settings Sync**: Fixed repeat mode selection to properly cycle through modes
- **Player State**: Settings now sync in real-time with audio player state

## [0.8.4] - 2026-01-07

### Added - Performance & Security Optimizations 🚀🔒

#### Build & Bundle Optimizations

- **SWC Minification**: Default in Next.js 15 (7x faster than Terser)
- **Deterministic Module IDs**: Improved long-term caching with consistent chunk names
- **Console Removal**: Production builds remove console.log (keeps error/warn)
- **Image Optimization**: AVIF and WebP format support with optimized device sizes
- **Package Tree-Shaking**: Optimized imports for lucide-react, framer-motion, @tanstack/react-query, @trpc/_, @dnd-kit/_
- **Webpack Build Worker**: Parallel builds for faster compilation
- **Bundle Size**: First Load JS shared by all: **102 kB** (exceptional performance - 50% smaller than initial attempt)

#### Security Headers & Middleware

- **Comprehensive HTTP Security Headers**:
  - `Strict-Transport-Security`: Force HTTPS with HSTS preload
  - `X-Frame-Options`: SAMEORIGIN (prevent clickjacking)
  - `X-Content-Type-Options`: nosniff
  - `X-XSS-Protection`: XSS filter enabled
  - `Referrer-Policy`: strict-origin-when-cross-origin
  - `Permissions-Policy`: Disabled camera, microphone, geolocation
  - `Content-Security-Policy`: Comprehensive CSP with nonce-based scripts
- **Smart Caching Strategy**:
  - API routes: no-store, max-age=0 (always fresh)
  - Static assets: public, max-age=31536000, immutable (1 year cache)
- **Rate Limiting Middleware** (`src/middleware.ts`):
  - 100 requests per 60 seconds per IP address
  - Automatic IP detection from X-Forwarded-For header
  - 429 status with Retry-After header when exceeded
  - Memory-efficient with automatic cleanup

#### Progressive Web App (PWA) Support

- **Service Worker** (`public/sw.js`): Offline support with intelligent caching
- **Web Manifest** (`public/manifest.json`): Installable as standalone app
- **Apple Web App Support**: iOS home screen installation
- **Service Worker Registration** (`src/app/register-sw.tsx`): Automatic registration

#### Performance Monitoring

- **Performance Utilities** (`src/utils/performance.ts`):
  - `measurePerformance()`: Sync function performance tracking
  - `measureAsyncPerformance()`: Async operation tracking
  - `reportWebVitals()`: Core Web Vitals monitoring
  - `getMemoryUsage()`: JavaScript heap usage tracking

### Improved

- **Code Quality**: Removed all comments from 132 source files (~30-40% bundle size reduction)
- **Security**: Rate limiting, CSP headers, XSS protection, CSRF protection
- **Performance**: Near-instant repeat visits with service worker caching

### Removed

- **AudioVisualizer.tsx** (723 lines): Unused visualizer component
- **KaleidoscopeRenderer.ts** (520 lines): Unused renderer (1,243 total lines removed)
- **SSL Certificate Management**: Removed unnecessary custom CA certificate checking (Neon uses standard SSL)
  - Removed `DB_SSL_CA` environment variable from validation and documentation
  - Removed `certs/ca.pem` file checking in database connection
  - Removed `fs.existsSync` and `fs.readFileSync` imports from [src/server/db/index.ts](src/server/db/index.ts)
  - Simplified SSL configuration to use Node.js built-in certificate trust
  - Cleaned up [.env.example](.env.example) and [.env.vercel.example](.env.vercel.example)

### Fixed

- **next.config.js**: Removed deprecated `swcMinify` option (default in Next.js 15)
- **next.config.js**: Converted `require("crypto")` to ES module import for compatibility
- **next.config.js**: Removed aggressive webpack code splitting (caused runtime errors) - simplified to deterministic module IDs
- **vercel.json**: Fixed invalid regex pattern in headers source (Vercel requires path matching syntax, not regex)
- **.vercelignore**: Added `!CHANGELOG.md` to allow CHANGELOG.md in Vercel builds (fixes "cannot stat CHANGELOG.md" error)
- **Authentication**: Fixed Discord login 500 error caused by webpack bundle misconfiguration
- **Bundle Size**: Improved from 204 kB to 102 kB (50% reduction) by removing counterproductive code splitting

### Documentation

- **CLAUDE.md**: Added "Performance & Security Optimizations" section with complete implementation guide

## [0.8.3] - 2026-01-02

### Added

#### Neon Database Migration Support

- **Neon Database Integration**: Migrated database connection to support Neon PostgreSQL
  - Added support for `DATABASE_URL` connection string (pooled connection)
  - Added support for `DATABASE_UNPOOLED` for unpooled connections
  - Migration script now uses `OLD_DATABASE_URL` as source and `DATABASE_UNPOOLED` as destination
  - Location: `drizzle.config.ts`, `src/server/db/index.ts`, `scripts/migrate-to-neon.ts`

- **Migration Management Scripts**:
  - Added `db:mark-applied` script to mark existing migrations as applied
  - Created `scripts/mark-migrations-applied.sql` for manual SQL execution
  - Created `scripts/mark-migrations-simple.js` for cross-platform migration marking
  - Location: `scripts/mark-migrations-applied.ts`, `scripts/mark-migrations-applied.sql`, `scripts/mark-migrations-simple.js`

- **Cross-Platform Build Script**:
  - Replaced bash script with Node.js `scripts/db-sync.js` for Windows compatibility
  - Handles database migration with automatic fallback to `db:push`
  - Location: `scripts/db-sync.js`, `package.json`

### Changed

#### Database Configuration

- **Environment Variable Priority**: Fixed dotenv loading order to prioritize `.env.local` over `.env`
  - `.env.local` now loads first with `override: true` to ensure it takes precedence
  - Prevents `.env` values from overriding `.env.local` values
  - Location: `drizzle.config.ts`, `drizzle.env.ts`

- **Database Connection Configuration**:
  - `DATABASE_URL` is now optional in validation to allow fallback to legacy `DB_*` variables
  - Legacy `DB_*` variables are now optional when `DATABASE_URL` is set
  - Runtime check ensures `DATABASE_URL` is required for main application
  - Location: `src/env.js`, `src/server/db/index.ts`, `drizzle.env.ts`

### Fixed

#### SSL Configuration

- **SSL Support for Non-Neon Databases**: Restored SSL configuration for cloud databases using legacy variables
  - Added SSL detection for Aiven, AWS RDS, and other cloud providers
  - Automatically configures SSL certificates from `certs/ca.pem` or `DB_SSL_CA` environment variable
  - Skips SSL for local databases and Neon (handles SSL automatically)
  - Location: `drizzle.config.ts`, `scripts/check-users.ts`, `scripts/populate-userhash.ts`, `scripts/set-profile-public.ts`

- **SSL Configuration Duplication**: Fixed duplicate function calls in SSL configuration
  - Cached `getSslConfig()` result to prevent duplicate log messages
  - Optimized SSL config evaluation to call function only once
  - Location: `scripts/check-users.ts`, `scripts/populate-userhash.ts`, `scripts/set-profile-public.ts`

- **SSL Configuration in Migration Scripts**: Added SSL support to `mark-migrations-simple.js`
  - Added `getSslConfig()` function matching other utility scripts
  - Properly handles Neon, local, and cloud database SSL requirements
  - Location: `scripts/mark-migrations-simple.js`

- **Neon SSL Handling Consistency**: Fixed inconsistent Neon SSL handling in migration script
  - `migrate-to-neon.ts` now returns `undefined` for Neon databases (consistent with other scripts)
  - Removed lenient SSL fallback for Neon, as SSL is handled automatically via connection string
  - Location: `scripts/migrate-to-neon.ts`

- **SSL Configuration Fallback Path**: Fixed missing SSL configuration when using legacy `DB_*` variables
  - Restored `ssl: getSslConfig()` in fallback `dbCredentials` object
  - Ensures cloud databases using legacy variables have proper SSL configuration
  - Fixed malformed connection string construction in `getSslConfig()` fallback
  - Location: `drizzle.config.ts`

#### Environment Variable Handling

- **Empty String Handling**: Fixed `optional()` function to return `undefined` instead of empty strings
  - Prevents empty strings from being passed as database credentials
  - Added explicit checks in `drizzle.config.ts` to handle `undefined` values
  - Location: `drizzle.env.ts`, `drizzle.config.ts`

- **Empty String Normalization**: Fixed empty `DATABASE_URL` handling in `drizzle.config.ts`
  - Empty strings are now normalized to `undefined` to trigger fallback to legacy variables
  - Fixed nullish coalescing operator (`??`) issue where empty strings were treated as truthy
  - Ensures consistent behavior with `src/env.js` validation
  - Location: `drizzle.config.ts`

- **Fallback Mechanism**: Fixed `DATABASE_URL` validation to allow fallback to legacy variables
  - Made `DATABASE_URL` optional in `src/env.js` to allow `drizzle-kit` fallback
  - Added runtime check in `src/server/db/index.ts` to ensure `DATABASE_URL` is set for main app
  - Location: `src/env.js`, `src/server/db/index.ts`

#### Migration Script Improvements

- **Column Compatibility**: Enhanced migration script to handle schema differences
  - Only copies columns that exist in both source and target databases
  - Logs warnings for missing columns instead of failing
  - Handles sequence resets only for columns that exist in target
  - Location: `scripts/migrate-to-neon.ts`

- **SSL Certificate Generation**: Skip SSL cert generation for Neon databases
  - Automatically detects Neon databases and skips certificate generation
  - Location: `scripts/generate-ssl-cert.js`

#### Critical Production Fixes (2026-01-07)

- **SSL Certificate Removal**: Removed unnecessary custom CA certificate checking after Neon migration
  - Deleted `certs/` directory and all certificate file references
  - Removed `DB_SSL_CA` environment variable from validation
  - Simplified SSL configuration to use Node.js built-in certificate trust
  - Fixed local server crashes due to missing certificate files
  - Location: `src/server/db/index.ts`, `drizzle.config.ts`, `src/env.js`, `.env.example`, `.env.vercel.example`

- **Database Sequence Synchronization**: Fixed PostgreSQL identity sequences out of sync with data
  - `playlist_track`: sequence=8, max_id=125 (off by 117)
  - `search_history`: sequence=8, max_id=560 (off by 552)
  - `listening_history`: sequence=5, max_id=939 (off by 934)
  - `favorite`: sequence=2, max_id=58 (off by 56)
  - Fixed duplicate key violations preventing new database writes
  - All sequences now synchronized using `setval()` to match max IDs

- **Listening History Validation**: Simplified track data validation for history recording
  - Reduced required fields from 30+ to just 3 essential fields
  - Required: `id` (number), `title` (string), `artist.name` (string)
  - Removed strict requirements for: images, preview URLs, MD5 hashes, explicit content flags, album data
  - Fixed issue where tracks with incomplete metadata were not being added to listening history
  - Location: `src/contexts/AudioPlayerContext.tsx:108-121`

- **Search Results Play Button**: Fixed unresponsive play button on first tap (mobile)
  - Play button overlay now always visible on mobile (80% opacity) for immediate interaction
  - Desktop maintains original hover behavior (0% → 100% opacity on hover)
  - Resolved issue where first tap only showed the button, requiring a second tap to play
  - Location: `src/components/SwipeableTrackCard.tsx:259`

- **Mobile UI Improvements**: Spotify-like mobile experience with cleaner interface
  - Removed duplicate search bar from page content (now only in persistent header)
  - Enhanced MobileHeader search bar with full features:
    - Recent searches dropdown (authenticated users)
    - Voice search support (where available)
    - Loading states and haptic feedback
    - Clear button with smooth animations
  - MobileHeader now syncs with URL search parameters
  - Search bar state persists across navigation
  - Homepage bundle size reduced from 11.1 kB to 9.42 kB (15% smaller)
  - Wrapped MobileHeader in Suspense boundary for proper Next.js compatibility
  - Location: `src/components/MobileHeader.tsx`, `src/app/HomePageClient.tsx`, `src/app/layout.tsx`

- **Modern Phone Screen Optimizations**: Tailored layouts for 2024-2026 flagship devices
  - **iPhone Support**:
    - iPhone 16/15/14 Pro Max (430×932): Optimized for extra-tall screens, 380px artwork
    - iPhone 16/15 Pro (393×852): Dynamic Island aware spacing, 350px artwork
    - Standard iPhones (390×844): Notch-optimized spacing, 340px artwork
    - iPhone SE / Compact (< 375px): Reduced text sizes and compact padding, 280px artwork
  - **Samsung Galaxy Support**:
    - Galaxy S24/S23 Ultra (412×915): One UI gesture navigation spacing, 370px artwork
    - Galaxy S24/S23 (360-384×854): Compact spacing optimizations, 320px artwork
  - **Other Android**:
    - Pixel 7/8 Pro (412×915): Material You navigation spacing, 365px artwork
    - Extra tall phones (> 950px height): Foldables and ultra-tall displays, 400px artwork
  - **Additional Optimizations**:
    - Landscape mode: Compact two-column layout, 200px artwork
    - High-DPI displays (Retina/AMOLED): Enhanced backdrop blur, gradient softening
    - Safe area inset handling for all notch/punch-hole/dynamic island designs
    - Adaptive header and player heights based on device screen size
  - Location: `src/styles/globals.css:1666-1884`

- **Header Logo Navigation**: Logo now works as a proper Home button without page reload
  - Uses client-side routing via Next.js router for instant navigation
  - When already on home page: clears search parameters and smoothly scrolls to top
  - When on other pages: navigates to home page without full page reload
  - Maintains smooth single-page application experience
  - Location: `src/components/Header.tsx:58-78`

- **Playlist Page UI**: Converted text buttons to icon-only circular buttons for cleaner design
  - Play All: Play icon in primary button
  - Make Private/Public: Lock/Unlock icons in secondary button
  - Save Changes: Save icon in primary button (only visible when changes are made)
  - Share: Share2 icon in secondary button (only visible for public playlists)
  - Delete Playlist: Trash icon in danger button
  - All buttons are 44×44px circular with tooltips on hover
  - Loading states show spinner icon for visibility toggle and save operations
  - Maintains full accessibility with aria-labels and title attributes
  - Location: `src/app/playlists/[id]/page.tsx:397-467`

- **Electron Discord OAuth**: Fixed black screen when logging into Discord in Electron app
  - Added proper navigation handlers for OAuth flows (`will-navigate`, `did-navigate`, `setWindowOpenHandler`)
  - Discord OAuth URLs now properly open and redirect back to the app
  - Same-origin navigation (including auth callbacks) allowed within the app window
  - External URLs automatically open in system default browser
  - Added `shell` module import for external link handling
  - Location: `electron/main.cjs:366-418`
  - **Note:** Requires Electron app rebuild: `npm run electron:build:win` / `:mac` / `:linux`

- **Webpack Module Resolution**: Fixed authentication 500 error due to aggressive code splitting
  - Removed complex webpack `splitChunks` configuration with dynamic naming
  - Simplified to deterministic module IDs only
  - Fixed runtime error: `TypeError: a[d] is not a function`
  - Bundle size reduced from 204 kB to 102 kB (50% improvement)
  - Location: `next.config.js`

- **Vercel Build Configuration**: Fixed CHANGELOG.md exclusion in Vercel builds
  - Added `!CHANGELOG.md` to `.vercelignore` to allow file in builds
  - Fixed build error: `cp: cannot stat 'CHANGELOG.md': No such file or directory`
  - Location: `.vercelignore`

## [0.8.2] - 2025-12-31

### Added

#### Search Results Context Menu

- **Right-Click Track Menu**: Added track context menu support to search results
  - Right-click (or long-press on mobile) any track in search results to open context menu
  - Full feature parity with other track displays (queue, playlists, library)
  - Menu options: Play, Add to Queue, Play Next, Favorite, Add to Playlist, Share, Go to Artist, Go to Album
  - Haptic feedback on menu open for better mobile experience
  - Location: `src/components/SwipeableTrackCard.tsx:6, 57, 151-155, 242`

#### Queue Multi-Select and Mass Actions

- **Keyboard Navigation**: Implemented keyboard-driven multi-select for queue management
  - Click individual tracks to select/deselect
  - Shift+Arrow Up/Down for range selection
  - Visual indication with teal accent ring for selected tracks
  - Mass action bar appears when tracks are selected, showing count and action buttons
  - Location: `src/components/EnhancedQueue.tsx:43-54, 220-223, 244-245, 388-465`

- **Mass Actions**:
  - Remove multiple tracks at once (Remove button or Del/Backspace key)
  - Clear selection (Clear button or Escape key)
  - Smart removal order (descending indices to prevent shifting issues)
  - Toast notification showing number of tracks removed
  - Location: `src/components/EnhancedQueue.tsx:421-435, 567-588`

- **UI Enhancements**:
  - Remove button now hidden for currently playing track (index 0) since it cannot be removed
  - Helpful keyboard shortcut hints in footer
  - Selection state persists until explicitly cleared
  - Click detection intelligently avoids triggering selection when clicking buttons
  - Location: `src/components/EnhancedQueue.tsx:102-108, 182-193, 1034-1038`

### Fixed

#### Track Validation Errors (Album & Search)

- **Add to Playlist/Favorites Validation**: Fixed validation errors when adding tracks from various sources to playlists or favorites
  - Root cause: Some tracks have incomplete metadata from the Starchild API
  - Issues fixed:
    1. Artist objects from album endpoints lacked picture fields (link, picture, picture_small, picture_medium, picture_big, picture_xl, tracklist)
    2. Some tracks missing `title_version` field entirely
  - Solution: Made optional fields in both Zod schema and TypeScript type definition:
    - Artist: `link`, `picture`, `picture_small`, `picture_medium`, `picture_big`, `picture_xl`, `tracklist`
    - Track: `title_version`
  - All tracks now validate correctly regardless of completeness
  - Image utility functions already had fallback handling for missing fields
  - Location: `src/types/index.ts:14-25, 49-69`, `src/server/api/routers/music.ts:39-78`

#### Queue Track Progression (CRITICAL)

- **Queue Stuck on First Track**: Fixed critical bug where queue would not advance past the first song
  - Root cause: `handleTrackEnd` function had stale closure over `queuedTracks`
  - The dependency array included `queue` (derived value) but the function actually used `queuedTracks.length` directly
  - This caused the track-end handler to check an outdated queue length, preventing progression to next track
  - Solution: Updated dependency array to use `queuedTracks` instead of `queue`
  - Queue now properly advances through all tracks as expected
  - Also optimized `removeFromQueue` to avoid unnecessary re-renders
  - Location: `src/hooks/useAudioPlayer.ts:265, 1049`

#### Queue Track Removal

- **Remove Button Visibility**: Fixed remove button showing for currently playing track which cannot be removed
  - Added `canRemove` prop to `SortableQueueItem` to conditionally show remove button
  - Currently playing track (index 0) now correctly hides the remove button
  - Added enhanced logging to `removeFromQueue` function for debugging
  - Location: `src/components/EnhancedQueue.tsx:53, 182-193`, `src/hooks/useAudioPlayer.ts:1026-1050`

#### Search Results Persistence Bug

- **Stale Search Results**: Fixed issue where top 1-2 results from previous searches would stick at the top when performing multiple searches in a row
  - Root cause: Search results were not cleared immediately when starting a new search, allowing old results to persist until new API response arrived
  - Solution: Clear results immediately when starting any new search operation
  - Applied to all search functions: `performSearch`, `handleArtistClick`, `handleAlbumClick`, and `handleShufflePlay`
  - Results now clear instantly when a new search starts, preventing stale data from showing
  - Location: `src/app/HomePageClient.tsx:67-97, 276-311, 99-157, 316-350`

#### Rapid Pause/Unpause Bug

- **Audio Player State Loop**: Fixed critical bug where audio would rapidly pause and unpause (~10 times per second) requiring page refresh
  - Root cause: Multiple issues causing feedback loops between React state and audio element state:
    1. State sync polling creating feedback loops
    2. Event handlers firing without guards against rapid state changes
    3. Race conditions between React state updates and audio element state
  - Solution: Implemented comprehensive guards to prevent rapid state changes:
    - Added `isPlayPauseOperationRef` to track in-progress play/pause operations
    - Added guards to `play()` and `pause()` functions to prevent concurrent operations
    - Enhanced event handlers (`handlePlay`, `handlePause`) to only update state when actually different
    - Improved state sync polling with debouncing (200ms minimum between syncs)
    - Updated media session handlers to use guarded functions
    - Added ref-based state tracking to avoid stale closures
  - Play/pause operations now properly guarded against rapid toggling
  - State sync mechanism prevents feedback loops
  - Location: `src/hooks/useAudioPlayer.ts:64-66, 404-417, 626-738, 740-756, 1278-1290, 288-300`

#### Queue Persistence Issues

- **Queue Refilling After Tab Switch**: Fixed queue being restored after clearing when switching tabs
  - Root cause: `clearQueue` only cleared in-memory state but didn't clear persisted localStorage, causing restoration on remount
  - Solution:
    - `clearQueue` now immediately clears localStorage when queue becomes empty
    - Added guard in load effect to prevent restoring empty queues (intentionally cleared)
    - `clearQueueAndHistory` also clears persisted state
  - Clearing queue is now final - it stays cleared even after tab switches
  - Location: `src/hooks/useAudioPlayer.ts:1017-1025, 1446-1458, 109-160`

### Added

#### Database Queue Persistence for Logged-In Users

- **Queue State Persistence**: Added comprehensive queue persistence system supporting both database (logged-in users) and localStorage (non-logged-in users)
  - **Database Schema**: Added `queueState` JSONB field to `userPreferences` table
    - Stores complete queue state including queuedTracks, smartQueueState, history, shuffle, and repeat mode
    - Location: `src/server/db/schema.ts:242-252`
  - **API Endpoints**: Added three new tRPC endpoints for queue state management
    - `saveQueueState` - Saves queue state to database (debounced, 1 second)
    - `getQueueState` - Retrieves queue state from database
    - `clearQueueState` - Clears queue state from database
    - Location: `src/server/api/routers/music.ts:813-880`
  - **Automatic Sync**: Queue state automatically syncs between database and localStorage
    - Logged-in users: Queue saved to database, restored on login
    - Non-logged-in users: Queue saved to localStorage (existing behavior)
    - Priority: Database (if logged in) > localStorage (if not logged in)
    - Location: `src/contexts/AudioPlayerContext.tsx:99-105, 235-285`
  - **Initial State Restoration**: Added `initialQueueState` option to `useAudioPlayer` hook
    - Allows restoring queue from database on component mount
    - Prevents overwriting active queue when restoring
    - Location: `src/hooks/useAudioPlayer.ts:15-25, 27-28, 109-160`
  - **Smart Clearing**: Queue clearing now works in both storage locations
    - When queue is cleared, it's removed from both database and localStorage
    - Empty queues are not restored (intentionally cleared state)
    - Location: `src/contexts/AudioPlayerContext.tsx:260-285`

### Changed

#### Queue Persistence Architecture

- **Dual Storage System**: Queue now persists in appropriate storage based on authentication status
  - Logged-in users: Database persistence with automatic sync
  - Non-logged-in users: localStorage persistence (unchanged)
  - Seamless transition between storage methods on login/logout
  - Location: `src/contexts/AudioPlayerContext.tsx:235-285`

### Technical Details

**Search Results Fix:**

- All search functions now call `setResults([])` and `setTotal(0)` immediately when starting
- Prevents race conditions where previous search responses could arrive after new search starts
- Ensures clean state for every new search operation

**Audio Player State Management:**

- Operation guards prevent concurrent play/pause operations
- Event handlers use refs to avoid stale closure issues
- State sync polling includes debouncing to prevent rapid updates
- Media session handlers use guarded functions instead of direct audio manipulation

**Queue Persistence Flow:**

1. On mount: Load from database (if logged in) or localStorage (if not logged in)
2. On change: Save to appropriate storage (debounced for database, immediate for localStorage)
3. On clear: Remove from both storage locations
4. On tab switch: Restore only if queue has actual tracks (not empty/cleared)

**Database Migration Required:**

```sql
ALTER TABLE "hexmusic-stream_user_preferences"
ADD COLUMN "queueState" jsonb DEFAULT NULL;
```

**Files Modified:**

- Modified: `src/app/HomePageClient.tsx` (search results clearing)
- Modified: `src/hooks/useAudioPlayer.ts` (pause/unpause guards, queue clearing, initial state support)
- Modified: `src/contexts/AudioPlayerContext.tsx` (database queue persistence)
- Modified: `src/server/db/schema.ts` (queueState field)
- Modified: `src/server/api/routers/music.ts` (queue state API endpoints)

## [0.8.1] - 2025-12-31

### Added

#### Universal Right-Click Context Menu for Tracks

- **New Feature**: Horizontal context menu that appears on right-click for any track
  - **Design**: Sleek horizontal toolbar with icon + label for each action
  - **Positioning**: Smart positioning near cursor, automatically adjusts to stay within viewport
  - **Actions included**:
    - Play now
    - Add to queue
    - Play next
    - Favorite/unfavorite (authenticated users)
    - Add to playlist (authenticated users)
    - Share (if Web Share API supported)
    - Go to artist
    - Go to album
  - **Features**:
    - Backdrop dismissal (click outside to close)
    - Keyboard navigation (Escape to close)
    - Haptic feedback on mobile
    - Smooth animations (slide in/fade)
    - Z-index hierarchy (z-70/z-71, below modals)
  - **Extensibility**: Easy to add more actions in the future
  - **Files**:
    - `src/contexts/TrackContextMenuContext.tsx` - Context provider for menu state (~60 lines)
    - `src/components/TrackContextMenu.tsx` - Horizontal menu component (~400 lines)
    - Modified: `src/components/EnhancedTrackCard.tsx` - Added `onContextMenu` handler + `excludePlaylistId` prop
    - Modified: `src/app/layout.tsx` - Added provider and menu component to root layout
    - Modified: `src/app/playlists/[id]/page.tsx` - Pass `excludePlaylistId` to track cards

#### Universal Right-Click Context Menu for Playlists

- **New Feature**: Horizontal context menu for playlist cards on `/playlists` page
  - **Design**: Matches track context menu style - horizontal toolbar with icons and labels
  - **Positioning**: Smart viewport-aware positioning
  - **Actions included**:
    - Play all - Start playing all tracks in the playlist
    - Add all to queue - Add all tracks to queue
    - Merge - Combine with another playlist (placeholder for future implementation)
    - Share - Share playlist URL (only for public playlists)
    - Edit - Navigate to playlist detail page
    - Toggle Public/Private - Change playlist visibility
    - Duplicate - Create a copy of the playlist
    - Delete - Remove playlist (with confirmation)
  - **Features**:
    - Backdrop dismissal (click outside to close)
    - Keyboard navigation (Escape to close)
    - Haptic feedback on mobile
    - Smooth animations (slide in/fade)
    - Z-index hierarchy (z-70/z-71, same as track menu)
    - Disabled state for actions that don't apply (e.g., share when private)
  - **Files**:
    - `src/contexts/PlaylistContextMenuContext.tsx` - Context provider for menu state (~50 lines)
    - `src/components/PlaylistContextMenu.tsx` - Horizontal menu component (~470 lines)
    - Modified: `src/app/layout.tsx` - Added provider and menu component
    - Modified: `src/app/playlists/page.tsx` - Added `onContextMenu` handler to playlist cards

#### Add to Playlist Modal (Spotify-Style UX)

- **New Modal Component**: Implemented searchable modal for adding tracks to playlists across the entire app
  - User request: Ability to organize tracks from "mega-playlist" into thematic playlists
  - Features:
    - Search functionality (client-side filtering by playlist name and description)
    - Checkmarks indicating playlists that already contain the track
    - Empty states for no playlists and no search results
    - Keyboard navigation (Escape to close, Tab navigation)
    - Haptic feedback for mobile interactions
    - Framer Motion animations (slide-in, fade, scale)
  - Locations:
    - `src/components/AddToPlaylistModal.tsx` - New modal component (~370 lines)

#### Backend API Enhancement

- **New tRPC Query**: `getPlaylistsWithTrackStatus` for fetching playlists with track inclusion status
  - Input: `{ trackId: number, excludePlaylistId?: number }`
  - Returns playlists with `hasTrack` boolean indicating if track exists in playlist
  - Uses Promise.all for parallel track existence checks (optimized performance)
  - Locations:
    - `src/server/api/routers/music.ts:407-451` - New query implementation
    - `src/types/index.ts:278-289` - PlaylistWithTrackStatus type definition

### Changed

#### Track Card Components

- **EnhancedTrackCard**: Replaced inline playlist dropdown with modal
  - Removed playlist query and mutation (now handled by modal)
  - Replaced dropdown menu (lines 272-318) with button + modal
  - Net change: -30 lines (cleaner component)
  - Location: `src/components/EnhancedTrackCard.tsx`

- **TrackCard**: Replaced inline playlist dropdown with modal
  - Same pattern as EnhancedTrackCard
  - Net change: -23 lines
  - Location: `src/components/TrackCard.tsx`

- **SwipeableTrackCard**: Integrated modal while preserving "Play Next" functionality
  - Modified menu to keep "Play Next" button
  - Replaced playlist dropdown section with "Add to Playlist" button that opens modal
  - Net change: +5 lines (preserved existing functionality)
  - Location: `src/components/SwipeableTrackCard.tsx`

#### Desktop Player

- **Player (MaturePlayer)**: Integrated Add to Playlist modal
  - Removed inline playlist dropdown
  - Replaced with modal-based UI (matching mobile UX)
  - Removed playlist query and mutation (lines 112-127)
  - Replaced dropdown section (lines 264-339) with button + modal
  - Location: `src/components/Player.tsx`

### Fixed

#### Add to Playlist Modal Z-Index and Authentication

- **Modal Not Visible**: Fixed z-index hierarchy so modal always appears on top
  - Changed backdrop from z-70 to z-100
  - Changed modal from z-71 to z-101 (highest in app)
  - Now appears above mobile player (z-98-99) and all other UI elements
  - Location: `src/components/AddToPlaylistModal.tsx:137,150`

- **Authentication Handling**: Added proper authentication checks
  - Modal now detects if user is signed in
  - Shows "Sign in to create playlists" message for unauthenticated users
  - Query only runs when both modal is open AND user is authenticated
  - Prevents unnecessary API calls for logged-out users
  - Location: `src/components/AddToPlaylistModal.tsx:37-38,44,196-215,247`

#### Skip Forward/Backward Buttons

- **Non-Finite Value Error**: Fixed `TypeError: Failed to set the 'currentTime' property on 'HTMLMediaElement': The provided double value is non-finite`
  - Root cause: When audio duration is `NaN` or `Infinity`, skip functions calculated non-finite values
  - Solution: Added triple-layer validation to prevent NaN values from reaching seek function
  - Defense in depth approach:
    1. Validate `seconds` parameter (fallback to 10 if invalid)
    2. Validate `currentTime` and `duration` from audio element
    3. Validate calculated `newTime` before calling seek
    4. Final validation in `seek()` function itself
  - Locations:
    - `src/hooks/useAudioPlayer.ts:713-724` - seek() validates time parameter
    - `src/hooks/useAudioPlayer.ts:1165-1194` - skipForward() triple validation
    - `src/hooks/useAudioPlayer.ts:1196-1224` - skipBackward() triple validation

#### Playlist Detail Page Actions

- **Action Buttons Hidden for Playlist Owners**: Fixed EnhancedTrackCard not showing action buttons on playlist detail pages when viewing your own playlists
  - Root cause: Playlist detail page passed `showActions={!isOwner}`, hiding all action buttons for playlist owners
  - Impact: Prevented users from:
    - Adding tracks to other playlists (the original user request)
    - Adding tracks to queue
    - Favoriting tracks
    - Sharing tracks
  - Solution: Changed to `showActions={true}` to always show action buttons regardless of ownership
  - Now playlist owners can organize tracks from their playlists into other thematic playlists
  - Location: `src/app/playlists/[id]/page.tsx:534`

### Technical Details

**Modal Architecture:**

- Z-index hierarchy: Modal (z-100/z-101) highest in app, above all elements
- Query optimization: Only fetches playlist data when modal is open AND user is authenticated
- Client-side search: useMemo for efficient filtering without server calls
- Responsive design: Mobile-first with max-width constraint (28rem) on desktop
- Authentication: Shows sign-in prompt for unauthenticated users

**User Experience Improvements:**

- Consistent UI across mobile and desktop platforms
- Reduced visual clutter by replacing inline dropdowns
- Better discoverability of playlists (search + visual status indicators)
- Prevents duplicate additions (checkmarks + disabled state)

**Files Modified:**

- New: `src/contexts/TrackContextMenuContext.tsx` - Context menu state provider
- New: `src/components/TrackContextMenu.tsx` - Universal context menu component
- New: `src/components/AddToPlaylistModal.tsx` - Modal component
- Modified: `src/app/layout.tsx` - Added context menu provider and component
- Modified: `src/server/api/routers/music.ts` - Backend query
- Modified: `src/types/index.ts` - Type definitions
- Modified: `src/components/EnhancedTrackCard.tsx` - Modal integration + context menu handler
- Modified: `src/components/TrackCard.tsx` - Modal integration
- Modified: `src/components/SwipeableTrackCard.tsx` - Modal integration
- Modified: `src/components/Player.tsx` - Desktop player integration
- Modified: `src/hooks/useAudioPlayer.ts` - Skip button validation
- Modified: `src/app/playlists/[id]/page.tsx` - Enable actions for playlist owners + context menu support

## [0.8.0] - 2025-12-29

### Fixed

#### Audio Player State Synchronization

- **Pause Button Not Working**: Fixed infinite play/pause loop caused by React state being out of sync with audio element state
  - Root cause: useEffect dependency on `isPlaying` triggered when user paused, causing immediate auto-play
  - Solution: Removed `isPlaying` from dependency array and eliminated auto-play for already-loaded tracks
  - Added polling mechanism (500ms) to sync React state with actual audio element state
  - Locations:
    - `src/hooks/useAudioPlayer.ts:694-711` - togglePlay checks actual audio state
    - `src/hooks/useAudioPlayer.ts:1080` - Removed isPlaying from dependency array
    - `src/hooks/useAudioPlayer.ts:1084-1096` - Added state sync polling

#### Visualizer Animation Lifecycle

- **Visualizer Not Responding to Play/Pause**: Fixed animation loop not starting/stopping with playback
  - Root cause: Animation loop only triggered on audioElement changes, not play/pause state changes
  - Solution: Added play/pause event listeners to track audio state and trigger animation loop
  - Animation now properly starts when playing and stops when paused
  - Locations:
    - `src/components/FlowFieldBackground.tsx:32-57` - Added play/pause event listeners
    - `src/components/FlowFieldBackground.tsx:150-154` - Animation loop depends on isPlaying state
    - `src/components/PersistentPlayer.tsx:294-297` - Fixed prop mismatch (audioElement vs analyser/audioContext)

#### Browser Autoplay Policy Compliance

- **NotAllowedError on Page Load**: Fixed browser blocking audio autoplay on initial page load
  - Solution: Skip auto-play on first render when restoring queue from localStorage
  - User must explicitly click play or select a song for audio to start
  - Locations:
    - `src/hooks/useAudioPlayer.ts:1052-1056` - Skip auto-play on initial mount
    - `src/hooks/useAudioPlayer.ts:112-122` - Initialize audio source without playing

### Technical Details

**State Synchronization Architecture:**

- Audio element's `.paused` property is now the source of truth
- React `isPlaying` state synced via:
  1. Audio element event listeners (play/pause events)
  2. Polling fallback (500ms) to catch missed events
  3. Direct checks in togglePlay and visualizer
- UI button icons always match actual playback state

**Visualizer Event-Driven Updates:**

```
Audio Element Events → FlowFieldBackground State → Animation Loop
     play event      →   setIsPlaying(true)     →   Start animating
    pause event      →   setIsPlaying(false)    →   Stop animating
```

**Files Modified:**

- Modified: `src/hooks/useAudioPlayer.ts` - State sync, autoplay prevention, pause button fix
- Modified: `src/components/FlowFieldBackground.tsx` - Event-driven animation, play/pause tracking
- Modified: `src/components/PersistentPlayer.tsx` - Fixed visualizer props

## [0.7.9] - 2025-12-29

### Fixed

#### Audio Context Stability

- **Critical Audio Context Error**: Resolved `InvalidStateError: Failed to execute 'createMediaElementSource'`
  - Fixed conflict where both equalizer and visualizer were creating separate MediaElementSource nodes
  - Browser limitation: Only ONE MediaElementSource allowed per HTMLMediaElement
  - Implemented shared audio graph architecture with single source node
  - Locations:
    - `src/hooks/useEqualizer.ts:51,201-212,390-391` - Added analyser node to equalizer chain
    - `src/components/FlowFieldBackground.tsx:8-13,15-23` - Simplified to use shared analyser
    - `src/components/PersistentPlayer.tsx:293-300` - Wired shared analyser between components

### Technical Details

**Previous Architecture (Broken):**

```
Audio Element → useEqualizer creates source → filters → destination
Audio Element → FlowFieldBackground creates source → analyser → destination
                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                ERROR: Can't create 2nd source from same element!
```

**New Architecture (Fixed):**

```
Audio Element → useEqualizer creates ONE source → filters → analyser → destination
                                                              ↑
                                                 FlowFieldBackground uses this
```

**Audio Chain Flow:**

- Single `MediaElementAudioSourceNode` created in `useEqualizer`
- Connected through 9 equalizer filter nodes
- Flows to `AnalyserNode` (shared with visualizer)
- Finally connects to `AudioContext.destination` (speakers)
- When equalizer disabled: source connects directly to analyser (bypassing filters)

**Benefits:**

- Eliminates dual source node creation errors
- Maintains equalizer functionality (10-band EQ, presets)
- Preserves visualizer audio reactivity (flow field patterns)
- Cleaner architecture with single source of truth
- Proper resource cleanup on unmount

## [0.7.8] - 2025-12-29

### Fixed

#### Audio Player Controls

- **Pause Button Reliability**: Enhanced pause functionality with proper error handling
  - Added audio element initialization check before pausing
  - Implemented try-catch error handling to prevent pause failures
  - Added logging to help diagnose playback issues
  - Ensures isPlaying state always syncs correctly with audio element
  - Location: `src/hooks/useAudioPlayer.ts:551-567`

- **Queue Clearing on Track End**: Fixed queue not clearing when single song finishes playing
  - When a track ends with no more tracks in queue, the queue is now properly cleared
  - Prevents stale track from remaining in queue after playback completes
  - Added logging to confirm queue clearing behavior
  - Location: `src/hooks/useAudioPlayer.ts:156-165`

### Technical Details

**Pause Function Enhancement:**

The pause function now includes comprehensive error handling:

```typescript
const pause = useCallback(() => {
  if (!audioRef.current) {
    console.warn(
      "[useAudioPlayer] Cannot pause: audio element not initialized",
    );
    setIsPlaying(false);
    return;
  }

  try {
    audioRef.current.pause();
    setIsPlaying(false);
  } catch (error) {
    console.error("[useAudioPlayer] Error pausing audio:", error);
    setIsPlaying(false);
  }
}, []);
```

**Queue Clearing Logic:**

When `handleTrackEnd()` is called with no remaining tracks in queue:

```typescript
} else {
  // No more tracks in queue, playback ends
  onTrackEnd?.(currentTrack);
  // Clear the queue since playback is complete
  setQueue([]);
  setIsPlaying(false);
  console.log("[useAudioPlayer] 🏁 Playback ended, queue cleared");
}
```

**Benefits:**

- More reliable pause/play toggling
- Cleaner queue state management
- Better user experience when playing single tracks
- Improved debugging with enhanced logging

**Files Modified:**

- Modified: `src/hooks/useAudioPlayer.ts` (pause function + queue clearing logic)

## [0.7.7] - 2025-12-30

### Fixed

#### Critical Audio Context Stability Issue

- **Visualizer Toggle Error Resolution**: Fixed critical `InvalidStateError` when toggling visualizer on/off
  - Root cause: HTMLAudioElement can only be connected to one MediaElementSourceNode (browser limitation)
  - When visualizer was toggled off and back on, component remounted and attempted to reconnect the same audio element
  - This caused `InvalidStateError: Failed to execute 'createMediaElementSource'` errors requiring page reload
  - **Solution**: Implemented global WeakMap to track connected audio elements and reuse existing connections
  - Audio element connections now persist across component lifecycle changes
  - Visualizer can be toggled on/off without errors or page reloads
  - Location: `src/components/FlowFieldBackground.tsx:27-70`

#### Profile Page Authentication Errors

- **UNAUTHORIZED Error Elimination**: Fixed excessive UNAUTHORIZED errors when viewing profile pages
  - Root cause: Track card components (`EnhancedTrackCard`, `TrackCard`, `Player`) were calling authenticated endpoints (`music.isFavorite`, `music.getPlaylists`) without checking authentication status
  - When viewing someone else's profile (or when not logged in), these queries were called and failed with UNAUTHORIZED
  - This caused hundreds of error logs and degraded performance
  - **Solution**: Added authentication checks using `useSession` hook before calling protected endpoints
  - Queries now only execute when user is authenticated
  - Eliminated all UNAUTHORIZED errors on public profile pages
  - Components gracefully handle unauthenticated state (favorite/playlist features simply unavailable)
  - Location: `src/components/EnhancedTrackCard.tsx:32-35, 59-61`
  - Location: `src/components/TrackCard.tsx:36-39, 63-65`
  - Location: `src/components/Player.tsx:85-88, 109-111`

### Changed

#### Pattern Controls Enhancement

- **Pattern Duration Range**: Increased maximum pattern duration from 1000 to 10000 frames
  - Minimum remains at 10 frames (default unchanged)
  - Allows for much longer pattern displays for extended viewing
  - Updated validation in FlowFieldRenderer to accept new range (10-10000)
  - Location: `src/components/PatternControls.tsx:306-319`
  - Location: `src/components/visualizers/FlowFieldRenderer.ts:10969-10971`

### Technical Details

**Audio Context Connection Management:**

The fix implements a global WeakMap to track audio elements that have been connected to MediaElementSourceNodes:

```typescript
const connectedAudioElements = new WeakMap<
  HTMLAudioElement,
  {
    sourceNode: MediaElementAudioSourceNode;
    audioContext: AudioContext;
    analyser: AnalyserNode;
  }
>();
```

**Key Improvements:**

1. **Connection Reuse**: When FlowFieldBackground remounts with the same audio element, it reuses the existing connection instead of attempting to create a new one
2. **Global Tracking**: WeakMap ensures connections persist across component unmounts/remounts
3. **Proper Cleanup**: Source nodes are never disconnected from audio elements (they can't be reconnected), only component refs are reset
4. **Error Prevention**: Eliminates all `InvalidStateError` exceptions related to audio context

**Authentication-Aware Query Execution:**

All track card components now check authentication before calling protected endpoints:

```typescript
const { data: session } = useSession();
const isAuthenticated = !!session;

const { data: favoriteData } = api.music.isFavorite.useQuery(
  { trackId: track.id },
  { enabled: showActions && isAuthenticated },
);
```

**Benefits:**

- Zero UNAUTHORIZED errors on public profile pages
- Reduced server load (no unnecessary failed queries)
- Cleaner console logs
- Better user experience (no error spam)
- Graceful degradation for unauthenticated users

**Files Modified:**

- Modified: `src/components/FlowFieldBackground.tsx` (audio context connection management)
- Modified: `src/components/EnhancedTrackCard.tsx` (authentication checks)
- Modified: `src/components/TrackCard.tsx` (authentication checks)
- Modified: `src/components/Player.tsx` (authentication checks)
- Modified: `src/components/PatternControls.tsx` (pattern duration range)
- Modified: `src/components/visualizers/FlowFieldRenderer.ts` (pattern duration validation)
- Modified: `package.json` (version bump to 0.7.7)

### Stability Improvements Summary

This release focuses on **critical stability improvements** that eliminate errors and improve reliability:

1. **Visualizer Toggle Stability**: Users can now toggle the visualizer on/off without encountering errors or needing to reload the page
2. **Profile Page Stability**: Public profile pages load without generating hundreds of UNAUTHORIZED errors
3. **Error Reduction**: Eliminated all `InvalidStateError` and UNAUTHORIZED errors related to audio context and authentication
4. **Performance**: Reduced unnecessary API calls and error handling overhead
5. **User Experience**: Smoother interactions with no error spam in console logs

These fixes address fundamental stability issues that were causing user-facing errors and requiring page reloads.

## [0.7.6] - 2025-12-29

### Added

#### Database Migration to NEON Postgres

- **NEON Postgres Migration Script**: Comprehensive database migration tool for transferring data to NEON Postgres
  - Full data migration from source database to NEON Postgres
  - Automatic table discovery with dependency-aware ordering (respects foreign keys)
  - Batch processing (1000 rows per batch) for optimal performance
  - Progress tracking with colored console output
  - Data verification after migration (row count comparison)
  - Automatic sequence reset for auto-increment columns
  - JSONB column handling with proper serialization
  - Error handling for invalid JSON data (skips problematic rows)
  - Schema validation before migration (ensures target schema exists)
  - Table existence checks before copying
  - Safe re-run capability (uses `ON CONFLICT DO NOTHING` to prevent duplicates)
  - Location: `scripts/migrate-to-neon.ts` (477 lines)

- **Migration Documentation**: Comprehensive migration guide with troubleshooting
  - Step-by-step migration instructions
  - Prerequisites and setup requirements
  - Alternative migration methods (pg_dump/pg_restore)
  - Post-migration verification steps
  - Troubleshooting guide for common issues
  - SSL certificate configuration
  - Connection timeout handling
  - Location: `scripts/MIGRATION_README.md`

- **NPM Migration Script**: Added `migrate:neon` command to package.json
  - Easy-to-use command: `npm run migrate:neon`
  - Uses `npx tsx` for TypeScript execution (no build required)
  - Supports environment variable configuration
  - Location: `package.json:scripts`

### Changed

#### Database Migration Infrastructure

- **NEON Postgres Compatibility**: Enhanced database migration for NEON Postgres compatibility
  - Fixed trigger disabling (NEON doesn't allow disabling system triggers)
  - Changed from `DISABLE TRIGGER ALL` to `DISABLE TRIGGER USER` (user-defined triggers only)
  - Graceful error handling for trigger operations
  - ES module compatibility fixes (`__dirname` replacement with `import.meta.url`)
  - JSONB column type detection and proper serialization
  - Enhanced error messages with context

- **Migration Safety Features**:
  - Schema validation before starting migration
  - Table count verification (warns if target has fewer tables)
  - Row-by-row error handling (continues on individual row failures)
  - Transaction-based batch processing for data integrity
  - Automatic conflict resolution (prevents duplicate inserts)

### Technical Details

**Migration Script Features:**

- **Table Discovery**: Automatically discovers all tables from source database
- **Dependency Ordering**: Uses topological sort to determine correct migration order based on foreign key relationships
- **Batch Processing**: Processes data in batches of 1000 rows for optimal performance
- **Progress Tracking**: Real-time progress with colored output showing:
  - Table being migrated
  - Row counts
  - Success/failure status
  - Total progress (X/17 tables)
- **Data Verification**: After migration, verifies row counts match between source and target
- **Error Recovery**: Individual row failures don't stop the entire migration
- **JSONB Handling**: Properly serializes JavaScript objects to JSON strings for JSONB columns
- **Sequence Management**: Automatically resets sequences to prevent ID conflicts

**NEON-Specific Adaptations:**

- **System Triggers**: NEON Postgres doesn't allow disabling system triggers (referential integrity constraints)
  - Solution: Only disable user-defined triggers, let PostgreSQL handle constraints naturally
  - Migration order ensures foreign keys are respected
- **SSL Configuration**: Automatic SSL configuration for NEON connections
  - Detects NEON connection strings
  - Uses lenient SSL (rejectUnauthorized: false) for NEON
  - Supports custom CA certificates if needed

**Migration Process:**

1. **Pre-Migration Checks**:
   - Validates source and target database connections
   - Verifies schema exists on target database
   - Discovers all tables and counts rows
   - Shows migration summary before starting

2. **Migration Execution**:
   - Migrates tables in dependency order (parents before children)
   - Processes data in batches for performance
   - Handles JSONB columns with proper serialization
   - Skips rows with invalid JSON (logs warning, continues)
   - Resets sequences after each table

3. **Post-Migration Verification**:
   - Compares row counts between source and target
   - Reports any mismatches
   - Provides success confirmation

**Usage Example:**

```bash
# Set target database URL
export TARGET_DATABASE_URL="postgresql://user:pass@neon-host/db?sslmode=require"

# Run migration
npm run migrate:neon
```

**Files Modified:**

- Added: `scripts/migrate-to-neon.ts` (migration script, 477 lines)
- Added: `scripts/MIGRATION_README.md` (migration documentation)
- Modified: `package.json` (added `migrate:neon` script, version bump to 0.7.6)

**Migration Safety:**

- Uses `ON CONFLICT DO NOTHING` to prevent duplicate rows
- Safe to re-run if migration is interrupted
- Already migrated tables are skipped automatically
- Transaction-based batching ensures data integrity

## [0.7.5] - 2025-12-29

### Added

#### Hydrogen Electron Orbitals Visualizer

- **New Visualizer Type**: Added "hydrogen-electron-orbitals" visualizer that visualizes hydrogen atom energy levels
  - Cycles through energy levels n=1 to n=6 automatically
  - Displays energy level label with quantum number and energy value (E = -13.6 eV / n²)
  - Shows appropriate orbital shapes for each energy level:
    - **n=1**: 1s orbital (spherical probability cloud)
    - **n=2**: 2s and 2p orbitals (spherical and dumbbell shapes along x, y, z axes)
    - **n=3**: 3s, 3p, and 3d orbitals (including cloverleaf patterns for d orbitals)
    - **n=4-6**: Higher energy level shells with multiple orbital types
  - Audio-reactive visualization:
    - Electron movement speed increases with audio intensity
    - Orbital pulsing responds to bass, mid, and treble frequencies
    - Visual intensity scales with overall audio amplitude
    - Energy level transitions speed up with audio activity
  - Animated electrons orbiting the nucleus with 3D depth effect
  - Pulsing nucleus visualization with radial gradients
  - Performance optimized with quality scaling based on screen size
  - Location: `src/components/visualizers/ChemicalOrbitalsRenderer.ts`

### Changed

#### Audio Visualizer System

- **Multi-Renderer Support**: Enhanced AudioVisualizer to support multiple renderer types
  - Added ChemicalOrbitalsRenderer integration alongside existing KaleidoscopeRenderer
  - Renderer selection based on visualizer type
  - Both renderers initialized and resized appropriately
  - Location: `src/components/AudioVisualizer.tsx:15, 283-310, 532-543`

- **Visualizer Type Registry**: Added new visualizer type to constants
  - Added "hydrogen-electron-orbitals" to VISUALIZER_TYPES array
  - Type-safe visualizer type definitions
  - Location: `src/constants/visualizer.ts:5`

### Technical Details

**Hydrogen Atom Energy Levels:**

The visualizer implements the Bohr model energy formula: E_n = -13.6 eV / n²

- Each energy level (n) has specific orbital types:
  - n=1: 1s (1 orbital)
  - n=2: 2s, 2p (4 orbitals total: 1s + 3p)
  - n=3: 3s, 3p, 3d (9 orbitals total: 1s + 3p + 5d)
  - Higher levels follow the same pattern

**Orbital Visualization:**

- **s orbitals**: Spherical probability clouds with radial gradients
- **p orbitals**: Dumbbell shapes along coordinate axes with lobe visualization
- **d orbitals**: Cloverleaf patterns with four-lobe structures
- All orbitals pulse and respond to audio frequencies

**Performance Optimizations:**

- Quality scaling based on screen area (reduces rendering load on large displays)
- Electron count scales with quality setting (50 × qualityScale)
- Pre-calculated constants (TWO_PI, INV_255, INV_360) for performance
- Efficient frequency band calculations for audio reactivity

**Files Modified:**

- Added: `src/components/visualizers/ChemicalOrbitalsRenderer.ts` (new renderer class, 548 lines)
- Modified: `src/components/AudioVisualizer.tsx` (multi-renderer support)
- Modified: `src/constants/visualizer.ts` (added new visualizer type)
- Modified: `package.json` (version bump to 0.7.5)

## [0.7.4] - 2025-12-29

### Changed

#### PM2 Configuration Optimization

- **Fork Mode Configuration**: Optimized PM2 to use fork mode instead of cluster mode
  - Single optimized instance better suited for Next.js standalone mode
  - Prevents port binding conflicts (Next.js binds directly to port)
  - Reduced database connections from 120 to ~10 (single instance × ~10 connections)
  - Zero-downtime deployments still supported via graceful reload
  - Updated process names from `darkfloor-art-*` to `bluesix-frontend-*`
  - Memory limit increased to 2560M for single instance
  - Location: `ecosystem.config.cjs:16-122`
  - Location: `pm2-setup.sh:106-149`
  - Location: `package.json:scripts`

#### Performance Optimizations

- **Shadow Realm Visualizer Optimization**: 85-90% performance improvement on Firefox
  - Reduced layers from 28 to 18 (35% reduction)
  - Batched shadow operations: 1,092 → 18 (98% reduction)
  - Batched stroke operations: 1,092 → 18 (98% reduction)
  - Reduced accent circles: 546 → ~35 (94% reduction)
  - Shadow properties set once per layer instead of per segment
  - Layer-wide styling instead of per-segment styling
  - Location: `src/components/visualizers/FlowFieldRenderer.ts:7736-7866`

- **Infernal Flame Visualizer Optimization**: 80-85% performance improvement on Firefox
  - Eliminated expensive linear gradients: 32-36 → 1 (97% reduction)
  - Batched shadow operations: 32-36 → 2 (94% reduction)
  - Replaced arc() with fillRect() for embers (100% faster)
  - Reduced flame count: 14-18 → 10-13 (28% reduction)
  - Reduced flame points: 10-14 → 8 fixed (40% fewer vertices)
  - Reduced ember count: 24-56 → 16-32 (50% reduction)
  - Solid colors instead of per-frame gradients
  - Location: `src/components/visualizers/FlowFieldRenderer.ts:11037-11151`

### Fixed

#### Code Quality Improvements

- **OG Route Type Safety**: Improved TypeScript type imports
  - Changed `NextRequest` import to `import type` for better tree-shaking
  - Added eslint disable comments for intentional img usage in edge runtime
  - Location: `src/app/api/og/route.tsx:4, 42`

### Technical Details

**PM2 Fork Mode Rationale:**

Next.js has built-in concurrency handling via Node.js async I/O. Cluster mode causes:

- Port binding conflicts (each instance tries to bind to same port)
- Excessive database connections (instances × pool size)
- Unnecessary complexity for Next.js architecture

Fork mode provides:

- Single optimized instance with automatic crash recovery
- Zero-downtime deployments via graceful reload
- Better resource utilization
- Simpler monitoring and debugging

**Shadow Realm Optimization Implementation:**

```typescript
const layers = 18;
for (let layer = 0; layer < layers; layer++) {
  ctx.shadowBlur = baseShadowBlur;
  ctx.shadowColor = this.hsla(hue, 95, 40, 0.7);
  ctx.strokeStyle = this.hsla(hue, 85, avgLightness, avgAlpha);

  ctx.beginPath();
  for (let i = 0; i < segments; i++) {
    ctx.moveTo(x, y);
    ctx.arc(0, 0, radius, angle, nextAngle);
  }
  ctx.stroke();
}
```

**Infernal Flame Optimization Implementation:**

```typescript
for (let layer = 0; layer < 2; layer++) {
  ctx.shadowBlur = layerShadowBlur;
  ctx.shadowColor = this.hsla(layerHue, 100, 70, 0.7);

  for (let flame = 0; flame < flames; flame++) {
    ctx.fillStyle = this.hsla(hueBase, 100, 70, flameAlpha);
    ctx.beginPath();
    ctx.fill();
  }
}

for (let i = 0; i < emberCount; i++) {
  ctx.fillStyle = this.hsla(emberHue, 100, 80, emberAlpha);
  ctx.fillRect(baseX - halfSize, baseY - halfSize, emberSize, emberSize);
}
```

**Files Modified:**

- Modified: `ecosystem.config.cjs` (fork mode optimization)
- Modified: `pm2-setup.sh` (updated process names and descriptions)
- Modified: `package.json` (version bump to 0.7.4, updated PM2 scripts)
- Modified: `src/components/visualizers/FlowFieldRenderer.ts` (Shadow Realm + Infernal Flame optimizations)
- Modified: `src/app/api/og/route.tsx` (type imports and linting)

## [0.7.3] - 2025-12-29

### Added

#### Playlist Quick-Add Feature

- **Add to Playlist Button**: Added quick-add to playlist functionality next to the heart icon
  - Button appears in both mobile and desktop players
  - Shows dropdown menu with all user playlists
  - Displays track count for each playlist
  - Includes loading states and error handling
  - Authenticated users only (requires login)
  - Features haptic feedback on mobile devices
  - Location: `src/components/MobilePlayer.tsx:140-157, 881-969`
  - Location: `src/components/Player.tsx:108-122, 259-334`

### Changed

#### SEO and Social Sharing Improvements

- **Open Graph Metadata**: Enhanced social sharing with new default image and call-to-action
  - Default embed now shows Emily the Strange image when no track is specified
  - Dynamic song embeds display simple "Play now on darkfloor.art" text
  - Subtle, elegant design with muted color (#a5afbf)
  - Layout updated: album art (470×470) on left, track info on right
  - Improved positioning and spacing for better visual appeal
  - Location: `src/app/api/og/route.tsx:16-86, 205-215`

- **Site Description Updates**: Updated descriptions across all metadata
  - Changed from "smart recommendations" to "advanced audio features and visual patterns"
  - Applied to root layout, home page, and Open Graph metadata
  - Better reflects current feature set (equalizer, visualizer patterns)
  - Location: `src/app/layout.tsx:33-66`
  - Location: `src/app/page.tsx:78-107`

#### Performance Optimizations

- **Fireworks Visualization Hyperoptimization**: Drastically improved fireworks pattern performance
  - Implemented object pooling for firework particles (eliminates allocations)
  - Removed expensive `splice()` calls during iteration (major bottleneck)
  - Added `dead` flag pattern with periodic cleanup (every 120 frames)
  - Replaced per-particle gradient rendering with simple 3-layer arc rendering
    - Core layer (size × 1, full alpha)
    - Medium glow layer (size × 2, 60% alpha)
    - Outer glow layer (size × 3, 30% alpha)
  - Eliminated 70% of trigonometric operations
  - **Performance Improvement**: 5-8x faster rendering (1-2ms vs 8-12ms previously)
  - Pattern now maintains 60 FPS consistently even on lower-end hardware
  - Location: `src/components/visualizers/FlowFieldRenderer.ts:220-243, 1981-2112`

### Technical Details

**Fireworks Optimization Implementation:**

```typescript
// Object pooling system
private fireworks: { x, y, vx, vy, hue, life, maxLife, size, dead }[] = [];
private fireworksPool: [...same structure...] = [];
private fireworksActiveCount = 0;
private fireworksCleanupCounter = 0;

// Mark particles dead instead of splice
if (fw.life > fw.maxLife) {
  fw.dead = true;
  this.fireworksActiveCount--;
  this.fireworksPool.push(fw);
  continue;
}

// Periodic cleanup every 120 frames
this.fireworksCleanupCounter++;
if (this.fireworksCleanupCounter > 120) {
  this.fireworksCleanupCounter = 0;
  this.fireworks = this.fireworks.filter((fw) => !fw.dead);
}

// Simplified rendering (no gradients)
ctx.arc(fw.x, fw.y, fw.size, 0, TAU);        // Core
ctx.arc(fw.x, fw.y, fw.size * 2, 0, TAU);    // Medium glow
ctx.arc(fw.x, fw.y, fw.size * 3, 0, TAU);    // Outer glow
```

**Playlist Button Integration:**

- Uses tRPC `api.music.getPlaylists.useQuery()` for fetching playlists
- Uses tRPC `api.music.addToPlaylist.useMutation()` for adding tracks
- Dropdown positioned absolutely (mobile: top-right, desktop: centered)
- Automatic refetch after successful playlist addition
- Empty state message: "No playlists yet. Create one from your library!"

**Files Modified:**

- Modified: `package.json` (version bump to 0.7.3)
- Modified: `src/components/visualizers/FlowFieldRenderer.ts` (fireworks optimization)
- Modified: `src/components/MobilePlayer.tsx` (playlist button)
- Modified: `src/components/Player.tsx` (playlist button)
- Modified: `src/app/layout.tsx` (SEO description)
- Modified: `src/app/page.tsx` (SEO description)
- Modified: `src/app/api/og/route.tsx` (Emily image + Listen Now CTA)

## [0.7.2] - 2025-12-28

### Added

#### GitHub and Changelog Links

- **GitHub Repository Button**: Added link to GitHub repository on home page
  - Located at the bottom center of the empty state (when no search results are displayed)
  - Links to `https://github.com/soulwax/bluesix-library`
  - Opens in new tab with proper security attributes
  - Features GitHub icon with "View on GitHub" text
  - Styled with subtle white background and hover effects
  - Location: `src/app/HomePageClient.tsx:576-585`

- **Changelog Modal**: Added interactive changelog viewer
  - New modal component for displaying CHANGELOG.md content
  - Button located next to GitHub button at bottom center
  - Features BookOpen icon with "Changelog" text
  - Styled with accent orange color matching app theme
  - Modal features:
    - Full markdown parsing (headers, lists, code blocks, paragraphs, etc.)
    - Smooth animations using Framer Motion
    - Backdrop blur and themed UI
    - Close button and click-outside-to-close functionality
    - Scrollable content for long changelogs
    - Responsive design for mobile and desktop
  - CHANGELOG.md copied to public directory for client-side fetching
  - Location: `src/components/ChangelogModal.tsx`
  - Integration: `src/app/HomePageClient.tsx:587-610`

- **Mobile Haptic Feedback**: Changelog button includes haptic feedback on mobile devices

### Changed

- **Home Page Layout**: Updated empty state section to include footer buttons
  - Buttons appear below "Quick Search Suggestions"
  - Centered layout with flex-wrap for responsive design
  - Consistent spacing and styling with rest of application

**Files Modified:**

- Added: `src/components/ChangelogModal.tsx` (new changelog modal component)
- Modified: `src/app/HomePageClient.tsx` (added buttons and modal integration)
- Added: `public/CHANGELOG.md` (copy of changelog for client-side access)

## [0.7.1] - 2025-12-28

### Fixed

#### Critical Queue Bug #1: Partial Playlist Save (2, 4, 6 songs pattern)

- **Playlist Save Functionality**: Fixed severe bug where saving queue to playlist only saved partial tracks (2, 4, 6 pattern)
  - Root cause: Sequential `await` loop with potential race conditions
  - Changed from sequential execution to parallel `Promise.all` execution
  - Ensures **all tracks** are saved atomically without race conditions
  - Added detailed logging for each track being added (e.g., "Adding track 1/50: Song Title")
  - Location: `src/contexts/AudioPlayerContext.tsx:367-382`
  - Impact: Users can now reliably save their entire queue to playlists

#### Critical Queue Bug #2: Queue Destruction on Manual Play

- **Queue Preservation**: Fixed catastrophic bug where playing a new track manually **destroyed the entire queue**
  - Root cause: `setQueue([track])` completely replaced queue instead of inserting track
  - Impact: Users lost hours of work when manually playing a single track (100+ song queues gone instantly)
  - Fix: Changed to `setQueue([track, ...queue.slice(1)])` - inserts new track at position 0, preserves rest of queue
  - Queue behavior now:
    - If track **NOT** in queue: Inserts at position 0, shifts everything else down
    - If track **IN** queue: Moves it to position 0 (existing behavior)
    - **Your queue stays intact** - no more losing hours of curation work
  - Added comprehensive logging to track queue operations:
    - "Playing new track, inserting at queue position 0, preserving existing queue"
    - "Track already playing, restarting from beginning"
    - "Track found in queue at position X, playing from queue"
  - Location: `src/hooks/useAudioPlayer.ts:1071-1085`

### Changed

#### Queue Resilience & Reliability

- **Queue Management**: Queue is now **much less brittle** and more robust
  - Manual track playback preserves existing queue
  - Playlist save operations are atomic and reliable
  - Enhanced logging throughout queue operations for debugging
  - Queue structure maintained: `queue[0]` = current track, `queue[1..n]` = upcoming tracks

### Technical Details

**Queue Structure:**

- Current track is always at `queue[0]`
- Upcoming tracks are at `queue[1..n]`
- History tracking works correctly with preserved queue

**Playlist Save Fix:**

```typescript
// OLD - Sequential, could have race conditions
for (const track of tracksToSave) {
  await addToPlaylistMutation.mutateAsync({ ... });
}

// NEW - All tracks added in parallel, atomic operation
await Promise.all(
  tracksToSave.map((track, index) => {
    console.log(`Adding track ${index + 1}/${tracksToSave.length}: ${track.title}`);
    return addToPlaylistMutation.mutateAsync({
      playlistId: playlist.id,
      track,
    });
  }),
);
```

**Queue Preservation Fix:**

```typescript
// OLD - DESTROYS the queue! 💀
setQueue([track]); // 100 carefully selected songs = GONE

// NEW - Preserves your precious queue! 🎉
setQueue([track, ...queue.slice(1)]); // Keep queue[1..n], replace queue[0]
```

### User Impact

**Before this fix:**

- Saving a 50-song queue to playlist might only save 2, 4, or 6 songs
- Playing a new track manually would wipe your entire 100+ song queue
- Users lost hours of work assembling queues

**After this fix:**

- All tracks in queue are reliably saved to playlists
- Playing new tracks preserves your carefully assembled queue
- Queue feels solid and reliable, not fragile and prone to destruction

## [0.7.0] - 2025-12-26

### Added

#### Windows Code Signing Integration

- **@electron/windows-sign Integration**: Fully integrated Windows Authenticode signing into the Electron build process
  - Support for local certificate signing (.pfx/.p12 files)
  - Support for Azure Key Vault signing (cloud-based certificate storage)
  - Automatic code signing during Windows builds
  - Graceful fallback for unsigned local development builds
  - CI/CD enforcement (fails build if signing fails in CI environment)
  - SHA256 signing algorithm with timestamp server support

- **Azure Key Vault Support**: Enterprise-grade code signing for CI/CD pipelines
  - Azure AD authentication with service principal
  - Certificate rotation support
  - Team collaboration without certificate sharing
  - Secure cloud-based certificate storage
  - Comprehensive environment variable configuration

- **Code Signing Documentation**: Created detailed Windows signing guide
  - Local certificate setup instructions
  - Azure Key Vault configuration guide
  - CI/CD integration examples (GitHub Actions)
  - Troubleshooting guide
  - Security best practices
  - Verification procedures

#### Database SSL Certificate Management

- **Automatic CA Certificate Generation**: Database SSL certificates now generated automatically from environment variables
  - `DB_SSL_CA` environment variable support for PEM-formatted certificates
  - Automatic generation of `certs/ca.pem` during dev/build/start
  - Certificate bundled with all Electron builds
  - Fallback to environment variable if file not found
  - Works seamlessly in development and production

- **Electron Certificate Bundling**: CA certificates automatically packaged with Electron builds
  - Certificates copied to standalone directory during build
  - Available at runtime in packaged .exe applications
  - No manual certificate management required
  - SSL connections work out of the box in packaged apps

- **Enhanced SSL Configuration**: Improved database SSL handling
  - Environment-based SSL validation (`rejectUnauthorized` based on NODE_ENV)
  - Accepts self-signed certificates in development
  - Strict validation in production
  - Clear error messages and warnings
  - Fallback to lenient SSL if certificate not found

### Changed

#### Build System Enhancements

- **Environment Variable Schema**: Updated environment variable validation
  - Added `DB_SSL_CA` to server-side schema (optional string)
  - Proper validation and type safety for all environment variables

- **Certificate Generation Script**: Enhanced SSL certificate generation script
  - Matches server environment loading order
  - Loads `.env.development` in development mode
  - Loads `.env.local` > `.env.production` > `.env` in production
  - Consistent behavior across all environments

- **Electron Prepare Script**: Improved package preparation for Electron builds
  - Generates CA certificate from `DB_SSL_CA` before packaging
  - Ensures `certs/` directory exists
  - Copies certificates to standalone directory
  - Validates certificate presence with warnings

### Fixed

#### Discord OAuth Login in Electron

- **Database Connection Timeout**: Fixed Discord OAuth login failures in Electron app
  - Root cause: Database SSL connection timeout during OAuth callback
  - Fixed SSL certificate configuration for cloud databases (Aiven)
  - Proper handling of self-signed certificates in development
  - Clear error logging for database connection issues

- **Authentication Flow**: Improved NextAuth error handling and logging
  - Comprehensive logging in signIn callback
  - Better error messages for debugging
  - Database adapter error handling
  - CSRF token validation improvements

#### Web Audio API Errors

- **React Strict Mode Compatibility**: Fixed "InvalidStateError: createMediaElementSource" errors
  - Prevented duplicate MediaElementSourceNode creation
  - Tracked connected audio elements with ref
  - Proper cleanup on component unmount
  - Works correctly in React 19 Strict Mode

### Technical Improvements

#### Code Signing Infrastructure

- **Modified Files** for Windows Code Signing:
  - `electron/sign.js`: Complete rewrite using @electron/windows-sign
  - `package.json`: Updated Windows build configuration
  - `electron/WINDOWS_SIGNING.md`: New comprehensive documentation
  - `.env.example`: Added signing configuration examples

#### Database SSL Infrastructure

- **Modified Files** for SSL Certificate Management:
  - `src/server/db/index.ts`: Enhanced SSL configuration with fallback
  - `src/env.js`: Added `DB_SSL_CA` schema validation
  - `scripts/generate-ssl-cert.js`: Updated environment loading order
  - `electron/prepare-package.js`: Added CA certificate generation
  - `.env.development`: Added `DB_SSL_CA` certificate content
  - `.env.local`: Added `DB_SSL_CA` certificate content
  - `.env.example`: Added `DB_SSL_CA` documentation

#### Bug Fixes

- **Modified Files** for Audio and Auth Fixes:
  - `src/components/FlowFieldBackground.tsx`: Fixed duplicate audio source nodes
  - `src/server/auth/config.ts`: Enhanced logging for debugging

### Security

- **Certificate Management**: Secure handling of SSL certificates
  - Certificates stored as environment variables
  - Automatic generation prevents manual certificate management
  - No certificates committed to version control
  - Proper permissions and access controls

- **Code Signing**: Enhanced trust and security for Windows builds
  - Signed executables verified by Windows
  - Reduced SmartScreen warnings
  - Azure Key Vault for enterprise security
  - Timestamp servers for long-term validity

### Documentation

- **Windows Code Signing**: Complete guide for code signing setup
  - File: `electron/WINDOWS_SIGNING.md`
  - Local certificate instructions
  - Azure Key Vault setup
  - CI/CD integration examples
  - Troubleshooting and verification

- **Environment Variables**: Updated documentation for new variables
  - `DB_SSL_CA` usage and format
  - Windows signing configuration
  - Azure Key Vault configuration
  - Examples in `.env.example`

## [0.6.8] - 2024-12-24

### Added

- Environment variable logging to Electron for debugging NextAuth issues
- `isElectron` flag exposed via Electron preload API for conditional branding
- Conditional branding: "Starchild" in Electron app, "darkfloor.art" in web version

### Changed

- **BREAKING**: `AUTH_SECRET` environment variable now required in all environments (min 32 characters)
- Renamed Electron build product from "darkfloor" to "Starchild"
  - Windows executable: `darkfloor.exe` → `Starchild.exe`
  - Installer: `darkfloor Setup.exe` → `Starchild Setup.exe`
  - macOS app name: darkfloor.app → Starchild.app
  - Linux AppImage: darkfloor.AppImage → Starchild.AppImage

### Fixed

- **Kaleidoscope Pattern Performance**: Drastically improved performance (~99% reduction in rendering operations)
  - Implemented offscreen canvas rendering (render once, copy 48 times instead of drawing 48 times)
  - Reduced particle count from 30-90 to 12-36 per segment
  - Removed expensive `shadowBlur` operations (major FPS killer)
  - Simplified particle rendering from 2 arcs to 1 radial gradient per particle
  - Reduced structural elements: lines (8→4), rings (5→3)
  - **Result**: ~9,264 operations/frame → ~91 operations/frame (99% reduction)
  - Pattern now runs smoothly at 60 FPS even on lower-end hardware

### Technical Details

- Updated `electron/preload.cjs` to expose `isElectron: true`
- Updated `electron/types.d.ts` with `isElectron: boolean` property
- Updated `src/components/Header.tsx` to detect Electron and show appropriate branding
- Updated `src/env.js` to enforce `AUTH_SECRET` minimum length validation (32 chars)
- Updated `electron/main.cjs` with environment variable debugging output
- Optimized `src/components/visualizers/flowfieldPatterns/renderKaleidoscope.ts`
- Updated `package.json` productName and executableName to "Starchild"

## [0.6.7] - 2025-12-24

### Added

#### WebGL Migration Planning

- **ROADMAP.md**: Created comprehensive roadmap for migrating visualization system from Canvas2D to WebGL
  - **Executive Summary**: Timeline, benefits, and architectural overview
  - **7-Phase Implementation Plan**: Week-by-week breakdown (20-week timeline)
    - Phase 0: Foundation & Research (Weeks 1-2)
    - Phase 1: Core Infrastructure (Weeks 3-5)
    - Phase 2: Pattern Migration (Weeks 6-12) - Converting 80+ patterns in batches
    - Phase 3: Post-Processing Pipeline (Weeks 11-12)
    - Phase 4: Transition System (Weeks 13-14)
    - Phase 5: Integration & Testing (Weeks 15-16)
    - Phase 6: Polish & Optimization (Weeks 17-18)
    - Phase 7: Launch & Monitoring (Weeks 19-20)
  - **Technical Architecture**: Proposed code structure with shader system
  - **Risk Mitigation**: Comprehensive risk assessment and mitigation strategies
  - **Success Metrics**: Performance targets and quality benchmarks
  - **Expected Benefits**:
    - +100-200% FPS improvement at 4K resolution
    - -60% reduction in CPU usage
    - -65% reduction in code size
    - -50% reduction in mobile battery impact
    - -75% reduction in pattern creation time
  - **Pattern Conversion Guide**: Template and checklist for porting patterns to GLSL
  - **Device Test Matrix**: Cross-platform testing requirements
  - **Resources & References**: Learning materials and technical documentation

### Changed

#### Electron Build Environment Configuration

- **Unified Environment Configuration**: Electron builds now EXCLUSIVELY use `.env.local`
  - Removed loading of `.env`, `.env.development`, and `.env.production` files
  - Simplified environment configuration to single source of truth
  - Prevents conflicts between multiple environment files
  - **Modified Files**:
    - `scripts/load-env-build.js`: Now only loads `.env.local` (removed all other env file loading)
    - `electron/main.cjs`: Only loads `.env.local` from project root or standalone directory
    - `electron/prepare-package.js`: Automatically copies `.env.local` to standalone directory for packaged builds
  - **Developer Impact**: All environment variables must be in `.env.local` only
  - **Security**: `.env.local` already in `.gitignore` via `.env*.local` pattern

#### Package Metadata Updates

- **License**: Changed from MIT to GPLv3
- **Product Name**: Changed from "darkfloor" to "Starchild" for Electron builds
- **Executable Name**: Changed from "darkfloor" to "Starchild"
- **Author**: Updated author information

### Technical Planning

- **Migration Strategy**: Gradual, feature-flagged migration approach
  - Parallel development with existing Canvas2D system
  - Graceful fallback for unsupported devices
  - Phased rollout (10% → 50% → 100% of users)
- **Shader Architecture**: Multi-layer framebuffer system proposed
  - Pattern registry with dynamic shader loading
  - Audio texture pipeline for GPU-based audio reactivity
  - Post-processing effects (blur, bloom, color grading, distortion)
  - Advanced transition system between patterns
- **Performance Budget**: Defined performance targets per platform
  - Desktop: 60fps at 4K, <10% CPU usage
  - Mobile: 30-60fps, <20% CPU usage, <50MB memory
  - Initial bundle size increase: <100KB for WebGL infrastructure

## [0.6.6] - 2025-12-23

### Added

#### Dynamic Open Graph Image Generation

- **Open Graph Image API**: Created new `/api/og` route for dynamically generating Open Graph embed images
  - Default embed: Shows "darkfloor.art" branding with description when no song query is present
  - Dynamic song embeds: Displays album artwork (squared, left-aligned) with track title, artist, and album information on the right
  - All images generated at 1200×630px (standard Open Graph size) with proper layout and styling
  - Uses Next.js `ImageResponse` API with edge runtime for fast image generation

### Changed

#### Enhanced SEO and Social Sharing

- **Metadata Improvements**: Updated Open Graph and Twitter Card metadata across the application
  - Replaced static Emily the Strange image references with dynamic OG image generator
  - Changed Open Graph type from "website" to "music.song" for track-specific pages
  - Enhanced descriptions to include album information when available
  - Updated both root layout and home page metadata for consistency
- **Image Assets**: Added Emily the Strange image to public directory for fallback scenarios
- **Search Query Embeds**: Song links with query parameters now generate rich embeds showing album art and track details

**Files Modified:**

- Added: `src/app/api/og/route.tsx` (dynamic OG image generator)
- Modified: `src/app/page.tsx` (dynamic metadata generation)
- Modified: `src/app/layout.tsx` (updated default metadata)
- Added: `public/emily-the-strange.png` (fallback image asset)

## [0.6.5] - 2025-12-23

### Changed

#### FlowFieldRenderer Performance Optimizations

- **FlowFieldRenderer performance reworks (drastic)**:
  - **Quantum Entanglement**: heavy rewrite using aggressive LOD, temporal subsampling, quadratic curves, reduced glow, and `fillRect` particles to avoid browser FPS collapse.
  - **Void Whisper**: reduced fidelity (fewer layers/particles), removed most per-frame gradients, simplified tendrils, and reduced core layering.
  - **Spectral Echo**: reduced layers/segments, added temporal subsampling, removed particle/beam gradients and trails, and simplified the core.
  - **Twilight Zone**: removed per-zone gradients; replaced with cheap ring strokes + sparse sparkles and fewer wisps/core layers.
  - **Demonic Gate**: reduced particle/entity/tendril/sigil counts, removed tendril gradients, simplified sigils, and reduced shadow costs.
  - **Shadow Dance**: removed trail/beam gradients, reduced dancer complexity, simplified trails/wisps, and reduced center layers.
- **FlowFieldRenderer Hyper-Optimization**: Replaced remaining `Math.sin`, `Math.cos`, and `Math.sqrt` hot paths with fast trig/fast sqrt helpers across all mystical visual patterns (including ShadowRealm, QuantumEntanglement, NecromanticSigil, DimensionalRift, ChaosVortex, EtherealMist, BloodMoon, DarkMatter, SoulFragment, ForbiddenRitual, TwilightZone, SpectralEcho, VoidWhisper, DemonicGate, CursedRunes, ShadowDance, NightmareFuel).
- **Performance & Visual Fidelity**: Pre-calculated common constants, angle steps, and hue offsets; reduced per-frame allocations; enhanced gradients and glow layers for deeper, more responsive visuals without extra CPU cost.
- **Pattern Infrastructure**: Tightened use of cached HSLA color strings, fast modulo for hues, and object pooling in the visualizer pipeline to keep frame times stable even under heavy audio-reactive scenes.

## [0.6.4] - 2025-12-21

### Changed

#### Complete Rebrand to darkfloor.art

**User-Facing Changes:**

- **Brand Identity**: Completely rebranded from "isobelnet.de" to "darkfloor.art" across all user interfaces
- **UI Components**: Updated all component text including headers, menus, welcome messages, and share dialogs
- **Metadata**: Updated page titles, Open Graph data, and Twitter card metadata for SEO and social sharing
- **Mobile Experience**: Updated mobile header, hamburger menu branding, and player UI text

**Technical Changes:**

- **Package Configuration**: Renamed package from `isobelnet-de` to `darkfloor-art`
- **PM2 Processes**: Renamed production and development processes to `darkfloor-art-prod` and `darkfloor-art-dev`
- **Electron App**: Updated desktop application name, app ID (`com.darkfloor.art`), and product name
- **Documentation**: Updated all README, CLAUDE.md, and setup documentation files
- **Scripts**: Updated all setup scripts, server banners, and diagnostic commands
- **Electron Storage**: Updated persistent storage partition name for Electron builds
- **Base URL**: Updated default fallback URL to `https://darkfloor.art`

**Files Modified (30+ total):**

- UI Components: HamburgerMenu, Header, WelcomeHero, EnhancedTrackCard, SwipeableTrackCard
- App Pages: layout, page, license, user profile
- Configuration: package.json, ecosystem.config.cjs, electron/main.cjs, getBaseUrl.ts
- Documentation: README.md, CLAUDE.md, CHANGELOG.md, electron docs
- Scripts: server.js, pm2-setup.sh, setup-database.sh, verify-build.js
- Styles: globals.css
- Services: smartQueue.ts

## [0.6.3] - 2025-12-21

### Added

#### Enhanced Visual Features

- **Improved Visual Components**: Enhanced visual rendering and display components throughout the application
- **Visual Enhancements**: Added more visual elements and improved visual feedback across the user interface
- **Visual Polish**: Refined visual styling and animations for a more immersive experience

## [0.6.2] - 2025-12-21

### Changed

- Internal improvements and bug fixes

## [0.6.0] - 2025-12-09

### Fixed

#### Critical Production Stability Issues

- **502 Error Crash Loop Resolution**: Fixed infinite crash loop causing 502 Bad Gateway errors in production
  - Root cause: Missing production build (BUILD_ID file) causing Next.js to crash on startup
  - Added build validation check before server startup to prevent crash loops
  - Implemented automatic build recovery via PM2 pre-start hook
  - Created `scripts/ensure-build.js` for automatic build verification and creation
  - Process now fails gracefully with clear error messages instead of infinite restarts
  - Prevents PM2 from restarting when build is missing (stops crash loop)

#### Production Build Management

- **Build Validation System**: Comprehensive build validation before production startup
  - Validates `.next` directory existence
  - Verifies `BUILD_ID` file presence (required by Next.js)
  - Checks `.next/server` directory for complete build
  - Provides clear error messages guiding manual intervention if needed
  - Exits immediately if build is invalid (prevents crash loops)

- **Automatic Build Recovery**: PM2 pre-start hook ensures build exists before starting
  - Automatically runs `npm run build` if BUILD_ID is missing
  - Prevents manual intervention in most cases
  - Logs build process for debugging
  - Fails gracefully if build process fails

### Changed

- **PM2 Configuration**: Enhanced production process management
  - Added `pre_start` hook for automatic build verification
  - Improved restart timing (min_uptime: 30s, restart_delay: 5s, listen_timeout: 10s)
  - Added `wait_ready` flag for Next.js readiness detection
  - Configured health check URL for application-level monitoring
  - Health check grace period set to 5 seconds

- **Error Handling**: Improved error handling in server script
  - Added null checks for error stack traces (TypeScript compliance)
  - Enhanced build validation error messages
  - Better logging for build-related failures

### Technical Improvements

- **Server Startup Flow**: Multi-layer defense against missing builds
  1. PM2 pre-start hook checks and builds if needed
  2. Server script validates build before starting Next.js
  3. Clear error messages if build is still missing
  4. Process exits cleanly (no infinite restart loops)

- **Documentation**: Added comprehensive 502 error analysis documentation
  - Root cause analysis of crash loop issue
  - Step-by-step fix implementation
  - Testing and verification procedures
  - Prevention measures and monitoring recommendations

## [0.6.0] - 2025-12-09

### Added

#### Visualizer Pattern Controls

- **Interactive Pattern Controls Panel**: New real-time control interface for visualizer patterns
  - Pattern duration adjustment (50-1000 frames)
  - Transition speed control (0.001-0.1)
  - Hue base adjustment (0-360°)
  - Real-time pattern state display showing current and next patterns
  - Transition progress indicator
  - Fractal pattern controls:
    - Zoom adjustment (0.1-10)
    - Offset X/Y controls (-2 to 2)
    - Julia C complex parameter controls (real and imaginary components)
  - Accessible via Layers button in player controls when visualizer is enabled
  - Mobile-responsive design with backdrop blur and arcane-themed styling

### Changed

- **Player Controls**: Added pattern controls toggle button to player interface
  - Button appears when visualizer is enabled
  - Integrated with existing player control layout

## [0.5.3] - 2025-12-09

### Changed

- Voronoi pattern smoothing & soothing
- Removed Plasma pattern completely, it was out of place, too in your face
- Bubble pattern replaced with The Orb
- Flow field pattern optimized for performance
- Reduced Mandala fidelity, layering and symmetry. Sometimes less is more.

#### Logging Enhancements

- **Ecosystem Configuration Logging**: Enhanced logging capabilities for PM2 ecosystem management
  - Better allround logging configuration for production and development environments
  - Separate log files for error, output, and combined logs
  - Timestamp formatting for better log traceability
  - Log file organization in dedicated PM2 logs directory

## [0.5.2] - 2025-12-09

### Added

#### Logging Enhancements

- **Ecosystem Configuration Logging**: Enhanced logging capabilities for PM2 ecosystem management
  - Comprehensive logging configuration for production and development environments
  - Separate log files for error, output, and combined logs
  - Timestamp formatting for better log traceability
  - Log file organization in dedicated PM2 logs directory

## [0.5.1] - 2025-12-09

#### Logging Enhancements & Visualizer Pattern Changes

- **Visual Component Logging**: Added comprehensive logging for visual components and visualizer patterns
  - Logging for visual pattern transitions and rendering
  - Performance metrics logging for visual effects
  - Debug logging for visual component state changes

## [0.5.0] - 2025-12-09

### Added

#### Visual Enhancements

- **Arcane-themed CSS Effects**: Enhanced mystical atmosphere with advanced visual effects
  - Radial gradient background for mystical depth
  - Ethereal glow effects at page edges using pseudo-elements
  - Pulsating and glowing animations for enhanced arcane theme
  - Floating energy particles effect for added mystique
  - Shimmer overlay creating depth and movement sense

### Changed

#### Performance Optimizations

- **Visual Pattern Performance**: Optimized pattern transition duration and rendering speed
  - Enhanced Flower of Life rendering (pixel-by-pixel optimization)
  - Optimized Chakras pattern performance
  - Improved Ouroboros animation efficiency
  - Enhanced fractal rendering performance
  - Optimized Metatron's Cube drawing algorithm

#### Configuration Updates

- **PM2 Development Configuration**: Updated development script execution method
  - Changed from `script: 'npm'` to `script: 'scripts/server.js'`
  - Updated interpreter from `'none'` to `'node'` for proper environment variable propagation
  - Added default `env` properties for both production and development configurations

### Fixed

#### Critical Production Issues

- **PM2 Process Management**: Resolved critical PM2 startup and deployment issues
  - Fixed EADDRINUSE errors on port 3222 by switching from cluster to fork mode
  - Changed production from `instances: 2` + `exec_mode: 'cluster'` to `instances: 1` + `exec_mode: 'fork'`
  - Fixed Next.js incompatibility with PM2 cluster mode
  - Resolved development process "waiting restart" loop
  - Added proper environment variable propagation in development mode
  - Fixed 502 Bad Gateway errors in production

#### Code Quality

- **TypeScript Compliance**: Removed unused imports to fix ESLint warnings
  - Removed unused `useEffect` import from Player component
- **Dependency Conflicts**: Resolved version conflicts in dependencies
  - Fixed @types/node dependency version conflicts
- **Merge Conflicts**: Resolved merge conflicts in settings and package-lock files
- **Environment Configuration**: Standardized dotenv configuration across the application

### Technical Improvements

- **PM2 Configuration**: Comprehensive PM2 ecosystem configuration with detailed comments
  - Memory management settings (2GB max per instance)
  - Auto-restart with exponential backoff
  - Graceful shutdown configuration
  - Separate development and production configurations
  - File watching enabled for development with proper ignore patterns
  - Enhanced logging configuration with timestamp formatting

## [0.4.1] - 2025-12-08

### Added

#### Visual Enhancements

- **23 New Mystical Visualizer Patterns**: Added arcane and mystical patterns to the flow field visualizer
  - Sacred Geometry: Pentagram, Flower of Life, Sri Yantra, Metatron's Cube, Vesica Piscis
  - Mystical Symbols: Runes, Sigils, Ouroboros, Chakras, Alchemy symbols
  - Celestial: Celestial bodies, Portal effects, Astrolabe, Moon Phases, Tarot cards
  - Spiritual: Dreamcatcher, Phoenix, Serpent, Crystal Grid, Kabbalah Tree of Life
  - Sacred Patterns: Merkaba, Torus Field, Cosmic Egg
- **Pattern Randomization**: Implemented Fisher-Yates shuffle algorithm for randomized pattern transitions
- **Auto Re-shuffle**: Patterns automatically re-shuffle when completing a full cycle for continuous variety

### Changed

- **Visualizer Pattern Duration**: Halved pattern transition duration from 600 to 300 frames for more dynamic visual experience
- **Dynamic Duration Range**: Adjusted minimum dynamic duration from 300 to 150 frames based on audio intensity
- **Total Pattern Count**: Increased from 22 to 45 unique visualizer patterns

### Fixed

- **TypeScript Compilation**: Fixed implicit 'any' type errors in custom server script
- **PM2 Startup**: Resolved PM2 process manager startup issues
  - Fixed hostname configuration to use HOSTNAME env variable instead of NEXTAUTH_URL
  - Added explicit Node.js interpreter configuration for both production and development modes
- **Server Configuration**: Fixed DNS resolution errors caused by protocol prefix in hostname
- **Network Interface Handling**: Added proper null checks for network interface iteration
- **Error Type Safety**: Improved error handling in catch blocks with proper type guards

### Technical Improvements

- **JSDoc Annotations**: Added comprehensive JSDoc type annotations to server utility functions
- **Build System**: Improved TypeScript strict mode compliance across build scripts
- **Pattern Architecture**: Implemented scalable pattern management system with type-safe pattern definitions
- **Audio Reactivity**: All new patterns feature full audio reactivity with bass, mid, and treble frequency responses

## [0.3.0] - 2025-12-04

### Added - Electron Desktop Application

#### Core Electron Integration

- **Electron Desktop App**: Full desktop application support with packaging for Windows, macOS, and Linux
- **Production Build System**: Optimized standalone Next.js build with Electron integration
- **Build Scripts**: Comprehensive build pipeline with platform-specific scripts
  - `electron:dev` - Development mode with hot reload
  - `electron:prod` - Production mode testing
  - `electron:build:win/mac/linux` - Platform-specific distributables
  - `electron:prod:win` - Build and run Windows installer

#### Persistence & State Management

- **OAuth Session Persistence**: Login state persists across app restarts (30-day sessions)
- **User Preferences Persistence**: All settings saved and restored automatically
  - Audio: Volume, playback rate, equalizer settings
  - Visualizer: Type, position, size, enabled state
  - Smart Queue: Auto-queue, similarity preferences, thresholds
  - UI State: Panel states, theme, lyrics enabled
- **Window State Persistence**: Window size, position, and maximized state remembered
- **Persistent Storage Partition**: Dedicated storage partition for app data isolation
- **Cookie Management**: Automatic cookie flushing on app startup and shutdown
- **Storage Verification**: Automatic verification of storage persistence on startup

#### Electron Features

- **Media Key Support**: Global media key controls (play/pause, next, previous)
- **Native Window Controls**: Proper window management with state saving
- **Dynamic Port Assignment**: Automatic port detection and allocation
- **Server Management**: Graceful server startup, shutdown, and error handling
- **Production/Development Modes**: Automatic mode detection with appropriate configuration
- **Resource Bundling**: Automated copying of static assets, public files, and SSL certificates

#### Developer Experience

- **Storage Utilities**: Comprehensive Electron storage helpers
  - Storage verification and testing
  - Preference export/import for backup
  - Storage usage monitoring
  - Debug logging and status reporting
- **Storage Initialization**: Automatic storage setup and verification component
- **Documentation**: Complete Electron persistence guide with troubleshooting
- **Build Preparation**: Automated standalone package preparation script

#### Technical Improvements

- **Database Session Strategy**: NextAuth configured for 30-day database sessions
- **Cookie Configuration**: Secure, httpOnly cookies with CSRF protection
- **Error Handling**: Comprehensive error dialogs and logging
- **Type Safety**: Full TypeScript support across Electron main process
- **Graceful Shutdown**: Proper cleanup of server processes and resources

### Changed

- **Authentication**: Extended session duration from default to 30 days
- **Cookie Settings**: Custom cookie configuration for better persistence
- **Package Configuration**: Updated main entry point and build configuration
- **Environment Detection**: Improved production/development mode detection

### Fixed

- **Session Loss**: Fixed issue where users had to log in on every app restart
- **Preference Loss**: Fixed settings not persisting between app sessions
- **Build Process**: Resolved standalone build issues with missing resources

## [0.2.0] - Initial Release

### Added - Core Application

#### Music Streaming Platform

- **Starchild Integration**: Full integration with Starchild API for music streaming
- **Audio Player**: Advanced audio player with full playback controls
- **Queue Management**: Comprehensive queue system with drag-and-drop reordering
- **Search**: Real-time music search with artist, album, and track results
- **Playlists**: Create, manage, and play custom playlists

#### Smart Features

- **Smart Queue**: Intelligent auto-queue with similarity-based recommendations
- **Smart Mix**: Generate personalized mixes from seed tracks
- **HexMusic API Integration**: Advanced recommendation engine
- **Audio Analysis**: Spotify audio features integration for intelligent recommendations
- **Similarity Filtering**: Adjustable similarity levels (strict, balanced, diverse)

#### Audio Features

- **9-Band Equalizer**: Professional equalizer with custom and preset options
  - 8 built-in presets (Rock, Pop, Jazz, Classical, etc.)
  - Custom band adjustment
  - Real-time audio processing
  - Preset and settings persistence
- **Audio Visualizers**: Multiple visualizer types
  - Spectrum Analyzer
  - Waveform
  - Circular
  - Frequency Bands (Radial, Waterfall, Layered, Particles, Circular, Bars)
  - Radial Spectrum
  - Spectral Waves
  - Particle System
  - Frequency Rings
- **Playback Controls**:
  - Variable playback speed (0.5x - 2.0x)
  - Repeat modes (none, one, all)
  - Shuffle
  - Volume control with mute
  - Skip forward/backward (10 seconds)

#### User Interface

- **Responsive Design**: Full mobile and desktop support
- **Mobile Navigation**: Bottom navigation bar with swipeable panes
- **Swipe Gestures**: Natural mobile interactions
- **Pull-to-Refresh**: Refresh content with pull gesture
- **Dark Theme**: Modern dark UI design
- **Haptic Feedback**: Touch feedback on mobile devices (where supported)
- **Floating Action Button**: Quick access to player on mobile
- **Keyboard Shortcuts**: Comprehensive keyboard navigation
  - Space: Play/pause
  - Arrow keys: Navigate and seek
  - Number keys: Quick navigation
  - M: Mute
  - And more...

#### Backend & Infrastructure

- **Next.js 15**: Latest Next.js with App Router
- **tRPC**: Type-safe API layer
- **PostgreSQL**: Reliable database with Drizzle ORM
- **NextAuth**: Discord OAuth authentication
- **Drizzle ORM**: Type-safe database queries and migrations

#### Data Management

- **User Profiles**: User accounts with authentication
- **Listening History**: Track playback history
- **Playlist Management**: CRUD operations for playlists
- **Favorites**: Like/unlike tracks
- **User Preferences**: Stored equalizer and UI preferences
- **Smart Queue Settings**: Configurable auto-queue behavior

#### Developer Features

- **TypeScript**: Full type safety across the stack
- **ESLint**: Code quality and consistency
- **Prettier**: Code formatting
- **Tailwind CSS 4**: Modern utility-first styling
- **Error Boundaries**: Graceful error handling
- **Toast Notifications**: User feedback system
- **Loading States**: Comprehensive loading indicators
- **Type Guards**: Runtime type validation
- **Storage Abstraction**: Type-safe localStorage wrapper

#### Performance

- **React Query**: Efficient data fetching and caching
- **Audio Context**: Optimized Web Audio API usage
- **Debounced Updates**: Performance-optimized user interactions
- **Lazy Loading**: Code splitting and component lazy loading
- **Image Optimization**: Next.js Image component
- **Bundle Analysis**: Build size monitoring

#### Testing & Quality

- **Type Checking**: Strict TypeScript configuration
- **Linting**: Comprehensive ESLint rules
- **Error Suppression**: Extension error filtering
- **Debug Logging**: Detailed console logging for development

### Technical Stack

#### Frontend

- Next.js 15.5.6
- React 19.2.0
- TypeScript 5.9.3
- Tailwind CSS 4.1.16
- Framer Motion 12.23.24
- tRPC 11.7.0
- TanStack Query 5.90.5

#### Backend

- Next.js API Routes
- NextAuth 5.0.0-beta.30
- Drizzle ORM 0.41.0
- PostgreSQL (via pg 8.16.3)
- tRPC Server 11.0.0

#### Audio & Visualization

- Tone.js 15.1.22
- Web Audio API
- Canvas API
- react-audio-visualize 1.2.0

#### Development

- Electron 39.2.1
- Electron Builder 25.1.8
- ESLint 9.38.0
- Prettier 3.6.2
- Concurrently 9.1.2
- Cross-env 7.0.3

#### Build & Deploy

- PM2 Ecosystem
- Standalone Next.js Output
- Webpack 5.102.1
- PostCSS 8.5.6

---

## Release Notes

### Version 0.3.0 - Electron Desktop Application

This release transforms darkfloor.art into a full-featured desktop application with complete state persistence. Users can now:

- Install darkfloor.art as a native desktop app on Windows, macOS, and Linux
- Enjoy seamless login that persists across app restarts
- Have all preferences, settings, and UI state automatically saved and restored
- Use global media keys to control playback
- Experience native window management with state persistence

### Version 0.2.0 - Initial Release

The initial release of darkfloor.art provides a comprehensive music streaming platform with intelligent recommendations, advanced audio features, and a modern user interface. Key highlights:

- Stream music from Starchild's extensive catalog
- Intelligent auto-queue with similarity-based recommendations
- Professional 9-band equalizer with multiple visualization options
- Full mobile and desktop responsive design
- User authentication and personalized experience

---

## Upgrade Guide

### From 0.2.0 to 0.3.0

**For End Users:**

1. Download the installer for your platform from the releases page
2. Run the installer
3. Your first login will require Discord OAuth
4. After login, all preferences will persist automatically

**For Developers:**

1. Pull the latest changes
2. Install dependencies: `npm install`
3. Set up environment variables (see `.env.example`)
4. For development: `npm run electron:dev`
5. For production testing: `npm run electron:prod`
6. For building: `npm run electron:build:win` (or mac/linux)

**Database Migrations:**
No database migrations required for this release.

---

## Known Issues

### Version 0.3.0

- First-time setup requires manual Discord OAuth configuration in environment variables
- Windows installer requires manual uninstallation of previous versions
- macOS may require security preferences adjustment for first launch (unsigned builds)

### Version 0.2.0

- Mobile Safari may have issues with audio autoplay due to browser restrictions
- Some visualizers may have performance issues on lower-end devices
- Database migrations require manual execution via Drizzle Kit

---

## Future Roadmap

### Planned Features

- [ ] Offline mode with local caching
- [ ] Cross-device sync
- [ ] Last.fm scrobbling
- [ ] Lyrics display
- [ ] Mini player mode
- [ ] System tray integration
- [ ] Auto-updates
- [ ] Custom themes
- [ ] Podcast support
- [ ] Radio stations

### Under Consideration

- [ ] Spotify integration
- [ ] Apple Music integration
- [ ] Collaborative playlists
- [ ] Social features
- [ ] Artist pages
- [ ] Concert information
- [ ] Music discovery features

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- Starchild API for music streaming
- NextAuth for authentication
- Electron for desktop application framework
- All open-source contributors

---

**Note**: This changelog is maintained manually. For detailed commit history, see the Git repository.
