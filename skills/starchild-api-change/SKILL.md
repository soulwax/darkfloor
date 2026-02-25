---
name: starchild-api-change
description: Implement and validate API-surface changes in the Starchild monorepo. Use when adding or modifying tRPC procedures, Next.js route handlers under apps/web/src/app/api/**, authentication callbacks, DB-backed server behavior, or environment variables that power those flows.
---

# Starchild API Change

## Overview

Implement backend-facing changes with the repository's expected structure and guardrails. Keep proxy routes focused on external upstream services, keep app data in tRPC, and apply env and validation rules consistently.

## Start Workflow

1. Classify the requested change:
Use the tRPC path for first-party app data and business logic.
Use API route handlers in `apps/web/src/app/api/**/route.ts(x)` for upstream proxying.
Use auth and DB paths for session, user, and persistence behavior.

2. Load only high-signal context files first:
Read `CONTEXT.md`.
Read `docs/ARCHITECTURE.md`.
Read `docs/API_ROUTE_USE.md`.
Read `docs/API_V2_SWAGGER.yaml` when touching V2 proxy contracts.

3. Open `references/path-and-checks.md` for concrete file locations and command checklist.

## Implement by Change Type

### tRPC changes

- Edit or add procedures in `apps/web/src/server/api/routers/*`.
- Register new routers in `apps/web/src/server/api/root.ts`.
- Keep IO contracts typed with shared packages when data is reused across app boundaries.
- Prefer package imports via `@starchild/*` and app-local imports via `@/`.

### Proxy route changes

- Create or edit handlers under `apps/web/src/app/api/**/route.ts(x)`.
- Keep these routes focused on upstream calls (Bluesix V2, Deezer, health-style proxying).
- Forward only required headers and params; preserve `Range` semantics for streaming flows.
- Validate upstream payload shape before returning data to UI callers.

### Env changes

- Add or modify env variables in both `.env.example` and `apps/web/src/env.js`.
- Route new server env reads through `env` from `apps/web/src/env.js`, not direct `process.env`.
- Respect custom server loading behavior: development uses only `.env`, while production loads `.env.local`, `.env.production`, then `.env`.

### Auth changes

- Modify auth behavior in `apps/web/src/server/auth/*` and exposed handlers in `apps/web/src/app/api/auth/[...nextauth]/route.ts`.
- Preserve existing callback and session semantics unless the request explicitly changes auth behavior.

### DB changes

- Edit schema in `apps/web/src/server/db/schema.ts`.
- Generate and apply Drizzle migrations in `apps/web/drizzle/`.
- Verify code paths that require `DATABASE_URL` still fail fast or degrade intentionally.

## Guardrails

- Keep `apps/web` and `packages/*` boundaries clean; do not import from `apps/web` inside packages.
- Keep TypeScript + ESM style consistent (`"type": "module"`).
- Keep edits narrow to the requested scope; avoid broad refactors unless required for correctness.
- Preserve existing behavior outside the requested change.

## Validate Before Finishing

1. Run targeted tests for changed route/procedure files first.
2. Run `npm --prefix apps/web run typecheck` for TypeScript safety.
3. Run `npm --prefix apps/web run check` when practical (lint + typecheck).
4. Run DB commands when schema changes are part of the request.

When a full check is not feasible, report exactly what ran and what did not run.

## Done Criteria

- Place code in the correct layer (tRPC vs proxy vs auth/db).
- Keep env schema and examples synchronized for new variables.
- Include or update tests for changed behavior when tests exist nearby.
- Summarize changed files and any remaining risk or follow-up checks.

## References

- Use `references/path-and-checks.md` for a concise map of file locations and command recipes.
