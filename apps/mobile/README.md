# apps/mobile

React Native Web workspace powered by Expo.

Current scope:
- Runs a real Expo app for web with an upgrade path to iOS and Android
- Reuses shared monorepo packages through `@starchild/*` path aliases
- Ships a typed landing surface in `App.tsx` backed by shared playback/config contracts
- Exposes build/check scripts so Turborepo can include the app in workspace runs

Commands:
- `pnpm --dir apps/mobile run dev` starts the React Native Web dev server
- `pnpm --dir apps/mobile run dev:native` starts the Expo dev server for native targets
- `pnpm --dir apps/mobile run build` exports a web build to `dist/`
- `pnpm --dir apps/mobile run typecheck` validates the app under the repo's strict TypeScript rules

Not included yet:
- Native platform folders via `expo prebuild`
- Shared auth/playback runtime integration with the existing web app
- Mobile-specific data fetching, routing, and release automation
