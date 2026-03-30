# AI Tooling Guide

Last updated: 2026-03-30

This is the tool-neutral companion to `AGENTS.md`.

Use it when working in Codex, Claude Code, Cursor, GitHub Copilot, or any other coding assistant that needs a fast, truthful map of the repo.

## Read order

1. `AGENTS.md`
2. `CONTEXT.md`
3. `README.md`
4. `AI_TOOLING.md`
5. `apps/mobile/README.md` when the task touches mobile
6. `api/AGENTS.md`, `api/CONTEXT.md`, and `api/CODEX.md` when the task touches backend behavior
7. `CHANGELOG.md` when the task is user-visible and release notes matter

## Reality checks

- Verify the live filesystem before relying on older repo maps such as `tree.txt`.
- Do not assume `docs/` or tool-specific config folders exist just because an older snapshot mentions them.
- `AGENTS.md` is the canonical workflow file. Tool-specific files should stay thin and point back to it.

## Quick commands

- `pnpm dev`: start the main web runtime through the custom server
- `pnpm dev:mobile`: start the Expo web runtime
- `pnpm dev:mobile:native`: start Expo for native targets
- `pnpm dev:mobile:ios`: launch the iOS Expo target
- `pnpm dev:mobile:android`: launch the Android Expo target
- `pnpm mobile:check`: type-check the mobile workspace
- `pnpm mobile:build`: export the mobile web build
- `pnpm check`: boundary check, lint, and type-check the web app
- `pnpm ws:check`: run workspace checks through Turborepo

## High-value entry points

- Web:
  - `apps/web/src/app`
  - `apps/web/src/server/api`
  - `apps/web/src/server/auth`
  - `apps/web/src/server/db`
- Mobile:
  - `apps/mobile/src/mobile-shell`
  - `apps/mobile/src/index.ts`
  - `apps/mobile/README.md`
- Desktop:
  - `apps/desktop/electron`
  - `apps/desktop/scripts`
- Shared packages:
  - `packages/config/src`
  - `packages/types/src`
  - `packages/player-core/src`
  - `packages/player-react/src`
  - `packages/visualizers/src`
- Backend:
  - `api/src`
  - `api/prisma`

## Working rules

- Keep package boundaries clean: `packages/*` must not import app code.
- Prefer existing root scripts over ad-hoc one-off commands when a repo script already exists.
- Use shared types from `@starchild/types` and shared constants from `@starchild/config` before inventing local copies.
- In the web runtime, use `apps/web/src/env.js` instead of introducing fresh direct `process.env` reads.
- For mobile work, keep view-only state in `apps/mobile` and leave reusable runtime contracts in shared packages.
- When a change is user-visible, bump version metadata and update `CHANGELOG.md`.

## Validation defaults

- Mobile-only changes:
  - `pnpm mobile:check`
- Web/runtime changes:
  - `pnpm check`
- Cross-workspace changes:
  - `pnpm ws:check`

## Compatibility files

- `CLAUDE.md` exists only to point Claude-style tooling at the canonical repo docs.
- `.github/copilot-instructions.md` exists only to give Copilot the same starting assumptions.
- If you add more tool-specific files later, keep them short and route them back to `AGENTS.md` plus this file.
