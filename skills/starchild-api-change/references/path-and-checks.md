# Path and Checks

## Core Files

- `CONTEXT.md`
- `docs/ARCHITECTURE.md`
- `docs/API_ROUTE_USE.md`
- `docs/API_V2_SWAGGER.yaml`

## tRPC Surface

- Routers: `apps/web/src/server/api/routers/*`
- Root registration: `apps/web/src/server/api/root.ts`
- Endpoint handler: `apps/web/src/app/api/trpc/[trpc]/route.ts`

## Proxy Route Surface

- Route handlers: `apps/web/src/app/api/**/route.ts`
- V2 status/health examples: `apps/web/src/app/api/v2/**/route.ts`
- Streaming behavior example: `apps/web/src/app/api/stream/route.ts`

## Auth and DB Surface

- Auth configuration: `apps/web/src/server/auth/*`
- Auth route: `apps/web/src/app/api/auth/[...nextauth]/route.ts`
- DB index/schema: `apps/web/src/server/db/index.ts`, `apps/web/src/server/db/schema.ts`
- Drizzle migrations: `apps/web/drizzle/*`

## Env Rules

- Keep `.env.example` and `apps/web/src/env.js` synchronized.
- Route new env usage through `env` from `apps/web/src/env.js`.
- Avoid direct `process.env` reads for new server-side env usage.

## Command Checklist

- Install deps (if needed): `npm ci`
- App typecheck: `npm --prefix apps/web run typecheck`
- App lint + typecheck: `npm --prefix apps/web run check`
- App tests: `npm --prefix apps/web run test`
- Workspace boundaries: `npm run check:boundaries`
- DB generate: `npm --prefix apps/web run db:generate`
- DB migrate: `npm --prefix apps/web run db:migrate`

## Completion Notes

- Record which checks ran.
- Record any skipped checks and why.
- Call out follow-up risk when behavior changed without matching tests.
