# Troubleshooting

This is the operational troubleshooting companion for setup and deployment.

## Fast triage

Run these checks first:

```bash
pnpm pm2:status               # if using PM2
curl -sS http://localhost:3222/api/health
curl -sS http://localhost:3222/api/v2/status
```

Then review logs:

```bash
pnpm pm2:logs
# or

docker compose logs -f app
```

## Missing required environment variable

Symptoms:

- startup failure with env validation error
- runtime route errors complaining about missing config

Fix:

1. Compare `.env` with `.env.example`.
2. Confirm schema expectations in `apps/web/src/env.js`.
3. Ensure required values are present and valid URLs where needed.
4. Restart process after updating env values.

## NextAuth login does not work

Symptoms:

- `/api/auth/*` returns errors
- OAuth callback loops or fails

Fix:

1. Validate `AUTH_SECRET`, `AUTH_DISCORD_ID`, `AUTH_DISCORD_SECRET`.
2. Ensure `NEXTAUTH_URL` matches deployed origin.
3. Verify Discord OAuth callback URL configuration.
4. Check auth handler logs from `apps/web/src/server/auth/*`.

## Spotify OAuth fails in split-origin deployments

Symptoms:

- callback succeeds upstream but frontend remains unauthenticated
- CSRF/cookie mismatch in refresh calls

Fix:

1. Set `NEXT_PUBLIC_AUTH_API_ORIGIN`.
2. Start login at `${NEXT_PUBLIC_AUTH_API_ORIGIN}/api/auth/spotify?...`.
3. Ensure backend allows frontend origin in `AUTH_FRONTEND_ORIGINS`.
4. Ensure browser requests include credentials and CSRF token where required.

## Database connection failures

Symptoms:

- `DATABASE_URL is required` error
- `/api/health` reports `checks.database = "error"`

Fix:

1. Set valid `DATABASE_URL`.
2. Verify DB host is reachable from runtime environment.
3. Confirm SSL expectations for your DB provider.
4. Re-run migrations:

```bash
pnpm db:migrate
```

## Stream/search endpoints return 5xx

Symptoms:

- `/api/stream` returns `502`, `503`, or `504`
- `/api/music/search` fails despite app being up

Fix:

1. Verify `API_V2_URL` and `BLUESIX_API_KEY`/`UNIVERSAL_KEY`.
2. Check `/api/v2/status` and `/api/v2/health`.
3. Inspect stream proxy diagnostics in `apps/web/src/app/api/stream/route.ts` logs.
4. If upstream health fails, treat as upstream incident rather than frontend bug.

## Process looks online but app is not responding

Symptoms:

- PM2 shows `online`
- browser/API requests time out

Fix:

1. Check listening port:

```bash
ss -ltnp | rg 3222
```

2. Call health endpoint directly:

```bash
curl -v http://127.0.0.1:3222/api/health
```

3. Restart process:

```bash
pnpm pm2:restart
```

4. If restart loops, inspect build and logs.

## Build fails during deploy

Fix order:

1. Run static checks:

```bash
pnpm check
```

2. Re-run build with clean output:

```bash
rm -rf .next
pnpm build
```

3. If dependency graph is suspect, reinstall:

```bash
pnpm install --frozen-lockfile
```

## Docker build fails at install step

Symptoms:

- image build fails during dependency install (`npm ci` stage)

Fix:

1. Confirm your Docker build context includes all required lockfiles/manifests.
2. Ensure your install command and lockfile strategy are aligned.
3. If needed, adjust Docker build strategy to match the repo package manager policy (`pnpm-lock.yaml`).

## Audio does not start or Web Audio errors appear

Symptoms:

- play requests no-op on first interaction
- browser reports autoplay/user-gesture policy errors

Fix:

1. Trigger playback from explicit user interaction (click/tap).
2. Verify browser autoplay policy behavior.
3. Re-test on latest Chromium/Firefox/Safari.

## Queue state is not persisted

Symptoms:

- queue resets unexpectedly
- authenticated sync behaves inconsistently

Fix:

1. Verify browser local storage is available.
2. Confirm user session is valid for DB-backed persistence.
3. Inspect tRPC queue procedures in `apps/web/src/server/api/routers/music.ts`.
4. Confirm no cross-user session switching edge case is clearing queue.

## Need more context

- Setup details: `docs/SETUP.md`
- Deployment runbooks: `docs/DEPLOYMENT.md`
- Route-level API mapping: `docs/API_ROUTE_USE.md`
- Architecture/data flow: `docs/ARCHITECTURE.md`
