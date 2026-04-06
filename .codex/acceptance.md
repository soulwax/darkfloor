# Codex Acceptance

Last updated: 2026-04-06

Use this as the definition of done for normal work in this repository.

## Minimum Acceptance

- The owning layer is correct:
  - frontend work stays in `apps/web`, `apps/mobile`, or `packages/*`
  - backend work only touches `api/` when truly required
- The change follows existing repo patterns and boundaries.
- Validation was run for the touched path, or any blocker is stated explicitly.
- The summary names the owner of the behavior that changed.

## Auth/OAuth Acceptance

- The fix states whether it belongs to frontend Auth.js/NextAuth or backend auth/API behavior.
- Frontend provider OAuth work does not rely on backend env/config by accident.
- Redirect and callback behavior are tested or otherwise directly verified.
- Cookie scope/origin assumptions are described when they matter.

## Documentation Acceptance

- If a task exposed a recurring repo-boundary pitfall, update the root guidance or `.codex` state so the mistake is less likely to repeat.
- Keep guidance short, concrete, and operational.
