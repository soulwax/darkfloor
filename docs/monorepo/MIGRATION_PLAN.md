# Monorepo Migration Plan

## Goal

Migrate this repository from a single-root app to an apps + packages monorepo while preserving behavior and deployability throughout migration.

## Current State

- Single package repo (root `package.json`)
- Next.js app code under `src/*`, static assets under `public/*`
- Electron wrapper under `electron/*`
- Shared code co-located under `src/components`, `src/hooks`, `src/contexts`, `src/server`, `src/utils`

## Target Scaffold

```
apps/
  web/
  desktop/
  mobile/
packages/
  ui/
  types/
  player-core/
  player-react/
  audio-adapters/
  api-client/
  auth/
  config/
  visualizers/
  eslint-config/
  tsconfig/
```

## Migration Strategy

Use incremental PRs that keep the app runnable at every step.

### PR 0 - Non-breaking scaffold (done)

- Create `apps/*` and `packages/*` directory structure with placeholders.
- Add this migration plan.
- Do not change runtime paths or build scripts.

### PR 1 - Workspace bootstrap (non-functional changes)

- Introduce workspace tooling:
  - `pnpm-workspace.yaml`
  - `turbo.json`
- Keep existing root scripts as wrappers while adding app-scoped scripts.
- No file moves yet.

### PR 2 - Move web app into `apps/web`

- Move Next.js app and server code into `apps/web`.
- Keep root compatibility scripts temporarily:
  - `npm run dev` -> `pnpm --filter web dev` (or equivalent)
- Ensure env loading behavior in `scripts/server.js` is preserved.

### PR 3 - Move Electron into `apps/desktop`

- Move Electron files and desktop build scripts.
- Point Electron to `apps/web` build output/URL.
- Keep existing packaging behavior and runtime env handling.

### PR 4 - Extract shared packages

- Extract packages in this order:
  1. `packages/types`
  2. `packages/config`
  3. `packages/auth`
  4. `packages/api-client`
  5. `packages/player-core`
  6. `packages/player-react`
  7. `packages/visualizers`
  8. `packages/ui`
- Replace deep relative imports with package imports.

### PR 5 - Add mobile app shell (scaffolded)

- Introduce `apps/mobile` with shared packages only.
- No changes to web/desktop runtime behavior.

## Concrete Move Map

This map is the recommended source -> destination baseline for first migration PRs.

### Root config and static assets -> apps/web

- `next.config.js` -> `apps/web/next.config.js`
- `postcss.config.js` -> `apps/web/postcss.config.js`
- `tailwind.config.js` -> `apps/web/tailwind.config.js`
- `eslint.config.js` -> `apps/web/eslint.config.js` (or shared to `packages/eslint-config`)
- `tsconfig.json` -> `apps/web/tsconfig.json` (extends `packages/tsconfig/base.json`)
- `public/*` -> `apps/web/public/*`
- `src/*` -> `apps/web/src/*`
- `drizzle/*` -> `apps/web/drizzle/*`
- `drizzle.config.ts` -> `apps/web/drizzle.config.ts`
- `drizzle.env.ts` -> `apps/web/drizzle.env.ts`
- `scripts/server.js` -> `apps/web/scripts/server.js`

### Electron -> apps/desktop

- `electron/main.cjs` -> `apps/desktop/electron/main.cjs`
- `electron/preload.cjs` -> `apps/desktop/electron/preload.cjs`
- `electron/types.d.ts` -> `apps/desktop/electron/types.d.ts`
- `electron/prepare-package.js` -> `apps/desktop/electron/prepare-package.js`
- `electron/sign.js` -> `apps/desktop/electron/sign.js`
- `electron/verify-build.js` -> `apps/desktop/electron/verify-build.js`
- `electron/builder/afterPack.cjs` -> `apps/desktop/electron/builder/afterPack.cjs`
- Electron-specific scripts from `scripts/*` -> `apps/desktop/scripts/*`

### Shared types -> packages/types

- `src/types/index.ts` -> `packages/types/src/index.ts`
- `src/types/settings.ts` -> `packages/types/src/settings.ts`
- `src/types/api.ts` (if present) -> `packages/types/src/api.ts`

### Shared config/constants -> packages/config

- `src/env.js` -> `packages/config/src/env.ts` (web consumes server/client slices)
- `src/config/constants.ts` -> `packages/config/src/constants.ts`
- `src/config/storage.ts` -> `packages/config/src/storage.ts`
- `src/constants/visualizer.ts` -> `packages/config/src/visualizer.ts`

### Shared auth helpers -> packages/auth

- `src/server/auth/logging.ts` -> `packages/auth/src/logging.ts`
- `src/server/auth/spotifyProvider.ts` -> `packages/auth/src/spotifyProvider.ts`
- session-related shared types from auth config -> `packages/auth/src/types.ts`

### Shared API client/helpers -> packages/api-client

- `src/utils/api.ts` -> `packages/api-client/src/rest.ts`
- `src/trpc/react.tsx` -> `packages/api-client/src/trpc/react.tsx`
- `src/trpc/server.ts` -> `packages/api-client/src/trpc/server.ts`
- `src/trpc/query-client.ts` -> `packages/api-client/src/trpc/query-client.ts`

### Playback domain -> packages/player-core + packages/player-react

- `src/hooks/useAudioPlayer.ts` -> split:
  - pure queue/state domain -> `packages/player-core/src/*`
  - React hook wrapper -> `packages/player-react/src/useAudioPlayer.ts`
- `src/contexts/AudioPlayerContext.tsx` -> `packages/player-react/src/AudioPlayerContext.tsx`
- `src/hooks/useQueuePersistence.ts` -> `packages/player-react/src/useQueuePersistence.ts`

### Audio adapters -> packages/audio-adapters

- `src/utils/audioContextManager.ts` -> `packages/audio-adapters/src/web/audioContextManager.ts`
- web audio visualizer hooks -> `packages/audio-adapters/src/web/*`

### Visualizers -> packages/visualizers

- `src/components/visualizers/FlowFieldRenderer.ts` -> `packages/visualizers/src/FlowFieldRenderer.ts`
- `src/components/visualizers/FlowFieldCanvas.tsx` -> `packages/visualizers/src/FlowFieldCanvas.tsx`
- `src/components/visualizers/flowfieldPatterns/*` -> `packages/visualizers/src/flowfieldPatterns/*`

### Shared UI -> packages/ui

Candidates to extract first (low coupling):

- `src/components/Button.tsx`
- `src/components/LoadingSpinner.tsx`
- `src/components/Section.tsx`
- `src/components/Toast.tsx`
- `src/components/SmoothSlider.tsx`

Keep app-specific shells in `apps/web` initially:

- `src/components/PersistentPlayer.tsx`
- `src/components/MobilePlayer.tsx`
- `src/components/DesktopShell.tsx`

## Acceptance Criteria per PR

- `npm run dev` equivalent still starts web app.
- `npm run electron:dev` equivalent still starts desktop app.
- Auth sign-in and callback flows remain functional.
- Playback queue continuity remains functional (local + authenticated persistence).
- CI checks remain green for moved scopes.

## Rollback Guidance

- Keep migration PRs small and independently revertible.
- Introduce package exports before deleting old paths.
- Use temporary compatibility re-export files for one PR cycle where needed.
