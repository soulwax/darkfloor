# AI Tooling Guide

Last updated: 2026-04-12

This is the tool-neutral companion to `AGENTS.md`.

Use it when working in Codex, Claude Code, Cursor, GitHub Copilot, or any other coding assistant that needs a fast, truthful map of the repo.

## Read order

1. `AGENTS.md`
2. `CONTEXT.md`
3. `README.md`
4. `AI_TOOLING.md`
5. `.codex/prompt.md` for current workspace state and boundary reminders
6. `.codex/tasks.md` for recurring task checklists and auth/frontend ownership rules
7. `.codex/acceptance.md` for definition-of-done guidance
8. `apps/mobile/README.md` when the task touches mobile
9. External Darkfloor API V2 repo or contract docs when the task touches backend behavior
10. `api/AGENTS.md` and `api/.codex` only when full-stack/backend work is explicitly required
11. `CHANGELOG.md` when the task is user-visible and release notes matter

## Reality checks

- Verify the live filesystem before relying on older repo maps such as `tree.txt`.
- Do not assume `docs/` or tool-specific config folders exist just because an older snapshot mentions them.
- `AGENTS.md` is the canonical workflow file. Tool-specific files should stay thin and point back to it.
- Root `pnpm install --frozen-lockfile` runs `install:api` in `postinstall`, so initialize the `api/` submodule before first install in a normal checkout.
- Treat `apps/web` as the default home for auth, OAuth, cookies, redirects, and Next.js behavior.
- Treat `api/` as an opt-in backend submodule. Do not enter it unless the task clearly requires backend or coordinated full-stack work.
- Do not use backend/API env vars as the source of truth for frontend Auth.js provider behavior unless the code path explicitly consumes them.
- Treat the frontend production runtime as PM2-hosted on Ubuntu, not Vercel. For frontend incidents, default to PM2 logs and local process/runtime inspection before any Vercel-specific tooling.

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
- Backend only when necessary:
  - `api/`
  - `api/AGENTS.md`
  - `api/.codex`
## Working rules

- Keep package boundaries clean: `packages/*` must not import app code.
- Prefer existing root scripts over ad-hoc one-off commands when a repo script already exists.
- Use shared types from `@starchild/types` and shared constants from `@starchild/config` before inventing local copies.
- In the web runtime, use `apps/web/src/env.js` instead of introducing fresh direct `process.env` reads.
- For mobile work, keep view-only state in `apps/mobile` and leave reusable runtime contracts in shared packages.
- When a change is user-visible, bump version metadata and update `CHANGELOG.md`.
- For auth/OAuth tasks, decide up front whether the work belongs to frontend Auth.js/Next.js or the backend API; do not mix them by assumption.

## Validation defaults

- Mobile-only changes:
  - `pnpm mobile:check`
- Web/runtime changes:
  - `pnpm check`
- Cross-workspace changes:
  - `pnpm ws:check`

## Compatibility files

These thin compatibility files should mirror the same repo boundaries and setup reminders:

- `CODEX.md`
- `CLAUDE.md`
- `.cursor/rules/starchild-repo.mdc`
- `.github/copilot-instructions.md`

Keep detailed architecture or workflow changes in `AGENTS.md` and this file first, then sync the thin compatibility files if needed.
