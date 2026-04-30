# Platform TODO

Last updated: 2026-04-30

This roadmap is the next-level plan for Starchild/Darkfloor as a music platform, not just a frontend maintenance queue. The default owner is the frontend monorepo (`apps/web`, `apps/mobile`, and `packages/*`). Backend/API work should stay contract-first and only enter the external service or `api/` submodule when a task explicitly requires coordinated full-stack changes.

## North Star

Make Starchild feel like a durable personal music OS: import anything, match it confidently, play it everywhere, preserve listener state across surfaces, explain failures clearly, and ship changes with enough automated confidence that production work feels boring.

## P0 - Stabilize The Current Release Path

- [ ] Confirm the Windows NSIS installer no longer reports the app as running after the window has been closed with `pnpm electron:verify:win-close -- -RunInstallerCheck`.
- [ ] Add a small Windows diagnostic helper that lists running processes under the installed app directory so installer failures can be explained quickly.
- [ ] Re-run the packaged Electron smoke test on Windows: install, launch, close, reinstall, confirm startup, and confirm update flow.
- [ ] Keep Linux Electron packaging unchanged while validating the Windows-only fixes.
- [ ] Add dedicated Tauri Windows scripts for `nsis` only so MSI/WiX failures do not block the experimental shell path.
- [ ] Add a release verification checklist that covers `pnpm check`, `pnpm test`, web build, upstream API smoke, Electron Windows build, Electron Linux build, and optional Tauri build.

## P0 - Make Playlist Import First-Class

- [ ] Consolidate duplicated Spotify and M3U/M3U8 local playlist creation logic into a shared import helper under `apps/web/src/app/api/music/playlists/import`.
- [ ] Keep backend translation as the contract boundary, but create Starchild playlists locally in one frontend-owned path for Spotify, M3U/M3U8, and future import sources.
- [ ] Add import-job identity and idempotency so retries do not accidentally create duplicate playlists after a timeout.
- [ ] Persist import reports so listeners can reopen a previous import, inspect unmatched tracks, and continue manual resolution later.
- [ ] Add a manual match editor for M3U/M3U8 imports that mirrors the Spotify unresolved-track review flow.
- [ ] Expand import tests around timeout recovery, invalid upstream payloads, duplicate playlist retries, unmatched candidates, and zero-match imports.
- [ ] Add import observability with structured logs that include source type, track count, matched count, unmatched count, duration, and failure class without leaking tokens or playlist contents.

## P1 - Build Friends And Collaborative Playlists

Collaborative playlists need a social trust layer before write access is safe. The first version should use mutual friendships rather than open follows: a user sends a friend request, the recipient accepts or declines, and accepted friends can be invited to collaborate on playlists. Public profile browsing can remain separate from friendship so profile visibility and playlist editing do not get tangled too early.

Recommended first model:

- [x] Add a `friend_requests` table with `id`, `requesterUserId`, `recipientUserId`, `status` (`pending`, `accepted`, `declined`, `cancelled`, `blocked`), `message`, `createdAt`, `respondedAt`, and unique pending-request protection for each user pair.
- [x] Add a `friendships` table with two canonical user IDs (`userAId`, `userBId` sorted lexicographically), `createdAt`, and `createdByUserId`, so mutual friendship checks are fast and duplicate direction rows cannot exist.
- [x] Add a `user_blocks` table before broad social discovery ships, with `blockerUserId`, `blockedUserId`, `createdAt`, and hard checks that block requests, invitations, profile social actions, and collaborator writes.
- [ ] Keep the existing `profilePublic` behavior unchanged for now; add `profileVisibility: public | friends | private` only after friend checks exist and are tested.
- [x] Expose tRPC procedures for searching users by exact user hash/name, sending requests, accepting/declining/cancelling requests, listing friends, and removing a friend.
- [ ] Add notification-ready event records for friend request sent/accepted/declined, but keep the first UI simple: a Friends panel in Settings/Profile and a compact request inbox.
- [x] Add the first Friends panel in Settings with user search, outgoing requests, incoming request accept/decline, friend removal, and blocking.

Collaborative playlist model:

- [x] Add playlist-level collaboration fields: `isCollaborative`, `collaborationMode` (`owner_invite_only` first), and optional `collaborationUpdatedAt`.
- [x] Add a `playlist_collaborators` table with `playlistId`, `userId`, `role` (`owner`, `editor`, `viewer`), `status` (`invited`, `active`, `removed`, `left`), `invitedByUserId`, `createdAt`, `acceptedAt`, and `updatedAt`.
- [x] Add `addedByUserId` to `playlist_track` so “who added this song” is real data instead of falling back to the playlist owner.
- [x] Add `updatedByUserId` for reorder operations.
- [ ] Add lightweight action metadata for reorder/remove operations if audit/history becomes important after the first release.
- [x] Keep playlist ownership as-is: the existing `playlists.userId` remains the canonical owner and only owners can delete playlists, transfer ownership, or remove collaborators.
- [x] Gate collaborator write permissions through one shared server helper used by add/remove/reorder playlist procedures, rather than duplicating role checks in each mutation.

Playlist collaboration UX:

- [ ] Add a “Make collaborative” action for playlist owners with clear copy that collaborators can add, remove, and reorder tracks.
- [x] Add an invite dialog scoped to accepted friends first; do not allow arbitrary public invites until blocking, abuse controls, and invite limits exist.
- [x] Show collaborator avatars/names in the playlist header once collaborator read models are polished.
- [x] Show a real “Added by” column in the track table once `addedByUserId` exists.
- [x] Preserve the current graceful fallback: if `addedByUserId` or user profile data is missing, display `addedAt` rather than leaving the row visually broken.
- [ ] Add collaborator management: resend invite, revoke invite, remove collaborator, leave playlist, and copy public share link when the playlist is public. Owner remove and collaborator leave are in place; resend/revoke-specific copy and collaborator share affordances remain.
- [ ] Add conflict-safe reorder behavior before multiple editors are common: include playlist track IDs and positions in mutation payloads, and refetch after successful writes.

Open product questions:

- [ ] Decide whether Starchild should also support one-way following later. Recommendation: defer follows until after mutual friendships because follows are better for public activity feeds, while collaboration needs consent and trust.
- [ ] Decide whether friends can see private playlists by default. Recommendation: no; private playlists stay private unless explicitly shared or collaborative.
- [ ] Decide whether collaboration requires both users to be friends forever. Recommendation: a collaborator may remain after friendship removal until the owner removes them, but blocked users immediately lose access.
- [ ] Decide whether imported Spotify collaborative playlists should preserve contributor identity. Recommendation: import tracks first, then add contributor mapping only if the upstream payload includes stable contributor data.
- [ ] Decide whether activity feeds should show friend playlist edits. Recommendation: do not ship activity feeds in the first collaboration milestone; log events privately first.

Implementation phases:

- [x] Phase 1: Data model and server permissions for friend requests, friendships, blocks, collaborators, and `playlist_track.addedByUserId`.
- [ ] Phase 2: Friends UI in Settings/Profile plus invite/accept flows using existing auth sessions and public user hashes. Settings and playlist invite accept/decline are in place; Profile entry points remain.
- [ ] Phase 3: Collaborative playlist owner controls and collaborator-gated add/remove/reorder mutations. Server gating and first owner invite dialog are in place.
- [ ] Phase 4: Playlist detail polish: collaborator header, real “Added by”, friend invite dialog, empty states, and removal/leave flows. Collaborator header, real “Added by”, the first invite dialog, and leave flow are in place.
- [ ] Phase 5: Tests and abuse controls: permission matrix tests, blocked-user tests, invite limits, duplicate request handling, collaborator removal, and reorder conflict recovery.

## P1 - Build The Music Intelligence Layer

- [ ] Introduce a normalized track identity model that consistently stores Deezer IDs, Spotify IDs, source URLs, ISRC when available, duration, artist names, album names, and confidence score.
- [ ] Add a user-visible match confidence model for imported tracks so ambiguous matches are explained instead of silently accepted or rejected.
- [ ] Create a reusable search-and-resolve service for imports, smart queue, recommendations, and manual playlist editing.
- [ ] Upgrade smart queue into a listener intent system with modes such as continue vibe, surprise me, deep cuts, artist radio, and playlist repair.
- [ ] Store lightweight listener feedback on matches, skips, saves, and manual corrections so recommendations and future imports improve over time.
- [ ] Add playlist health diagnostics that identify unavailable tracks, duplicate tracks, missing artwork, weak matches, and candidate replacements.
- [ ] Add discovery surfaces that are generated from existing listening history and playlist taste instead of only upstream generic endpoints.

## P1 - Make Playback A Shared Product Foundation

- [ ] Move more queue and playback invariants into `packages/player-core` so web, desktop, and mobile share the same rules.
- [ ] Define a cross-runtime playback contract for queue mutation, history writes, stream quality, repeat/shuffle behavior, and recovery from failed tracks.
- [ ] Add deterministic tests for queue reorder, play-next, smart-track sections, duplicate removal, repeat modes, failed-track cleanup, and persisted resume.
- [ ] Add a playback event bus with typed events for play, pause, seek, skip, error, stream quality change, queue mutation, and source recovery.
- [ ] Use the playback event stream for history, analytics, UI state, and diagnostics instead of scattering side effects through React components.
- [ ] Add graceful stream fallback behavior that can retry an alternate quality or source before surfacing an error to the listener.
- [ ] Document the boundary between `packages/player-core`, `packages/player-react`, `packages/audio-adapters`, and app-local UI state.

## P1 - Modernize The Web App Architecture

- [ ] Audit `apps/web/src/app/**` and move data fetching to Server Components wherever interactivity is not required.
- [ ] Remove request waterfalls on high-traffic routes by starting independent server fetches in parallel and awaiting them later.
- [ ] Add or refine `Suspense` boundaries on home, library, playlists, playlist details, artist, album, and track pages.
- [ ] Dynamically import non-critical heavy UI such as admin diagnostics, visualizer-heavy surfaces, import review tools, large dialogs, and drawers.
- [ ] Measure the largest client bundles and identify dependencies that are leaking into the browser unnecessarily.
- [ ] Reduce data passed from Server Components to Client Components so serialized payloads stay smaller and hydration is cheaper.
- [ ] Review `apps/web/src/proxy.ts` and request interception for compatibility, caching behavior, and unnecessary work on every request.
- [ ] Register or remove stale tRPC routers such as `preferences` so `apps/web/src/server/api/root.ts` reflects the real API surface.

## P1 - Reach App-Shell Parity Across Web, Desktop, And Mobile

- [ ] Convert the mobile shell from staged data to real auth, API-backed discovery/search, queue state, and shared playback contracts.
- [ ] Keep mobile view-only state in `apps/mobile`, but move reusable runtime contracts into shared packages before wiring real data.
- [ ] Standardize desktop startup logging so packaged failures are traceable from one known log location.
- [ ] Add a packaged-app health check that verifies `.next/BUILD_ID`, `.next/static`, `server.js`, and required runtime modules before shell startup.
- [ ] Profile desktop startup by separating Electron/Tauri startup, bundled Node startup, Next standalone readiness, first page load, and hydration.
- [ ] Document the intended difference between Electron production builds, Electron dev builds, Tauri staged builds, and Tauri no-prepare builds.
- [ ] Decide whether the desktop shell should eventually replace the bundled Next server with a leaner runtime path for faster cold starts.

## P1 - Harden Auth, Data, And Runtime Config

- [ ] Audit auth and desktop-local session flows so Electron-specific behavior stays explicit and testable.
- [ ] Consolidate env expectations across `.env.example`, `apps/web/src/env.js`, Electron build helpers, Tauri build helpers, and PM2 runtime docs.
- [ ] Add a clear rule for build-time-only versus runtime-only env values.
- [ ] Add integration coverage for the most important route handlers and proxies: auth, Songbird, Spotify, V2 proxy endpoints, stream, and playlist imports.
- [ ] Make optional DB read/write load-shedding states visible in admin diagnostics so migration windows are understandable.
- [ ] Add database repair checks for playlist/favorite/history sequences and identity columns before user-facing writes fail.
- [ ] Keep frontend Auth.js/NextAuth behavior owned by `apps/web`; do not infer provider behavior from backend auth env vars.

## P2 - Production Observability And Operations

- [ ] Add a PM2-first production runbook for frontend incidents covering process state, logs, env inspection, health routes, restart strategy, and rollback.
- [ ] Add structured runtime logs around upstream proxy selection, request timeout class, response status, and fallback behavior.
- [ ] Add admin-facing diagnostics for import health, stream health, optional DB toggles, upstream pool status, cache status, and recent failure classes.
- [ ] Capture startup timing metrics in desktop shells so regressions are visible instead of anecdotal.
- [ ] Add lightweight client-side error reporting for playback, import, auth callback, and visualizer failures.
- [ ] Define privacy-safe analytics events for playback quality, import completion, unresolved imports, search success, and queue actions.
- [ ] Create a weekly maintenance checklist for dependency health, migration drift, package boundaries, stale routers, and release notes.

## P2 - Testing And Quality Gates

- [ ] Add Playwright smoke coverage for landing/home, sign-in, library, playlist details, playlists import, settings, and playback controls.
- [ ] Add browser verification for the import dialog on desktop width and mobile width.
- [ ] Add regression tests around settings persistence, auth/session restoration, queue persistence, and optional DB-disabled states.
- [ ] Add API-route tests for proxy timeout handling, authorization forwarding, invalid JSON, schema mismatch, and upstream failure payloads.
- [ ] Add mobile validation to CI with `pnpm mobile:check` once mobile starts consuming real shared contracts.
- [ ] Keep `pnpm check`, `pnpm test`, and targeted workspace checks as the default validation gate before release-sensitive merges.
- [ ] Add a small benchmark script for Electron and Tauri startup time against the same staged web bundle.

## P2 - Developer Experience And Repo Hygiene

- [ ] Replace ad hoc release notes with a reusable GitHub release template based on `CHANGELOG.md`.
- [ ] Add a short onboarding doc for the external Darkfloor API repo and contract docs so frontend work that depends on backend behavior is easier to reason about.
- [ ] Decide whether package metadata should keep the legacy `darkfloor-player` name or be renamed consistently to Starchild/Darkfloor.
- [ ] Keep assistant compatibility files thin and route canonical workflow changes through `AGENTS.md` plus `AI_TOOLING.md`.
- [ ] Add a recurring task to prune one-off branch notes from `TODO.md` once they become issues, PRs, or release checklists.
- [ ] Document preferred locations for new shared contracts, app-local utilities, route handlers, tRPC routers, and player logic.
- [ ] Add boundary examples for common mistakes such as importing `apps/web` code into `packages/*` or treating the `api/` submodule as the default implementation path.

## Later Bets

- [ ] Offline-ready playlist snapshots for desktop and mobile with explicit licensing and stream-source constraints.
- [ ] Collaborative playlist sessions with live presence, voting, host controls, and conflict-safe queue edits after the basic friend/collaborator model is stable.
- [ ] A listener repair assistant that can explain missing tracks and propose high-confidence replacements.
- [ ] A personal music graph that connects artists, albums, playlists, imports, listens, skips, saves, and manual corrections.
- [ ] Native mobile builds with production auth, deep links, playback lifecycle handling, and crash reporting.
