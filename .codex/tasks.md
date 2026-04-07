# Codex Task Checklist

Last updated: 2026-04-06

## For Every Task

1. Read `AGENTS.md`, `CONTEXT.md`, `README.md`, `AI_TOOLING.md`, and the `.codex/*.md` files.
2. Decide whether the task belongs to:
   - frontend (`apps/web`, `apps/mobile`, `packages/*`)
   - backend (`api/`)
   - coordinated full-stack work
3. Follow existing patterns before inventing a new flow.
4. Keep changes localized and validate the touched path.
5. For frontend production debugging, start with PM2 and local Ubuntu runtime checks, not Vercel deployment tooling.

## For Auth/OAuth/Cookie Work

1. Identify the owner before editing:
   - frontend Auth.js/NextAuth in `apps/web`
   - backend auth/API behavior in `api/`
2. For Discord/GitHub OAuth, stay in `apps/web` unless the user explicitly asks for full-stack work.
3. Do not use backend env vars to drive frontend provider OAuth behavior unless the code path explicitly does that already and the task is to change it.
4. Summarize the ownership decision before making multi-file changes.
5. Add targeted tests for redirect/callback/cookie behavior when practical.

## Enter `api/` Only When

- The user explicitly asks for backend or full-stack work.
- The frontend code clearly delegates the broken behavior to backend endpoints.
- A contract mismatch cannot be fixed safely from the frontend alone.

## Avoid Repeating

- Do not treat “auth” as automatically backend.
- Do not treat the `api/` submodule as part of the default implementation path.
- Do not mix Next.js/Auth.js assumptions with backend service assumptions.
- Do not assume the frontend is deployed on Vercel; the main frontend runtime is PM2-hosted.
