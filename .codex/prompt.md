# Codex Prompt State

Last updated: 2026-04-06

This repository is frontend-first.

## Primary Ownership

- `apps/web` owns Next.js routing, Auth.js/NextAuth, Discord/GitHub OAuth, browser cookies, redirect flows, and user-facing auth UX.
- `apps/mobile` owns the Expo/mobile runtime.
- `packages/*` own shared contracts and reusable runtime code.
- `api/` is a backend Git submodule and is not part of the normal frontend implementation path.

## Frontend/Auth Boundary

- If a task mentions OAuth, cookies, redirects, sessions, or auth, start in `apps/web`.
- Discord and GitHub provider OAuth are frontend Auth.js/NextAuth concerns.
- Frontend provider sign-in must not be inferred from backend auth env vars or backend service config.
- `NEXT_PUBLIC_AUTH_API_BASE` is for backend/API-backed auth routes and proxies that explicitly use it. It is not the source of truth for frontend Auth.js provider sign-in.
- Only move into `api/` when the task explicitly requires backend behavior or coordinated full-stack work.

## Repo Map

- Web auth/session: `apps/web/src/server/auth/*`, `apps/web/src/app/api/auth/[...nextauth]/route.ts`
- Web auth UI/helpers: `apps/web/src/app/signin/page.tsx`, `apps/web/src/components/AuthModal.tsx`, `apps/web/src/utils/startOAuthSignIn.ts`
- Mobile shell: `apps/mobile/src/mobile-shell/*`
- Shared auth/config/types: `packages/auth/src/*`, `packages/config/src/*`, `packages/types/src/*`

## Working Stance

- Default to minimal, localized frontend fixes.
- State clearly whether a task is frontend-only, backend-only, or coordinated full-stack.
- If backend work is truly needed, read `api/AGENTS.md` and `api/.codex` first.
