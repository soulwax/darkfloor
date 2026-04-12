# GitHub Copilot Instructions

Use [`AGENTS.md`](../AGENTS.md), [`CONTEXT.md`](../CONTEXT.md), [`README.md`](../README.md), and [`AI_TOOLING.md`](../AI_TOOLING.md) as the source of truth for this repository.

## Important repo rules

- Treat the repo as frontend-first.
- Default to `apps/web`, `apps/mobile`, and `packages/*`.
- `apps/web` owns Next.js routing, Auth.js/NextAuth, OAuth, cookies, and redirect behavior.
- `api/` is a Git submodule for explicit backend or coordinated full-stack work only.
- The main frontend production runtime is PM2 on Ubuntu, not Vercel.
- Use `apps/web/src/env.js` for validated env access.
- Keep `.env.example` updated when env keys change.
- Root `pnpm install --frozen-lockfile` runs `install:api` in `postinstall`, so initialize submodules first.

If guidance here conflicts with the root docs, prefer `AGENTS.md` and `AI_TOOLING.md`.
