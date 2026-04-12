# Claude Code Notes

This compatibility file stays short on purpose. Use [`AGENTS.md`](./AGENTS.md) and [`AI_TOOLING.md`](./AI_TOOLING.md) as the canonical guidance.

## Read Order

1. `AGENTS.md`
2. `CONTEXT.md`
3. `README.md`
4. `AI_TOOLING.md`
5. `.codex/prompt.md`
6. `.codex/tasks.md`
7. `.codex/acceptance.md`
8. `apps/mobile/README.md` when mobile is involved

## Repo Boundaries

- Frontend-first monorepo.
- Default implementation path: `apps/web`, `apps/mobile`, `packages/*`.
- `apps/web` owns Auth.js/NextAuth, OAuth, redirects, cookies, and normal Next.js work.
- Only enter `api/` for explicit backend or coordinated full-stack changes.
- Frontend production is PM2-hosted on Ubuntu; do not assume Vercel for normal incident or runtime debugging.
- Use `apps/web/src/env.js` as the validated env source of truth and keep `.env.example` in sync when env keys change.
- Root install requires the `api/` submodule because `postinstall` runs `pnpm run install:api`.

If there is any conflict, prefer `AGENTS.md` and `AI_TOOLING.md` over this file.
