# GitHub Copilot Instructions

Use [`AGENTS.md`](../AGENTS.md), [`CONTEXT.md`](../CONTEXT.md), [`README.md`](../README.md), and [`AI_TOOLING.md`](../AI_TOOLING.md) as the source of truth for this repository.

## Important repo rules

- Treat the repo as a coordinated frontend/backend workspace.
- Default to the workspace that owns the behavior: `apps/web`, `apps/mobile`, `packages/*`, or `api/`.
- `apps/web` owns Next.js routing, Auth.js/NextAuth, OAuth, cookies, and redirect behavior.
- `api/` is the full backend source checkout/submodule for backend API behavior and coordinated full-stack work.
- The main frontend production runtime is PM2 on Ubuntu, not Vercel.
- Use `apps/web/src/env.js` for validated env access.
- Keep `.env.example` updated when env keys change.
- Root `pnpm install --frozen-lockfile` runs `install:api` in `postinstall`, so initialize submodules first.

If guidance here conflicts with the root docs, prefer `AGENTS.md` and `AI_TOOLING.md`.
