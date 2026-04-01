# Project TODO

Last updated: 2026-04-01

This roadmap focuses on the highest-leverage work for `apps/web` as the primary Next.js product, while keeping the Electron and experimental Tauri shells aligned with it.

## P0 - Release blockers

- [ ] Confirm the Windows NSIS installer no longer reports the app as running after the window has been closed.
- [ ] Add a small Windows diagnostic helper that lists running processes under the installed app directory so installer failures can be explained quickly.
- [ ] Re-run the packaged Electron smoke test on Windows:
  - install
  - launch
  - close
  - reinstall
  - confirm startup and update flows both work
- [ ] Keep Linux Electron packaging unchanged while validating the recent Windows-only fixes.
- [ ] Add dedicated Tauri Windows scripts for `nsis` only so MSI/WiX failures do not block the experimental shell path.

## P1 - Next.js architecture and performance

- [ ] Audit `apps/web/src/app/**` and move data fetching to Server Components wherever interactivity is not required.
- [ ] Remove request waterfalls on high-traffic routes by starting independent server fetches in parallel and awaiting them later.
- [ ] Add or refine `Suspense` boundaries on the homepage, library, playlist, artist, and album flows so the shell renders before slower data finishes.
- [ ] Review heavy client routes and dynamically import non-critical UI:
  - admin diagnostics
  - visualizer-heavy surfaces
  - Spotify import tools
  - large dialogs and drawers
- [ ] Measure the largest client bundles and identify which dependencies are leaking into the browser unnecessarily.
- [ ] Reduce data passed from Server Components to Client Components so serialized payloads stay smaller and hydration is cheaper.
- [ ] Audit `apps/web/src/proxy.ts` and related request interception for Next.js 16 compatibility, caching behavior, and unnecessary work on every request.
- [ ] Review `cookies()`, `headers()`, `params`, and `searchParams` usage for Next.js 16 async patterns and consistency.

## P1 - Desktop startup and packaging

- [ ] Profile desktop startup end to end and split time spent in:
  - Electron/Tauri shell startup
  - bundled Node startup
  - Next standalone server readiness
  - first page load and hydration
- [ ] Trim the desktop payload by identifying which parts of the standalone Next bundle and bundled Node runtime are actually required at runtime.
- [ ] Add a fast local desktop packaging path for Windows that avoids rebuilding both installer targets during iteration.
- [ ] Add a packaged-app health check that verifies:
  - `.next/BUILD_ID`
  - `.next/static`
  - `server.js`
  - required `node_modules`
  before the desktop shell attempts startup
- [ ] Standardize desktop logging so packaged failures are easy to trace from a single known log location.

## P1 - Data, API, and auth correctness

- [ ] Review `apps/web/src/server/api/root.ts` against `apps/web/src/server/api/routers/*` and either register or remove stale routers so the API surface matches the repo.
- [ ] Add integration coverage for the most important route handlers and proxies:
  - auth
  - Songbird
  - Spotify
  - V2 proxy endpoints
- [ ] Audit auth and desktop-local session flows so Electron-specific behavior stays explicit and testable.
- [ ] Consolidate env expectations across:
  - `.env.example`
  - `apps/web/src/env.js`
  - Electron build helpers
  - Tauri staging/build helpers
- [ ] Add a clear rule for which env values are build-time only versus runtime-only.

## P2 - Testing and observability

- [ ] Add Playwright smoke coverage for the primary user journeys:
  - landing/home
  - sign-in
  - library
  - playlist details
  - settings
- [ ] Add a desktop smoke test checklist for packaged builds on Windows and Linux.
- [ ] Capture startup timing metrics in the desktop shells so regressions are visible instead of anecdotal.
- [ ] Add regression tests around settings persistence and auth/session restoration.
- [ ] Add a release verification checklist before tagging:
  - web build
  - API build
  - Electron Windows build
  - Electron Linux build
  - optional Tauri experimental build

## P2 - Developer experience and repo hygiene

- [ ] Replace ad hoc release notes with a reusable GitHub release template based on `CHANGELOG.md`.
- [ ] Document the intended difference between:
  - Electron production builds
  - Electron dev builds
  - Tauri staged builds
  - Tauri no-prepare builds
- [ ] Decide whether package metadata should keep the legacy `darkfloor-player` name or be renamed consistently to `darkfloor`.
- [ ] Add a short onboarding doc for the `api/` submodule so frontend work that depends on backend contracts is easier to reason about.
- [ ] Keep `TODO.md` scoped to current product work and move one-off feature experiments into issue-specific notes or branch-local docs.

## Nice to have

- [ ] Evaluate whether the desktop shell should eventually replace the bundled Next server with a leaner runtime path for faster cold starts.
- [ ] Revisit the experimental Tauri shell once the Electron startup and installer path are stable enough to compare fairly.
- [ ] Add a lightweight benchmark script that compares Electron and Tauri startup time on the same staged web bundle.
