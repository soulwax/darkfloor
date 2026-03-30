# apps/mobile

Expo-powered React Native workspace for the Starchild mobile runtime.

Current scope:
- Runs a real mobile shell for web today with a clean path to iOS and Android
- Reuses shared monorepo contracts from `@starchild/config`, `@starchild/types`, and `@starchild/player-core`
- Splits app-only UI, theme, state, and demo data into `src/mobile-shell/*` instead of keeping the app in one file
- Provides queue, library, discover, and search surfaces that can later be swapped from staged data to live auth/playback/API integrations

Key files:
- `App.tsx`: tiny Expo entry composition root
- `index.ts`: Expo registration entrypoint
- `src/index.ts`: shared mobile-shell exports and bootstrap helpers
- `src/mobile-shell/data.ts`: typed demo tracks, queue state, and tab metadata
- `src/mobile-shell/useMobileShellState.ts`: mobile tab and search state
- `src/mobile-shell/MobileApp.tsx`: screen composition and layout
- `src/mobile-shell/components.tsx`: reusable React Native UI primitives for the shell

Commands:
- `pnpm --dir apps/mobile run dev` starts the React Native Web dev server
- `pnpm --dir apps/mobile run dev:native` starts the Expo dev server for native targets
- `pnpm --dir apps/mobile run build` exports a web build to `dist/`
- `pnpm --dir apps/mobile run typecheck` validates the app under the repo's strict TypeScript rules

Still to do:
- Install Expo/mobile dependencies in this workspace so local typecheck/build can run end to end
- Replace staged data with shared auth, playback, and API-backed queries
- Add routing, native-safe storage, and release automation for actual device targets
