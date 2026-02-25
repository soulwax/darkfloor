# Deployment and Operations

This guide collects production deployment and day-2 operational procedures. Keep the root `README.md` short; keep detailed runbooks here.

## Deployment targets

This repo supports three practical deployment paths:

- Vercel (`vercel.json`)
- Docker (`Dockerfile`, `docker-compose.yml`, `ecosystem.docker.cjs`)
- PM2 on a Node host (`ecosystem.config.cjs`)

## Pre-deploy checklist

1. Install dependencies:

```bash
pnpm install --frozen-lockfile
```

2. Confirm required env configuration exists in target environment:

- `AUTH_SECRET`
- `AUTH_DISCORD_ID`
- `AUTH_DISCORD_SECRET`
- `DATABASE_URL`
- `API_V2_URL`
- `BLUESIX_API_KEY` (or `UNIVERSAL_KEY`)

3. Build and sanity-check locally:

```bash
pnpm build
pnpm start
curl http://localhost:3222/api/health
```

4. Validate quality gate before release:

```bash
pnpm check
pnpm test
```

## Docker deployment

### Quick start

```bash
cp .env.example .env
# edit .env with production values

docker compose up -d --build
curl http://localhost:3222/api/health
```

### Day-2 operations

```bash
docker compose ps
docker compose logs -f app
docker compose restart app
docker compose down
docker compose up -d --build
```

### Notes

- Compose file: `docker-compose.yml`
- Runtime entrypoint: `scripts/docker-entrypoint.sh`
- Container PM2 config: `ecosystem.docker.cjs`
- Health probe uses `/api/health`
- The Docker image runs build/runtime commands through existing npm scripts in this repo

## PM2 deployment (traditional VM/host)

### First deployment

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm pm2:start
```

Or single command:

```bash
pnpm pm2:start:build
```

### Routine commands

```bash
pnpm pm2:status
pnpm pm2:logs
pnpm pm2:reload
pnpm pm2:restart
pnpm pm2:stop
pnpm pm2:delete
```

### Process names

Defined in `ecosystem.config.cjs`:

- production: `bluesix-frontend-prod`
- development: `bluesix-frontend-dev`

### Build safety behavior

- PM2 pre-start hook runs `scripts/ensure-build.js`.
- Server wrapper (`scripts/server.js` -> `apps/web/scripts/server.js`) validates build files and can auto-build when needed.

## Vercel deployment

`vercel.json` is already configured for pnpm:

- install: `pnpm install --frozen-lockfile`
- build: `pnpm run build`

Set the same required env vars in the Vercel project settings.

## Runtime health and observability

### Health checks

Use these endpoints during rollout and incident response:

- `/api/health` (local app health, optional DB check)
- `/api/v2/status` (upstream V2 liveness proxy)
- `/api/v2/health` (upstream V2 health proxy)

### Useful commands

```bash
curl -sS http://localhost:3222/api/health | jq
curl -sS http://localhost:3222/api/v2/status | jq
```

If `jq` is unavailable, run the same commands without it.

## Incident runbook

### 1. App unreachable

- Check process/container status (`pm2 status` or `docker compose ps`).
- Check logs (`pnpm pm2:logs` or `docker compose logs -f app`).
- Check health endpoint (`/api/health`).

### 2. Upstream music failures (5xx from stream/search)

- Verify `API_V2_URL` and key env variables.
- Hit `/api/v2/status` and `/api/v2/health`.
- If local app is healthy but V2 is failing, treat as upstream incident.

### 3. Auth failures

- Verify `AUTH_SECRET`, Discord credentials, and `NEXTAUTH_URL`.
- Confirm callback URLs are correct for the deployed domain.

### 4. Database failures

- Verify `DATABASE_URL` and provider reachability.
- Check app logs for pool or SSL errors from `apps/web/src/server/db/index.ts`.
