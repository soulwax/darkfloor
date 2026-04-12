# Codex Notes

This file is intentionally thin. Use [`AGENTS.md`](./AGENTS.md) and [`AI_TOOLING.md`](./AI_TOOLING.md) as the source of truth.

## Read Order

1. `AGENTS.md`
2. `CONTEXT.md`
3. `README.md`
4. `AI_TOOLING.md`
5. `.codex/prompt.md`
6. `.codex/tasks.md`
7. `.codex/acceptance.md`
8. `apps/mobile/README.md` when the task touches mobile

## Current Guardrails

- Treat this repository as frontend-first.
- Default to `apps/web`, `apps/mobile`, and `packages/*`.
- `apps/web` owns Next.js routing, Auth.js/NextAuth, OAuth, redirects, and cookie behavior.
- `api/` is a Git submodule for explicit backend or coordinated full-stack work, not the normal frontend path.
- The main frontend production runtime is PM2 on Ubuntu, not Vercel.
- Root `pnpm install --frozen-lockfile` runs `install:api` in `postinstall`, so initialize submodules before first install.

For detailed implementation guidance, stay anchored to `AGENTS.md`, `AI_TOOLING.md`, and the `.codex/*.md` files.
