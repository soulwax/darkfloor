# apps/mobile

Expo-powered React Native workspace for the Starchild mobile runtime.

This workspace now behaves like a durable app shell rather than a one-shot demo page:
- boots through a typed shell controller under `src/mobile-shell/*`
- restores the last mobile shell session on web when local storage is available
- keeps queue, playback, storage, and visualizer contracts aligned with shared `@starchild/*` packages
- preserves a clean path to iOS and Android through Expo without coupling app code to the web runtime

## Key files

- `App.tsx`: tiny Expo composition root
- `index.ts`: Expo registration entrypoint
- `src/index.ts`: shared mobile exports plus initial shell state metadata
- `src/mobile-shell/MobileApp.tsx`: top-level mobile screen composition and safe-area layout
- `src/mobile-shell/components.tsx`: reusable React Native UI primitives
- `src/mobile-shell/data.ts`: typed staged catalog, queue, collections, and prompts
- `src/mobile-shell/storage.ts`: mobile shell persistence and restore helpers
- `src/mobile-shell/types.ts`: mobile runtime view-model contracts
- `src/mobile-shell/useMobileShellState.ts`: reducer-driven controller for tab/search/session state

## Runtime shape

- Layout:
  - `MobileApp.tsx` owns framing, responsive layout, and screen composition.
  - The shell uses `SafeAreaView`, `KeyboardAvoidingView`, and centered max-width content so the same tree behaves well on web today and device targets later.
- State:
  - `useMobileShellState.ts` owns active tab, search query, queue summary, repeat mode, and session hydration metadata.
  - Search indexing is built once outside the hook to keep typing responsive.
  - Session state is restored from `hexmusic_mobile_shell_state` when a stored snapshot is valid.
- Data:
  - `data.ts` remains staged on purpose.
  - The next integration seams are auth/session, playback engine wiring, queue sync, and API-backed discovery/search.

## Commands

Run these from the repo root unless you intentionally want the app-local form.

- `pnpm dev:mobile`: start Expo for the web shell
- `pnpm dev:mobile:native`: start Expo for native targets
- `pnpm dev:mobile:ios`: launch the iOS Expo target
- `pnpm dev:mobile:android`: launch the Android Expo target
- `pnpm mobile:check`: type-check the mobile workspace
- `pnpm mobile:build`: export the web build to `apps/mobile/dist`

App-local equivalents:
- `pnpm --dir apps/mobile run dev`
- `pnpm --dir apps/mobile run dev:native`
- `pnpm --dir apps/mobile run dev:ios`
- `pnpm --dir apps/mobile run dev:android`
- `pnpm --dir apps/mobile run typecheck`
- `pnpm --dir apps/mobile run build`

## Working conventions

- Reuse shared contracts from `@starchild/config`, `@starchild/player-core`, and `@starchild/types`.
- Keep app-only view state in `apps/mobile`, not in shared packages.
- Prefer small React Native primitives over one giant screen component.
- Keep placeholder data obviously staged, but make the surrounding architecture production-worthy.
- Validate with `pnpm mobile:check` after touching this workspace.

## Next likely integrations

- swap staged queue/search data for real auth and API-backed data sources
- connect persisted shell state to shared queue/player state
- add native-safe storage and release automation once iOS/Android builds become first-class
