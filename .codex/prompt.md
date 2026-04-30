# Codex Prompt State

Last updated: 2026-04-30

This repository contains the frontend workspaces and the full backend checkout.

Local instance notes:

- Frontend web runtime: `http://127.0.0.1:3222`
- Backend API runtime: `http://127.0.0.1:3333`
- Host OS: Ubuntu 24.04
- Production process model: PM2, not Vercel
- Frontend production is served by the PM2 process `bluesix-frontend-prod`
- Do not use Vercel deployment/log assumptions for the frontend unless a task explicitly concerns separate Vercel-hosted API replicas
- These deployment details help debugging, but frontend OAuth/auth ownership rules should not depend on Vercel-specific assumptions.

## Primary Ownership

- `apps/web` owns Next.js routing, Auth.js/NextAuth, Discord/GitHub OAuth, browser cookies, redirect flows, and user-facing auth UX.
- `apps/mobile` owns the Expo/mobile runtime.
- `packages/*` own shared contracts and reusable runtime code.
- `api/` is the full backend source checkout/submodule. Use it for backend API behavior, backend auth endpoints, domain logic, migrations, and coordinated frontend/backend changes.

## Frontend/Auth Boundary

- If a task mentions OAuth, cookies, redirects, sessions, or auth, start in `apps/web`.
- Discord and GitHub provider OAuth are frontend Auth.js/NextAuth concerns.
- Frontend provider sign-in must not be inferred from backend auth env vars or backend service config.
- `NEXT_PUBLIC_AUTH_API_BASE` is for backend/API-backed auth routes and proxies that explicitly use it. It is not the source of truth for frontend Auth.js provider sign-in.
- Move into `api/` whenever the task involves backend behavior, API contracts, upstream response shape, backend auth, or coordinated full-stack work.

## Repo Map

- Web auth/session: `apps/web/src/server/auth/*`, `apps/web/src/app/api/auth/[...nextauth]/route.ts`
- Web auth UI/helpers: `apps/web/src/app/signin/page.tsx`, `apps/web/src/components/AuthModal.tsx`, `apps/web/src/utils/startOAuthSignIn.ts`
- Mobile shell: `apps/mobile/src/mobile-shell/*`
- Shared auth/config/types: `packages/auth/src/*`, `packages/config/src/*`, `packages/types/src/*`

## Working Stance

- Default to minimal, localized fixes in the owning workspace.
- State clearly whether a task is frontend-only, backend-only, or coordinated full-stack.
- For backend work, read `api/AGENTS.md` and `api/.codex` first.
